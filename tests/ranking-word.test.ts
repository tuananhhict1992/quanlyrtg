import test from "node:test";
import assert from "node:assert/strict";
import { generateBxxlHtml } from "../src/services/bxxlTemplate";

test("Word and print exclude default a even on legacy records without changing profile data", () => {
  const person = (name:string) => ({employeeId:name,employeeCode:name,fullName:name,reason:'Lý do hợp lệ'});
  const record:any = {
    id:'legacy',evaluationMonth:'09/2026',createdDate:'25',createdMonth:'09',createdYear:'2026',
    departmentName:'Đội Cơ giới',groupName:'Tổ RTG',selectedCategories:['A','B','b','C','GPT'],
    listA:[person('Nhân viên loại A')],listSmallA:[person('Nhân viên mặc định')],
    listB:[person('Nhân viên loại B')],listSmallB:[person('Nhân viên loại b')],
    listC:[person('Nhân viên loại C')],listGpt:[person('Nhân viên GPT')],
    includeDefaultSmallAInDoc:true,includeGpt:true,meetingAttendees:[],
  };
  const original = structuredClone(record);
  for (const forWord of [true,false]) {
    const html = generateBxxlHtml(record,forWord);
    assert.ok(!html.includes('Nhân viên mặc định'));
    assert.ok(!html.includes('XẾP LOẠI “a”'));
    for (const name of ['Nhân viên loại A','Nhân viên loại B','Nhân viên loại b','Nhân viên loại C','Nhân viên GPT'])
      assert.ok(html.includes(name), name);
  }
  assert.deepEqual(record,original);
});
