import { test, expect } from "@playwright/test";
const admin = {
  id: "test-admin",
  fullName: "Quản trị kiểm thử",
  employeeCode: "TEST001",
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
async function authenticated(page: any, includeArchive = false) {
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
    { user: admin },
  );
  await page.route("**/api/**", async (route: any) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/files/image-test/content') {
      await route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
      return;
    }
    let body: any = { success: true };
    if (u.pathname === "/api/me") body = admin;
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
      body = [
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
      ];
    else if (u.pathname.startsWith("/api/records/")) {
      const module = u.pathname.split("/")[3];
      body = { items: module === "employees" ? [admin] : module === 'feedbacks' && includeArchive ? [{
        id:'feedback-1',title:'Ảnh đã lưu trữ',content:'Kiểm tra đọc ảnh riêng tư.',category:'DONG_GOP',categoryName:'Đóng góp',status:'APPROVED',
        authorId:admin.id,authorName:admin.fullName,authorDepartment:admin.department,submittedAt:'2026-09-25T00:00:00Z',
        isAnonymous:false,images:['https://drive.google.com/file/d/image-test/view'],
      }] : [], nextCursor: null };
    }
    await route.fulfill({ json: body });
  });
}
for (const width of [390, 768, 1366, 1920]) {
  test(`login and authenticated modules at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByText("Email đăng nhập", { exact: true }),
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
    for (const module of ["hr", "permissions"]) {
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
  await expect(page.getByText('Đã gửi 76 thông báo giao bài.',{exact:true})).toBeVisible();
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
