import { randomUUID } from 'node:crypto';
import { transaction, HttpError } from './db';
import { assertPermission, checksum } from './security';
import { writeRecord, audit, enqueue } from './records';

const normalized = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').trim().toLowerCase();

export async function discardIncidentDrafts(user:any,ids:unknown) {
  assertPermission(user,'MANAGE_VIOLATIONS');
  if(!Array.isArray(ids) || ids.length>500 || ids.some(id=>typeof id!=='string' || !id || id.length>180)) throw new HttpError(400,'Danh sách đối soát không hợp lệ.');
  return transaction(async db=>{
    await db.query('select pg_advisory_xact_lock(726451)');
    const rows=(await db.query("select id,data from private.records where module='incidents' and id=any($1::text[]) order by id for update",[ids])).rows;
    if(rows.some(row=>row.data.isSyncedToProfile===true)) throw new HttpError(409,'Vụ việc đã được đồng bộ. Hãy kiểm tra danh sách đã đồng bộ.');
    await db.query("delete from private.records where module='incidents' and id=any($1::text[])",[ids]);
    for(const row of rows) {
      await audit(db,user.id,'incidents.discard','incidents',row.id);
      await enqueue(db,'incidents',row.id,{id:row.id,deleted:true},user.id);
    }
    if(rows.length)await db.query("insert into public.record_changes(module) values('incidents')");
    return {success:true};
  });
}

export async function deletePublishedIncident(user: any, incidentId: string) {
  assertPermission(user, 'MANAGE_VIOLATIONS');
  if (!incidentId || typeof incidentId !== 'string') throw new HttpError(400, 'Mã vụ việc không hợp lệ.');
  return transaction(async (db) => {
    await db.query('select pg_advisory_xact_lock(726451)');
    const row = (
      await db.query(
        "select id,data from private.records where module='incidents' and id=$1 for update",
        [incidentId],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, 'Không tìm thấy vụ việc.');
    const incident = row.data;
    const writer = {
      ...user,
      assignedPermissions: [...(user.assignedPermissions || []), 'MANAGE_HR'],
    };

    let updatedEmployee: any = null;
    if (incident.matchedEmployeeId) {
      await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [
        'employees:' + incident.matchedEmployeeId,
      ]);
      const empRow = (
        await db.query(
          "select id,data from private.records where module='employees' and id=$1 for update",
          [incident.matchedEmployeeId],
        )
      ).rows[0];
      if (empRow) {
        const employee = empRow.data;
        const oldRecords = employee.violationRecords || [];
        const points =
          Number(incident.pointsDeducted) ||
          (incident.severity === 'NGHIEM_TRONG' ? 15 : incident.severity === 'TRUNG_BINH' ? 10 : 5);
        const newRecords = oldRecords.filter(
          (vr: any) =>
            vr.incidentId !== incident.id &&
            vr.id !== 'vr-' + incident.importChecksum &&
            !(vr.incidentCode === incident.code && vr.time === incident.time),
        );
        const newCount = Math.max(0, Number(employee.violationCount || oldRecords.length) - 1);
        const restoredScore = Math.min(100, Number(employee.competencyScore ?? 100) + points);

        updatedEmployee = await writeRecord(db, writer, 'employees', employee.id, {
          violationRecords: newRecords,
          violationCount: newCount,
          competencyScore: restoredScore,
        });
      }
    }

    await db.query("delete from private.records where module='incidents' and id=$1", [incidentId]);
    await audit(db, user.id, 'incidents.delete_published', 'incidents', incidentId, {
      code: incident.code,
      matchedEmployeeId: incident.matchedEmployeeId,
    });
    await enqueue(db, 'incidents', incidentId, { id: incidentId, deleted: true }, user.id);
    await db.query("insert into public.record_changes(module) values('incidents'),('employees')");

    return {
      success: true,
      deletedIncidentId: incidentId,
      updatedEmployee,
    };
  });
}

