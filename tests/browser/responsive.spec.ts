import { test, expect } from "@playwright/test";
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
const emptySyncSummary={total:0,drive:0,sheet:0,waitingConfirmation:0,pending:0,processing:0,failed:0,needsAttention:0};
const admin = {
  id: "test-admin",
  fullName: "Quản trị kiểm thử",
  employeeCode: "TEST001",
  username: 'test001',
  email: "test@example.test",
  phone: "",
  zaloPhone: "",
  zaloSynced: false,
  avatar: "",
  role: "ADMIN",
  status: "ACTIVE",
  department: "RTG ca 1",
  position: "Quản trị",
  competencyScore: 85,
  quizzesCompleted: 0,
  violationCount: 0,
  proposalsCount: 0,
  onboardingCompleted: true,
  assignedPermissions: [],
  visibleTabs: [],
  joinDate: "2026-01-01",
};

async function realtimeBus(page:any) {
  const channels = new Map<string,{socket:any,joinRef:string,id:number,module:string}>();
  let nextId=0;
  await page.routeWebSocket('wss://unconfigured.supabase.co/realtime/v1/websocket*', (socket:any)=>{
    socket.onMessage((raw:string)=>{
      const [joinRef,ref,topic,event,payload]=JSON.parse(raw);
      if(event==='phx_join') {
        const id=++nextId, filter=payload.config.postgres_changes[0];
        channels.set(topic,{socket,joinRef,id,module:filter.filter?.split('eq.')[1] || '*'});
        socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{postgres_changes:[{...filter,id}]}}]));
      } else if(event==='phx_leave') {
        channels.delete(topic);
        socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]));
      } else if(event==='heartbeat') socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{status:'ok',response:{}}]));
    });
  });
  return {
    count:(module:string)=>[...channels.values()].filter(c=>c.module===module || c.module==='*').length,
    emit:(module:string)=>{for(const [topic,c] of channels) if(c.module===module || c.module==='*')
      c.socket.send(JSON.stringify([c.joinRef,null,topic,'postgres_changes',{ids:[c.id],data:{schema:'public',table:'record_changes',type:'INSERT',commit_timestamp:new Date().toISOString(),columns:[{name:'id',type:'int8'},{name:'module',type:'text'}],record:{id:Date.now(),module},old_record:{},errors:null}}]));},
  };
}

for (const role of ['ADMIN','MANAGER_L1','USER']) test(`Realtime updates settings and menu permissions without reload for ${role}`,async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  let profile={...admin,role,visibleTabs:['settings'],assignedPermissions:[]};
  let announcement='Thông báo trước cập nhật';
  await authenticated(page,false,profile);
  const bus=await realtimeBus(page);
  await page.route('**/api/me',route=>route.fulfill({json:profile}));
  await page.route('**/api/records/employees?*',route=>route.fulfill({json:{items:[profile],nextCursor:null}}));
  await page.route('**/api/records/settings?*',route=>route.fulfill({json:{items:[{id:'global',announcementTitle:announcement,announcementContent:'Nội dung dùng để kiểm tra Realtime'}],nextCursor:null}}));
  await page.goto('/');
  await expect.poll(()=>bus.count('employees')).toBe(1);
  if(role!=='ADMIN') await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);
  profile={...profile,visibleTabs:['dashboard','settings','feedback','quiz']};
  bus.emit('employees');
  await expect(page.getByTestId('nav-dashboard')).toBeVisible();
  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByText(announcement,{exact:true})).toBeVisible();
  announcement='Thông báo Realtime mới';
  bus.emit('settings');
  await expect(page.getByText(announcement,{exact:true})).toBeVisible();
  if(role!=='ADMIN') {
    await expect(page.getByRole('button',{name:'Đẩy dữ liệu ngay'})).toHaveCount(0);
    await page.getByTestId('nav-settings').click();
    await expect(page.getByText('Đồng Bộ Google Sheet & Cấp Quyền',{exact:true})).toHaveCount(0);
    profile={...profile,visibleTabs:['settings']};
    bus.emit('employees');
    await expect(page.getByTestId('nav-dashboard')).toHaveCount(0);
  }
  await expect.poll(()=>bus.count('employees')).toBe(1);
});

test('Yard statistics display in memory without saving files or results',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await authenticated(page);
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([
    ['BLOCK','NOTIN_LOADLIST_FLG'],['A1','N'],['A01','N'],['B2','N'],['B3','Y'],['','N'],
  ]),'Data');
  const mutations:string[]=[];
  page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/') && path!=='/api/session' && req.method()==='POST') mutations.push(path);});
  await page.route('**/api/operations/excel/preview',route=>route.fulfill({json:{workbook},headers:{'Cache-Control':'no-store'}}));
  await page.goto('/');
  await page.getByTestId('nav-container_tool').click();
  await page.locator('input[type=file]').setInputFiles({name:'port-export.xls',mimeType:'application/vnd.ms-excel',buffer:Buffer.from(XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}))});
  await expect(page.getByRole('row',{name:'A01 2 B02 1',exact:true})).toBeVisible();
  await expect(page.getByRole('row',{name:'TỔNG CỘNG ĐANG LƯU BÃI 3 Cont',exact:true})).toBeVisible();
  await expect(page.getByText(/Chỉ xem thống kê — không lưu file hoặc kết quả/)).toBeVisible();
  await page.getByTestId('nav-dashboard').click();
  await page.getByTestId('nav-container_tool').click();
  await expect(page.getByRole('row',{name:'TỔNG CỘNG ĐANG LƯU BÃI 3 Cont',exact:true})).toHaveCount(0);
  expect(mutations).toEqual(['/api/operations/excel/preview']);
});

