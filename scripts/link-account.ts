import { parseArgs } from "node:util";
import { pool, transaction } from "../backend/db";
import { checksum } from "../backend/security";
import { audit } from "../backend/records";
const { values } = parseArgs({
  options: {
    "auth-user-id": { type: "string" },
    "employee-id": { type: "string" },
    "bootstrap-admin": { type: "boolean" },
    name: { type: "string" },
  },
});
if (!values["auth-user-id"] || !values["employee-id"])
  throw new Error(
    'Required: --auth-user-id UUID --employee-id ID; optionally --bootstrap-admin --name "Full name"',
  );
try {
  await transaction(async (db) => {
    const authUser = (
      await db.query("select id,email from auth.users where id=$1", [
        values["auth-user-id"],
      ])
    ).rows[0];
    if (!authUser)
      throw new Error("Create the account in Supabase Auth first.");
    const existing = (
      await db.query(
        "select data from private.records where module='employees' and id=$1",
        [values["employee-id"]],
      )
    ).rows[0];
    if (values["bootstrap-admin"]) {
      if (
        (
          await db.query(
            "select 1 from private.records where module='employees' and data->>'role'='ADMIN' limit 1",
          )
        ).rows.length
      )
        throw new Error(
          "An admin already exists. Use the app to manage roles.",
        );
      const data = {
        id: values["employee-id"],
        employeeCode: values["employee-id"],
        email: authUser.email,
        fullName: values.name || "RTG Admin",
        role: "ADMIN",
        status: "ACTIVE",
        department: "RTG ca 1",
        position: "Quản trị",
        phone: "",
        zaloPhone: "",
        avatar: "",
        assignedPermissions: [],
        visibleTabs: [],
        onboardingCompleted: true,
        joinDate: new Date().toISOString().slice(0, 10),
        competencyScore: 0,
        quizzesCompleted: 0,
        violationCount: 0,
        proposalsCount: 0,
      };
      await db.query(
        "insert into private.records(module,id,data,owner_id,checksum) values('employees',$1,$2,$1,$3) on conflict(module,id) do update set data=excluded.data,checksum=excluded.checksum",
        [data.id, JSON.stringify(data), checksum(data)],
      );
    } else if (!existing)
      throw new Error("Create/import the employee profile first.");
    else if (
      existing.data.email?.toLowerCase() !== authUser.email?.toLowerCase()
    )
      throw new Error("Supabase Auth email must match the employee email.");
    await db.query(
      "insert into private.accounts(auth_user_id,employee_id) values($1,$2)",
      [authUser.id, values["employee-id"]],
    );
    await audit(
      db,
      "server-administrator",
      "account.link",
      "employees",
      values["employee-id"],
    );
    console.log("Linked account successfully.");
  });
} finally {
  await pool.end();
}