// Confirmation owns the complete transaction: published case, personnel history and archive readiness.
export async function confirmIncidents(user: any, input: any, sourceJobId?: string) {
  assertPermission(user, 'MANAGE_VIOLATIONS');
  if (!Array.isArray(input) || !input.length || input.length > 500)
    throw new HttpError(400, 'Chọn từ 1 đến 500 vụ việc để đồng bộ.');
  for (const item of input) {
    if (!item || item.isRtgRelated !== true || !item.id || !item.code || !item.time || !item.what || !item.matchedEmployeeId ||
        !['THAP','TRUNG_BINH','NGHIEM_TRONG'].includes(item.severity))
      throw new HttpError(400, 'Vụ việc phải thuộc Tổ RTG, đủ thông tin và khớp nhân sự trước khi đồng bộ.');
  }
  return transaction(async db => {
    await db.query('select pg_advisory_xact_lock(726451)');
    const ids = [...new Set(input.map(item => String(item.matchedEmployeeId)))].sort();
    for (const id of ids) await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['employees:' + id]);
    const staff = (await db.query("select id,data from private.records where module='employees' and id=any($1::text[]) order by id for update", [ids])).rows;
    if (staff.length !== ids.length) throw new HttpError(409, 'Nhân sự đã thay đổi. Hãy đối soát lại trước khi đồng bộ.');
    const employees = new Map(staff.map(row => [row.id, row.data]));
    const writer = {...user, assignedPermissions:[...(user.assignedPermissions || []),'MANAGE_HR']};
    const items: any[] = [], updatedNames = new Set<string>();
    let count = 0;
    const jobId = randomUUID();
    for (const item of input) {
      const discarded=await db.query("select 1 from private.audit_log where module='incidents' and record_id=$1 and action in ('incidents.delete','incidents.discard') limit 1",[item.id]);
      if(discarded.rows.length)throw new HttpError(409,'Vụ việc đã bị xóa khỏi bảng đối soát. Hãy tải lại dữ liệu.');
      const employee: any = employees.get(String(item.matchedEmployeeId));
      if (!/rtg|cau khung/.test(normalized(employee.department))) throw new HttpError(400, 'Chỉ đồng bộ nhân sự thuộc Tổ RTG.');
      const normalizedName = normalized(item.normalizedName || item.violatorName);
      if (normalizedName !== normalized(employee.fullName)) throw new HttpError(409, 'Tên nhân viên chưa khớp hồ sơ. Hãy đối soát lại.');
      const identity = checksum([normalized(item.code), normalized(item.time), employee.id]);
      const existing = (await db.query("select data from private.records where module='incidents' and (id=$1 or id=$2 or (data->>'code'=$3 and data->>'time'=$4 and data->>'matchedEmployeeId'=$5)) order by id limit 1 for update", [item.id,'inc-' + identity,item.code,item.time,employee.id])).rows[0]?.data;
      if (existing && (existing.code!==item.code || existing.time!==item.time || existing.matchedEmployeeId!==employee.id))
        throw new HttpError(409,'Mã bản ghi thuộc vụ việc khác. Hãy tải lại bảng đối soát.');
      if (existing?.isSyncedToProfile === true) { items.push(existing); continue; }
      const saved: any = {id:existing?.id || 'inc-' + identity};
      for (const key of ['code','time','location','what','why','how','equipment','severity','sourceAppendix','originalName','timeAndLocation','incidentProgression','consequence','cause','responsibility','managingUnit','correctiveAction','classification']) saved[key]=item[key];
      Object.assign(saved, {violatorName:employee.fullName, normalizedName:employee.fullName, matchedEmployeeId:employee.id, matchedEmployeeCode:employee.employeeCode, matchedDepartment:employee.department, department:employee.department,
        isMatchedWithSystem:true, isRtgRelated:true, isSyncedToProfile:true, importJobId:jobId, importChecksum:identity, importStatus:'success'});
      const records = employee.violationRecords || [];
      const recorded = records.some((record: any) => record.incidentId===saved.id || (record.incidentCode===item.code && record.time===item.time));
      if (!recorded) {
        const points = item.severity==='NGHIEM_TRONG' ? 15 : item.severity==='TRUNG_BINH' ? 10 : 5;
        const record = {id:'vr-' + identity, incidentId:saved.id, incidentCode:item.code, time:item.time, location:item.location, what:item.what, why:item.why, how:item.how, equipment:item.equipment,
          severity:item.severity==='NGHIEM_TRONG'?'HIGH':item.severity==='TRUNG_BINH'?'MEDIUM':'LOW', pointsDeducted:points, recordedAt:new Date().toISOString()};
        // Only these server-derived personnel fields are writable with the violation permission.
        const updated = await writeRecord(db,writer,'employees',employee.id,{violationRecords:[record,...records], violationCount:Number(employee.violationCount || 0)+1, competencyScore:Math.max(0,Number(employee.competencyScore ?? 100)-points)});
        employees.set(employee.id,updated); count++; updatedNames.add(employee.fullName);
      }
      items.push(await writeRecord(db,user,'incidents',saved.id,saved));
    }
    if (sourceJobId) {
      const source = await db.query("update private.temporary_files set business_saved_at=now() where job_id=$1 and exists(select 1 from private.sync_queue where job_id=$1 and requested_by=$2 and module='incidents') returning job_id", [sourceJobId,user.id]);
      if (!source.rows.length) throw new HttpError(409,'Tệp nguồn không thuộc lần nhập của bạn.');
    }
    await audit(db,user.id,'violation.confirm','incidents',jobId,{count,submitted:input.length});
    return {items,count,updatedNames:[...updatedNames]};
  });
}
