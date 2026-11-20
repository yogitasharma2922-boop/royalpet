process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = "test-secret";

const request = require("supertest");
const app = require("../src/app");
const db = require("../src/db/knex");

const tokens = {};
const login = async (email, password) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token;
};
const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });
const sync = (role, changes) => request(app).put("/api/sync").set(auth(role)).send({ changes });
const bootstrap = async (role) => (await request(app).get("/api/bootstrap").set(auth(role))).body.data;

beforeAll(async () => {
  await db.migrate.latest();
  await db.seed.run();
  tokens.admin = await login("admin@royalpet.in", "admin123");
  tokens.doctor = await login("doctor@royalpet.in", "doctor123");
});
afterAll(async () => { await db.destroy(); });

describe("Backup and restore", () => {
  let backupId;

  it("only admin can use backup endpoints", async () => {
    for (const role of ["doctor"]) {
      expect((await request(app).get("/api/admin/backups").set(auth(role))).status).toBe(403);
      expect((await request(app).post("/api/admin/backups").set(auth(role)).send({})).status).toBe(403);
      expect((await request(app).get("/api/admin/backups/download").set(auth(role))).status).toBe(403);
      expect((await request(app).post("/api/admin/backups/restore-upload").set(auth(role)).send({ snapshot: {} })).status).toBe(403);
    }
  });

  it("backs up every clinic table, including suppliers and planner tasks", async () => {
    await sync("doctor", {
      owners: { upsert: [{ id: 70, name: "Backup Owner", mobile: "9000000070" }] },
      pets: { upsert: [{ id: 70, name: "Milo", type: "Cat", ownerId: 70, alerts: ["Shy"] }] },
      supplier_payments: { upsert: [{ id: 70, vendor: "VetCo", item: "Gloves", qty: 2, unitPrice: 50, total: 100, date: "2026-11-20", status: "paid" }] },
      planner_tasks: { upsert: [{ id: 70, time: "09:00", title: "Order stock", date: "2026-11-20", done: false }] },
    });
    const res = await request(app).post("/api/admin/backups").set(auth("admin")).send({ label: "before-change" });
    expect(res.status).toBe(201);
    backupId = res.body.data.id;
    const rec = await db("backup_logs").where({ id: backupId }).first();
    const snap = JSON.parse(rec.snapshot);
    expect(snap.supplier_payments.some((r) => r.id === 70)).toBe(true);
    expect(snap.planner_tasks.some((r) => r.id === 70)).toBe(true);
  });

  it("restores the saved data, undoing later changes, and keeps a safety copy", async () => {
    const changed = await sync("admin", {
      pets: { upsert: [{ id: 71, name: "Added After", type: "Dog", ownerId: 70 }], remove: [70] },
      supplier_payments: { remove: [70] },
    });
    expect(changed.status).toBe(200);
    let data = await bootstrap("doctor");
    expect(data.pets.some((p) => p.id === 70)).toBe(false);

    const res = await request(app).post(`/api/admin/backups/${backupId}/restore`).set(auth("admin"));
    expect(res.status).toBe(200);
    expect(res.body.data.safetyBackupId).toBeTruthy();

    data = await bootstrap("doctor");
    expect(data.pets.find((p) => p.id === 70).alerts).toEqual(["Shy"]);
    expect(data.pets.some((p) => p.id === 71)).toBe(false);
    expect(data.supplierPayments.some((p) => p.id === 70)).toBe(true);
    expect(data.tasks.some((t) => t.id === 70)).toBe(true);

    // the safety copy still holds the state from just before the restore
    const safety = await db("backup_logs").where({ id: res.body.data.safetyBackupId }).first();
    expect(safety.trigger).toBe("pre-restore");
    expect(JSON.parse(safety.snapshot).pets.some((p) => p.id === 71)).toBe(true);

    // login and new ids still work after restoring
    expect((await request(app).post("/api/auth/login").send({ email: "admin@royalpet.in", password: "admin123" })).status).toBe(200);
  });

  it("downloads a file and restores from the same file", async () => {
    const dl = await request(app).get("/api/admin/backups/download").set(auth("admin"));
    expect(dl.status).toBe(200);
    const file = JSON.parse(dl.text);
    expect(file.snapshot.pets.some((p) => p.id === 70)).toBe(true);

    expect((await sync("admin", { owners: { remove: [70] } })).status).toBe(200);
    const res = await request(app).post("/api/admin/backups/restore-upload").set(auth("admin")).send(file);
    expect(res.status).toBe(200);
    expect((await bootstrap("doctor")).owners.some((o) => o.id === 70)).toBe(true);

    const one = await request(app).get(`/api/admin/backups/${backupId}/download`).set(auth("admin"));
    expect(one.status).toBe(200);
    expect(JSON.parse(one.text).snapshot.owners.length).toBeGreaterThan(0);
  });

  it("rejects bad or dangerous files without touching the data", async () => {
    const before = (await bootstrap("doctor")).pets.length;
    const bad = [
      { snapshot: "nope" },
      { snapshot: { pets: "not a list" } },
      { snapshot: { users: [{ id: 9, role: "doctor", active: true }] } },
      { snapshot: { pets: [], users: [] } },
    ];
    for (const body of bad) {
      const res = await request(app).post("/api/admin/backups/restore-upload").set(auth("admin")).send(body);
      expect(res.status).toBe(400);
    }
    expect((await bootstrap("doctor")).pets.length).toBe(before);
    expect((await request(app).post("/api/admin/backups/99999/restore").set(auth("admin"))).status).toBe(404);
  });
});