const incidentFixture={id:'incident-draft',code:'SC-TEST',time:'27/09/2026',location:'A01',violatorName:admin.fullName,normalizedName:admin.fullName,matchedEmployeeId:admin.id,matchedEmployeeCode:admin.employeeCode,matchedDepartment:'RTG ca 1',department:'RTG ca 1',isRtgRelated:true,isMatchedWithSystem:true,severity:'THAP',what:'Vụ việc kiểm thử',why:'Nguyên nhân thử',how:'Nhắc nhở',sourceAppendix:'PHU_LUC_1'};
test('Incident draft deletion survives Realtime; confirmation clears drafts only on success',async({page})=>{
  await page.setViewportSize({width:1366,height:1000});
  await authenticated(page);const bus=await realtimeBus(page);
  let saved:any[]=[incidentFixture,{...incidentFixture,id:'second',code:'SC-KEEP'}],fail=true,reads=0;
  await page.route('**/api/records/incidents?*',route=>{reads++;return route.fulfill({json:{items:saved,nextCursor:null}});});
  await page.route('**/api/operations/incidents/employees',route=>route.fulfill({json:[admin]}));
  await page.route('**/api/operations/incidents/discard',route=>{const ids=route.request().postDataJSON().ids;saved=saved.filter(item=>!ids.includes(item.id));return route.fulfill({json:{success:true}});});
  await page.route('**/api/operations/incidents/confirm',route=>{
    if(fail)return route.fulfill({status:503,json:{error:'Đồng bộ thử thất bại'}});
    saved=route.request().postDataJSON().items.map((item:any)=>({...item,isSyncedToProfile:true}));
    return route.fulfill({json:{items:saved,count:1,updatedNames:[admin.fullName]}});
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');await page.getByTestId('nav-violations').click();
  await expect(page.getByRole('button',{name:'Bảng đối soát (2)',exact:true})).toBeVisible();
  await page.getByRole('row').filter({hasText:'SC-TEST'}).getByTitle('Xóa vụ việc',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Bảng đối soát (1)',exact:true})).toBeVisible();
  const before=reads;bus.emit('incidents');await expect.poll(()=>reads).toBeGreaterThan(before);
  await expect(page.getByText('SC-TEST',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Đồng bộ vào Hồ sơ Nhân sự (Nội bộ)',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Đồng bộ thử thất bại');
  await expect(page.getByRole('button',{name:'Bảng đối soát (1)',exact:true})).toBeVisible();
  fail=false;await page.getByRole('button',{name:'Đồng bộ vào Hồ sơ Nhân sự (Nội bộ)',exact:true}).click();
  await expect(page.getByText('Đồng bộ Hồ sơ Thành công!',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hoàn tất',exact:true}).click();
  await expect(page.getByRole('button',{name:'Bảng đối soát (0)',exact:true})).toBeVisible();
  bus.emit('incidents');await page.getByRole('button',{name:'Đã đồng bộ (1)',exact:true}).click();
  await expect(page.getByText('SC-KEEP',{exact:true})).toBeVisible();
});
test('Incident viewer receives published cases through Realtime without Google sync controls',async({page})=>{
  await page.setViewportSize({width:1366,height:1000});
  await authenticated(page,false,{...admin,id:'viewer',role:'USER',visibleTabs:['violations'],assignedPermissions:[]});
  const bus=await realtimeBus(page);let saved:any[]=[];
  await page.route('**/api/records/incidents?*',route=>route.fulfill({json:{items:saved,nextCursor:null}}));
  await page.goto('/');await page.getByTestId('nav-violations').click();
  await expect.poll(()=>bus.count('incidents')).toBe(1);
  saved=[{...incidentFixture,isSyncedToProfile:true},{...incidentFixture,id:'hidden',code:'SC-HIDDEN'}];bus.emit('incidents');
  await expect(page.getByText('SC-TEST',{exact:true})).toBeVisible();
  await expect(page.getByText('SC-HIDDEN',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Data_RTG|Đồng bộ ngay|Hồ sơ Nhân sự/})).toHaveCount(0);
  await expect(page.getByText('Nguồn dữ liệu Chuẩn hóa:',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Vi phạm & Sự cố',exact:true})).toBeVisible();
});

test('Google queue hides successes and automatically removes newly completed jobs',async({page})=>{
  await authenticated(page);
  let complete=false,reads=0;
  await page.route('**/api/google/automation',route=>route.fulfill({json:{enabled:true}}));
  await page.route('**/api/google/jobs?*',route=>{
    reads++;
    return route.fulfill({json:{items:[{job_id:'complete',module:'hidden-completed',kind:'sheet',status:'success',created_at:new Date().toISOString()},
      ...(!complete?[{job_id:'waiting',module:'employees',kind:'sheet',status:'pending',created_at:new Date().toISOString()}]:[])],summary:complete?emptySyncSummary:{...emptySyncSummary,total:1,sheet:1,pending:1}}});
  });
  await page.goto('/');
  await page.getByTestId('nav-permissions').click();
  await expect(page.getByText(/Đồng bộ tự động mỗi phút/)).toBeVisible();
  await expect(page.getByText('hidden-completed · sheet')).toHaveCount(0);
  await expect(page.getByText('Nhân sự · Báo cáo Sheets')).toBeVisible();
  const before=reads;complete=true;
  await expect.poll(()=>reads,{timeout:20000}).toBeGreaterThan(before);
  await expect(page.getByText(/Không có tác vụ cần xử lý/)).toBeVisible();
  await expect(page.getByTestId('sync-backup-warning')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Xử lý hàng đợi',exact:true})).toHaveCount(0);
});

for (const role of ['ADMIN','MANAGER_L1','MANAGER_L2','USER']) test(`${role} dashboard counts the system and own department, refreshes with one Realtime channel and preserves totals on failure`,async({page})=>{
  const profile={...admin,id:'viewer',role,visibleTabs:['dashboard','violations','settings']};
  await authenticated(page,false,profile);
  const bus=await realtimeBus(page), errors:string[]=[],googleReads:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/api/google/'))googleReads.push(r.url());});
  let total=80,shift=27,fail=false,reads=0;
  await page.route('**/api/operations/dashboard/headcount',route=>{
    reads++;
    return route.fulfill(fail?{status:503,json:{error:'Tạm gián đoạn'}}:{json:{totalEmployees:total,activeEmployees:75,probationEmployees:5,shift:{name:profile.department,totalEmployees:shift}}});
  });
  await page.goto('/');
  const card=page.getByTestId('dashboard-headcount'),ca=page.getByTestId('dashboard-shift');
  await expect(card.getByText('80',{exact:true})).toBeVisible();
  await expect(ca).toContainText('27 người');await expect(ca).toContainText('Cơ cấu nhân sự theo bộ phận');
  await expect(ca).toContainText(profile.department);
  await expect(page.getByTestId('sync-backup-warning')).toHaveCount(0);
  await expect.poll(()=>bus.count('employees')).toBe(1);
  total=81;shift=28;bus.emit('employees');
  await expect(card.getByText('81',{exact:true})).toBeVisible();await expect(ca).toContainText('28 người');
  for (const width of [390,768,1366,1920]) {
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:`artifacts/screenshots/headcount-${role}-${width}.png`,fullPage:true});
  }
  fail=true;const before=reads;bus.emit('employees');
  await expect.poll(()=>reads).toBeGreaterThan(before);
  await expect(page.getByText(/Chưa cập nhật được số liệu nhân sự/)).toBeVisible();
  await expect(card.getByText('81',{exact:true})).toBeVisible();
  expect(bus.count('employees')).toBe(1);if(role!=='ADMIN')expect(googleReads).toEqual([]);expect(errors).toEqual([]);
});

test('Admin sees a localized backup warning with global counts and file confirmation guidance',async({page})=>{
  await authenticated(page);
  const summary={...emptySyncSummary,total:57,drive:7,sheet:50,waitingConfirmation:7,pending:48,failed:2};
  await page.route('**/api/google/jobs/summary',route=>route.fulfill({json:summary}));
  await page.route('**/api/google/jobs?*',route=>route.fulfill({json:{summary,items:[
    {job_id:'waiting-file',record_id:'import:waiting-file',module:'incidents',kind:'drive',status:'pending',stage:'waiting_confirmation',file_name:'Báo cáo kiểm thử.xlsx',created_at:'2026-09-28T00:00:00Z',attempts:0},
  ]}}));
  await page.setViewportSize({width:1366,height:1000});await page.goto('/');
  await expect(page.getByTestId('sync-backup-warning')).toContainText('Có 57 tác vụ');
  await page.getByRole('button',{name:'Xem hàng đợi sao lưu',exact:true}).click();
  const panel=page.getByRole('region',{name:'Đồng bộ Google',exact:true});
  await expect(panel.getByTestId('sync-backup-warning')).toContainText('Có 57 tác vụ');
  await expect(panel.getByText('Báo cáo kiểm thử.xlsx',{exact:true})).toBeVisible();
  await expect(panel.getByText('Chờ xác nhận dữ liệu',{exact:true})).toBeVisible();
  await expect(panel.getByText('pending',{exact:true})).toHaveCount(0);
  await expect(panel.getByText(/Mã bản ghi:/)).not.toBeVisible();
  await expect(panel.getByRole('button',{name:'Thử đồng bộ lại'})).toHaveCount(0);
  for(const width of [390,768,1366,1920]){
    await page.setViewportSize({width,height:1000});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await panel.screenshot({path:`artifacts/screenshots/backup-warning-${width}.png`});
  }
});

test('Original HICT logo renders when the deployment omits binary public assets', async ({page}) => {
  await page.route('**/brand/hict-logo.png', route => route.fulfill({status:404,body:'Not found'}));
  await page.goto('/');
  const artwork=page.locator('svg[aria-label="HICT — Saigon Newport"] image').first();
  await expect(artwork).toHaveAttribute('href',/^data:image\/png;base64,/);
  const source=await artwork.getAttribute('href');
  expect(createHash('sha256').update(Buffer.from(source!.split(',')[1],'base64')).digest('hex')).toBe('79ddc19566aa5111bc74bfbe596c2c24f4304580fd7210ece2c66e71135891d5');
  const size=await page.evaluate(async(src)=>{const img=new Image();img.src=src!;await img.decode();return [img.naturalWidth,img.naturalHeight];},source);
  expect(size).toEqual([4000,3000]);
});
async function authenticated(page: any, includeArchive = false, profile: any = admin) {
  await page.addInitScript(
    ({ user }) => {
      const encode = (x: any) => btoa(JSON.stringify(x));
      localStorage.setItem(
        "sb-unconfigured-auth-token",
        JSON.stringify({
          access_token:
            encode({ alg: "HS256" }) +
            "." +
            encode({
              sub: user.id,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }) +
            ".test",
          refresh_token: "test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: user.id,
            email: user.email,
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            created_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    },
    { user: profile },
  );
  await page.route("**/api/**", async (route: any) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/files/image-test/content') {
      await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
      return;
    }
    let body: any = { success: true };
    if (u.pathname === "/api/me") body = profile;
    else if (u.pathname === '/api/google/jobs/summary') body = emptySyncSummary;
    else if (u.pathname === '/api/operations/dashboard/headcount') body = {totalEmployees:1,activeEmployees:1,probationEmployees:0,shift:{name:profile.department,totalEmployees:1}};
    else if (u.pathname === "/api/google/import/preview")
      body = {
        job_id: "preview-test",
        status: "pending",
        checksum: "preview-hash",
        rows: [{ id: "example-record", fullName: "Bản ghi xem trước" }],
      };
    else if (u.pathname === "/api/google/sync")
      body = {
        success: true,
        message: "Đã xếp hàng báo cáo. Theo dõi kết quả tại Google Sync.",
      };
    else if (u.pathname === "/api/google/jobs")
      body = {summary:{...emptySyncSummary,total:1,sheet:1,failed:1},items:[
        {
          job_id: "job-1",
          kind: "sheet",
          module: "employees",
          record_id: "test-admin",
          status: "failed",
          attempts: 1,
          last_error: "Lỗi Google giả lập; dữ liệu DB vẫn giữ.",
          created_at: "2026-09-25T00:00:00Z",
        },
      ]};
    else if (u.pathname.startsWith("/api/records/")) {
      const module = u.pathname.split("/")[3];
      body = { items: module === "employees" ? [profile] : module === 'feedbacks' && includeArchive ? [{
        id:'feedback-1',title:'Ảnh đã lưu trữ',content:'Kiểm tra đọc ảnh riêng tư.',category:'DONG_GOP',categoryName:'Đóng góp',status:'APPROVED',
        authorId:admin.id,authorName:admin.fullName,authorDepartment:admin.department,submittedAt:'2026-09-25T00:00:00Z',
        isAnonymous:false,images:['https://drive.google.com/file/d/image-test/view'],
      }] : [], nextCursor: null };
    }
    await route.fulfill({ json: body });
  });
}
test('Question bank imports all 386 questions atomically, retains failed review and deletes folders without resurrection',async({page})=>{
  test.setTimeout(60000);
  await page.setViewportSize({width:1366,height:900});await authenticated(page);
  const bus=await realtimeBus(page), errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  let folders:any[]=[{id:'folder-test',name:'Bộ 386 câu',color:'indigo'}], questions:any[]=[], imports:any[]=[], puts=0,deletes=0;
  await page.route('**/api/records/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    if(path==='/api/records/questionFolders/folder-test' && req.method()==='DELETE'){
      deletes++;folders=[];questions=questions.map(q=>({...q,folderId:null}));return route.fulfill({json:{success:true}});
    }
    if(path.startsWith('/api/records/questionBank/') && req.method()==='PUT'){
      puts++;const saved=req.postDataJSON().data;questions=questions.map(q=>q.id===saved.id?saved:q);return route.fulfill({json:saved});
    }
    if(path==='/api/records/questionFolders')return route.fulfill({json:{items:folders,nextCursor:null}});
    if(path==='/api/records/questionBank'){
      const cursor=url.searchParams.get('cursor')||'',items=questions.filter(q=>q.id>cursor).sort((a,b)=>a.id.localeCompare(b.id));
      return route.fulfill({json:{items:items.slice(0,200),nextCursor:items.length>200?items[199].id:null}});
    }
    return route.fallback();
  });
  await page.route('**/api/operations/question-bank/import',async route=>{
    const payload=route.request().postDataJSON();imports.push(payload);
    if(imports.length===1)return route.fulfill({status:503,json:{error:'Giả lập chưa lưu được cả lô'}});
    questions=payload.questions.map((q:any,i:number)=>({...q,id:'q-'+String(i).padStart(4,'0'),folderId:payload.folderId}));
    return route.fulfill({json:{submitted:386,added:386,skipped:0,status:'success'}});
  });
  await page.goto('/');await page.getByTestId('nav-quiz').click();await page.getByRole('button',{name:'Ngân hàng câu hỏi',exact:true}).click();
  await page.getByRole('button',{name:'Nhập file & Tạo bằng AI',exact:true}).click();
  const book=XLSX.utils.book_new();
  for(const [name,start,count] of [['Một',0,21],['Hai',21,365]] as const)XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Câu hỏi','A','B','Đáp án đúng'],...Array.from({length:count},(_,i)=>['Câu kiểm thử '+(start+i),'Lựa chọn A','Lựa chọn B','B'])]),name);
  await page.locator('#ai-question-file-input').setInputFiles({name:'386-cau-kiem-thu.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(book,{type:'buffer',bookType:'xlsx'})});
  await page.getByRole('button',{name:'Đọc toàn bộ câu hỏi trong tệp',exact:true}).click();
    await expect(page.getByText('Xem lại & Điều chỉnh câu hỏi (386 câu)',{exact:true})).toBeVisible();
    for(const width of [390,768,1366,1920]){
      await page.setViewportSize({width,height:828});
      const dialog=page.getByRole('dialog',{name:'Nhập ngân hàng câu hỏi'}),scroll=page.getByTestId('question-import-scroll');
      await scroll.evaluate(e=>{e.scrollTop=e.scrollHeight;});
      const box=await dialog.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(828);
      expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
      await expect(dialog.getByRole('button',{name:/Xác nhận thêm/})).toBeInViewport();
      expect(await scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
      expect(await dialog.evaluate(e=>e.parentElement!.scrollHeight-e.parentElement!.clientHeight)).toBeLessThanOrEqual(1);
      await scroll.evaluate(e=>{e.scrollTop=0;});
    }
    await page.setViewportSize({width:1366,height:900});
  await page.getByRole('button',{name:/Xác nhận thêm/}).click();
  await expect(page.getByText('Giả lập chưa lưu được cả lô',{exact:true})).toBeVisible();
  expect(questions).toHaveLength(0);
  await page.getByRole('button',{name:/Xác nhận thêm/}).click();
  await expect(page.getByText('Đã lưu 386/386 câu; 0 câu trùng đã có trong thư mục.',{exact:true})).toBeVisible();
  expect(imports).toHaveLength(2);expect(imports[0].job_id).toBe(imports[1].job_id);expect(imports[1].questions).toHaveLength(386);
  await expect(page.getByPlaceholder('Nội dung câu hỏi...')).toHaveCount(386);
  await page.getByPlaceholder('Nội dung câu hỏi...').first().fill('Nội dung đã sửa, chưa lưu');
  expect(puts).toBe(0);
  await page.getByRole('button',{name:'Lưu câu hỏi',exact:true}).click();await expect.poll(()=>puts).toBe(1);
  page.once('dialog',dialog=>dialog.accept());await page.getByTitle('Xóa thư mục',{exact:true}).click();
  await expect(page.getByText('Đã xóa thư mục, giữ nguyên câu hỏi.',{exact:true})).toBeVisible();expect(deletes).toBe(1);
  bus.emit('questionFolders');bus.emit('questionBank');
  await expect(page.getByTitle('Xóa thư mục',{exact:true})).toHaveCount(0);
  await page.reload();await page.getByTestId('nav-quiz').click();await page.getByRole('button',{name:'Ngân hàng câu hỏi',exact:true}).click();
  await expect(page.getByPlaceholder('Nội dung câu hỏi...')).toHaveCount(386);
  await expect(page.getByTitle('Xóa thư mục',{exact:true})).toHaveCount(0);expect(errors).toEqual([]);
  await page.screenshot({path:'artifacts/screenshots/question-bank-386-local.png'});
});

test('Actual question workbook preserves all 383 rows in preview and retains 10 unresolved answers',async({page})=>{
  test.skip(!process.env.RTG_QUESTION_IMPORT_FILE,'User workbook is local only and never committed.');
  await page.setViewportSize({width:1366,height:900});await authenticated(page);
  let selected:any[]=[];
  await page.route('**/api/operations/question-bank/import',route=>{
    selected=route.request().postDataJSON().questions;
    return route.fulfill({json:{submitted:373,added:367,skipped:6,status:'success'}});
  });
  await page.goto('/');await page.getByTestId('nav-quiz').click();await page.getByRole('button',{name:'Ngân hàng câu hỏi',exact:true}).click();
  await page.getByRole('button',{name:'Nhập file & Tạo bằng AI',exact:true}).click();
  await page.locator('#ai-question-file-input').setInputFiles(process.env.RTG_QUESTION_IMPORT_FILE!);
  await page.getByRole('button',{name:'Đọc toàn bộ câu hỏi trong tệp',exact:true}).click();
  await expect(page.getByText('Xem lại & Điều chỉnh câu hỏi (383 câu)',{exact:true})).toBeVisible();
  await expect(page.getByText('Cần kiểm tra 10 vị trí trong tệp',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Chỉ chọn câu có đáp án hợp lệ',exact:true}).click();
  await page.getByRole('button',{name:/Xác nhận thêm \(373\)/}).click();
  await expect(page.getByText('Xem lại & Điều chỉnh câu hỏi (10 câu)',{exact:true})).toBeVisible();
  await expect(page.getByText('Đã lưu 367 câu mới; bỏ qua 6 câu trùng. Còn 10 câu chưa lưu được giữ ở đây để rà soát.',{exact:true})).toBeVisible();
  expect(selected).toHaveLength(373);expect(selected.every(q=>q.options.some((o:any)=>o.id===q.correctOptionId))).toBe(true);
});

test('One active user can focus repeatedly without request storms; temporary profile errors keep the session',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await authenticated(page);
  const bus=await realtimeBus(page);
  let profileReads=0,sessionWrites=0,recordReads=0,failProfile=false;
  page.on('request',req=>{const path=new URL(req.url()).pathname;if(path==='/api/session')sessionWrites++;if(path.startsWith('/api/records/'))recordReads++;});
  await page.route('**/api/me',route=>{
    profileReads++;
    return failProfile ? route.fulfill({status:503,json:{error:'Tạm thời bận'}}) : route.fulfill({json:admin});
  });
  await page.goto('/');
  await expect(page.getByTestId('nav-dashboard')).toBeVisible();
  await expect.poll(()=>bus.count('settings')).toBe(1);
  await expect.poll(()=>recordReads).toBeGreaterThanOrEqual(12);
  await page.waitForTimeout(3500);
  const before={profileReads,recordReads,sessionWrites};
  for(let i=0;i<10;i++){
    await page.evaluate(()=>{for(let j=0;j<10;j++)window.dispatchEvent(new Event('focus'));});
    await page.waitForTimeout(200);
  }
  expect(profileReads-before.profileReads).toBeLessThanOrEqual(1);
  expect(recordReads-before.recordReads).toBe(0);
  expect(sessionWrites-before.sessionWrites).toBe(0);
  failProfile=true;
  // A temporary failure on a profile refresh must not render the login screen.
  await page.clock.install();await page.clock.fastForward(31000);
  const previous=profileReads;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect.poll(()=>profileReads).toBeGreaterThan(previous);
  await expect(page.getByTestId('nav-dashboard')).toBeVisible();
  await expect(page.getByRole('button',{name:'Đăng nhập hệ thống',exact:true})).toHaveCount(0);
});

test('Realtime read 429 retains visible data and recovers after Retry-After',async({page})=>{
  await page.setViewportSize({width:1366,height:900});
  await authenticated(page);
  const bus=await realtimeBus(page);
  let limited=false,failures=0,title='Nội dung trước giới hạn';
  await page.route('**/api/records/settings?*',route=>{
    if(limited && failures++===0)return route.fulfill({status:429,headers:{'Retry-After':'1'},json:{error:'Tài khoản gửi quá nhiều yêu cầu. Vui lòng thử lại sau một phút.'}});
    return route.fulfill({json:{items:[{id:'global',announcementTitle:title}],nextCursor:null}});
  });
  await page.goto('/');await expect(page.getByText(title,{exact:true})).toBeVisible();
  await expect.poll(()=>bus.count('settings')).toBe(1);
  limited=true;title='Dữ liệu đã tự khôi phục';bus.emit('settings');
  await expect(page.getByText(/Đang tạm giãn tải dữ liệu/)).toBeVisible({timeout:10000});
  await expect(page.getByTestId('nav-dashboard')).toBeVisible();
  await expect(page.getByText(title,{exact:true})).toBeVisible({timeout:10000});
  await expect(page.getByRole('button',{name:'Đăng nhập hệ thống',exact:true})).toHaveCount(0);
});
for (const width of [390, 768, 1366, 1920]) {
  test(`login and authenticated modules at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByText("Tên đăng nhập", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
    await page.screenshot({
      path: `artifacts/screenshots/login-${width}.png`,
      fullPage: true,
    });
    await authenticated(page);
    await page.reload();
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({
      path: `artifacts/screenshots/dashboard-${width}.png`,
      fullPage: true,
    });
    for (const module of ["hr", "permissions", "zalo"]) {
      if (width < 1024)
        await page
          .getByRole("button", { name: "Mở menu", exact: true })
          .click();
      await page.getByTestId("nav-" + module).click();
      await expect(page.locator("main")).toBeVisible();
      await page.screenshot({
        path: `artifacts/screenshots/${module}-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
test("module navigation renders without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1366, height: 1000 });
  await authenticated(page);
  await page.goto("/");
  await expect(page.getByText("Quản trị kiểm thử").first()).toBeVisible();
  const ids = await page
    .locator('[data-testid^="nav-"]')
    .evaluateAll((items) => items.map((x) => x.getAttribute("data-testid")!));
  expect(ids.length).toBeGreaterThan(10);
  for (const id of ids) {
    await page.getByTestId(id).click();
    await expect(page.locator("main")).toBeVisible();
    await expect(
      page.getByText("Không thể hiển thị phân hệ", { exact: true }),
    ).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "artifacts/screenshots/modules-1366.png",
    fullPage: true,
  });
});

for (const module of ["hr", "violations"]) {
  test(`${module}: Google import previews before confirm and sync reports queued status`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await authenticated(page);
    const writes: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST") writes.push(new URL(req.url()).pathname);
    });
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("/");
    await page.getByRole("button", { name: "Mở menu", exact: true }).click();
    await page.getByTestId("nav-" + module).click();
    await page
      .getByRole("button", { name: /Tiện ích & Tác vụ/ })
      .first()
      .click();
    if (module === "hr")
      await page
        .getByRole("button", { name: /4\. Nhập Báo Cáo Google/ })
        .click();
    else
      await page
        .getByRole("button", { name: "Nhập & xuất báo cáo Google" })
        .click();
    await page
      .getByRole("button", { name: "Preview Google Sheets", exact: true })
      .click();
    await expect(
      page.getByText("Bản ghi xem trước", { exact: false }),
    ).toBeVisible();
    expect(
      writes.some(
        (path) => path.endsWith("/confirm") || path.includes("/records/"),
      ),
    ).toBe(false);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Confirm Import", exact: true })
      .click();
    await expect(
      page.getByText("Đã nhập dữ liệu vào PostgreSQL.", { exact: true }),
    ).toBeVisible();
    expect(writes.filter((path) => path.endsWith("/confirm"))).toHaveLength(1);
    await page
      .getByRole("button", { name: "Xếp hàng đồng bộ", exact: true })
      .click();
    await expect(
      page.getByText("Đã xếp hàng báo cáo. Theo dõi kết quả tại Google Sync.", {
        exact: true,
      }),
    ).toBeVisible();
  });
}

test('Archived feedback images load through the authenticated API',async({page})=>{
  await authenticated(page,true);
  const requestImage=page.waitForRequest('**/api/files/image-test/content');
  await page.goto('/');
  await page.getByTestId('nav-feedback').click();
  const req=await requestImage;
  expect(req.headers()['authorization']).toMatch(/^Bearer /);
  const img=page.getByAltText('Ảnh đính kèm',{exact:true}).first();
  await expect(img).toHaveAttribute('src',/^blob:/);
  await expect.poll(()=>img.evaluate((node:HTMLImageElement)=>node.naturalWidth)).toBeGreaterThan(0);
});

test('Quiz assignment waits for saved quiz, keeps errors visible, and blocks repeated clicks', async ({page}) => {
  await authenticated(page);
  const errors:string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const people = Array.from({length:76}, (_,i) => ({...admin,id:'employee-'+i,role:'USER'}));
  let savedQuiz:any;
  let saveCalls = 0, assignCalls = 0;
  let releaseAssign!: () => void;
  const gate = new Promise<void>(resolve => {releaseAssign=resolve;});
  await page.route('**/api/records/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/api/records/quizzes/') && route.request().method() === 'PUT') {
      saveCalls++;
      if (saveCalls === 1) return route.fulfill({status:503,json:{error:'Lưu đề thất bại giả lập'}});
      savedQuiz = route.request().postDataJSON().data;
      return route.fulfill({json:savedQuiz});
    }
    if (path === '/api/records/employees') return route.fulfill({json:{items:people,nextCursor:null}});
    if (path === '/api/records/questionBank') return route.fulfill({json:{items:[{
      id:'question-1',question:'Câu hỏi kiểm thử',options:[{id:'a',text:'Đáp án A'},{id:'b',text:'Đáp án B'}],correctOptionId:'a',explanation:'Giải thích',
    }],nextCursor:null}});
    if (path === '/api/records/quizzes') return route.fulfill({json:{items:savedQuiz?[savedQuiz]:[],nextCursor:null}});
    return route.fallback();
  });
  await page.route('**/api/exams/*/assign', async route => {
    assignCalls++;
    expect(savedQuiz).toBeTruthy();
    expect(route.request().postDataJSON().recipientIds).toHaveLength(76);
    if (assignCalls === 1) return route.fulfill({status:503,json:{error:'Giao bài thất bại giả lập'}});
    await gate;
    return route.fulfill({json:{sentCount:76,alreadyAssignedCount:0,messages:[]}});
  });
  await page.goto('/');
  await page.getByTestId('nav-quiz').click();
  await page.getByRole('button',{name:'+ Ra đề thi mới',exact:true}).click();
  await page.locator('form input[type="text"]').first().fill('Bài kiểm tra 76 người');
  await page.getByRole('button',{name:/Chọn tất cả/}).click();
  await page.getByRole('button',{name:'Lưu & Giao bài',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Lưu đề thất bại giả lập');
  await expect(page.getByRole('heading',{name:'Giao bài & Thông báo',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Lưu & Giao bài',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Giao bài & Thông báo',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Giao bài & Gửi thông báo',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Giao bài thất bại giả lập');
  await page.getByRole('button',{name:'Giao bài & Gửi thông báo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Đang giao bài...',exact:true})).toBeDisabled();
  expect(assignCalls).toBe(2);
  releaseAssign();
  await expect(page.getByRole('heading',{name:'Giao bài & Thông báo',exact:true})).toHaveCount(0);
  await expect(page.getByText('Đã gửi 76 thông báo giao bài trong app.',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('Legacy ranking preview excludes default a but retains proposed A', async ({page}) => {
  await authenticated(page);
  await page.route('**/api/records/bxxlRecords*', route => route.fulfill({json:{items:[{
    id:'ranking-old',companyName:'RTG',departmentName:'Đội Cơ giới',groupName:'Tổ RTG',
    evaluationMonth:'09/2026',createdCity:'Hải Phòng',createdDate:'25',createdMonth:'09',createdYear:'2026',
    selectedCategories:['A'],includeGpt:false,includeDefaultSmallAInDoc:true,
    listA:[{employeeId:'a',employeeCode:'A',fullName:'Nhân viên đề xuất A'}],
    listSmallA:[{employeeId:'default',employeeCode:'DEFAULT',fullName:'Nhân viên mặc định a'}],
    listB:[],listSmallB:[],listC:[],listGpt:[],createdAt:'2026-09-25T00:00:00Z',
  }],nextCursor:null}}));
  await page.goto('/');
  await page.getByTestId('nav-bxxl').click();
  await page.getByRole('button',{name:/Lịch sử biên bản/}).click();
  await page.getByRole('button',{name:'Xem A4',exact:true}).click();
  await expect(page.getByText('Nhân viên đề xuất A',{exact:true})).toBeVisible();
  await expect(page.getByText('Nhân viên mặc định a',{exact:true})).toHaveCount(0);
});

test('Internal notification keeps draft and job ID on failure, then displays the saved inbox message', async ({page}) => {
  await authenticated(page);
  const sends:any[]=[];
  await page.route('**/api/internal-notifications/preview',route=>route.fulfill({json:{checksum:'same-preview'}}));
  await page.route('**/api/internal-notifications/send',async route=>{
    const input=route.request().postDataJSON();sends.push(input);
    if(sends.length===1)return route.fulfill({status:503,json:{error:'Lưu thông báo thất bại giả lập'}});
    await route.fulfill({json:{...input,id:'internal-'+input.jobId,senderId:admin.id,sentBy:admin.fullName,
      channel:'IN_APP',status:'DELIVERED',sentAt:new Date().toISOString(),recipientNames:[admin.fullName],readByIds:[admin.id]}});
  });
  await page.goto('/');
  await page.getByTestId('nav-zalo').click();
  const content=page.locator('form textarea');
  await content.fill('Thông báo kiểm thử nội bộ');
  const send=page.getByRole('button',{name:'Phát Thông Báo Nội Bộ Ngay',exact:true});
  await send.click();
  await expect(page.getByRole('alert')).toContainText('Lưu thông báo thất bại giả lập');
  await expect(content).toHaveValue('Thông báo kiểm thử nội bộ');
  await send.click();
  await expect(page.getByText('Đã phát thông báo nội bộ tới Quản trị kiểm thử',{exact:true})).toBeVisible();
  expect(sends).toHaveLength(2);
  expect(sends[0].jobId).toBe(sends[1].jobId);
  expect(sends[1].recipientIds).toEqual([admin.id]);
  await expect(page.getByText('Thông báo kiểm thử nội bộ',{exact:true}).first()).toBeVisible();
});

for (const width of [390,1366]) {
  test(`Admin credential controls mask new password and preserve retry at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    await authenticated(page);
    await page.route('**/api/admin/accounts/test-admin',route=>route.fulfill({json:{linked:false,configured:true,username:'test001',must_change_password:false}}));
    const writes:any[]=[];
    await page.route('**/api/admin/accounts/test-admin/password',async route=>{
      writes.push(route.request().postDataJSON());
      if(writes.length===1) return route.fulfill({status:503,json:{error:'Lỗi kết nối thử nghiệm'}});
      return route.fulfill({json:{success:true}});
    });
    await page.goto('/');
    if(width<1024) await page.getByRole('button',{name:'Mở menu',exact:true}).click();
    await page.getByTestId('nav-hr').click();
    await page.locator('button[title="Sửa hồ sơ"]:visible,button[title="Sửa thông tin"]:visible').first().click();
    const field=page.getByLabel('Mật khẩu ban đầu',{exact:true});
    await expect(field).toHaveValue('123456');
    await expect(field).toHaveAttribute('type','password');
    await page.getByRole('button',{name:'Hiện mật khẩu mới',exact:true}).click();
    await expect(field).toHaveAttribute('type','text');
    await page.getByRole('button',{name:'Cấp tài khoản',exact:true}).click();
    await expect(field).toHaveAttribute('type','password');
    await page.getByRole('button',{name:'Xác nhận lưu mật khẩu',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('Lỗi kết nối thử nghiệm');
    await page.getByRole('button',{name:'Xác nhận lưu mật khẩu',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('Đã lưu mật khẩu mới');
    await expect(page.getByLabel('Đặt mật khẩu mới',{exact:true})).toHaveValue('');
    expect(writes).toHaveLength(2);
    expect(writes[0].job_id).toBe(writes[1].job_id);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.screenshot({path:`artifacts/screenshots/account-admin-${width}.png`,fullPage:true});
  });
}

test('HR manager cannot see another account password controls', async ({page})=>{
  await authenticated(page,false,{...admin,role:'MANAGER',assignedPermissions:['MANAGE_HR','MANAGE_PERMISSIONS'],visibleTabs:['dashboard','hr']});
  const credentialReads:string[]=[];
  page.on('request',req=>{if(req.url().includes('/api/admin/accounts/'))credentialReads.push(req.url());});
  await page.setViewportSize({width:1366,height:1000});
  await page.goto('/');
  await page.getByTestId('nav-hr').click();
  await page.locator('button[title="Sửa hồ sơ"]:visible,button[title="Sửa thông tin"]:visible').first().click();
  await expect(page.getByRole('region',{name:'Tài khoản đăng nhập'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Hiện mật khẩu mới'})).toHaveCount(0);
  expect(credentialReads).toHaveLength(0);
});

test('First password gate prevents business reads before change',async({page})=>{
  await authenticated(page,false,{...admin,role:'USER',requiresCredentialChange:true});
  const reads:string[]=[];
  page.on('request',req=>{if(req.url().includes('/api/records/'))reads.push(req.url());});
  await page.setViewportSize({width:390,height:1000});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Đổi mật khẩu ban đầu',exact:true})).toBeVisible();
  await expect(page.getByTestId('nav-hr')).toHaveCount(0);
  expect(reads).toHaveLength(0);
  await page.screenshot({path:'artifacts/screenshots/first-password-390.png',fullPage:true});
});
