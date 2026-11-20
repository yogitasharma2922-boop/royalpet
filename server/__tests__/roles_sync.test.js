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
  tokens.receptionist = await login("reception@royalpet.in", "recep123");
  tokens.owner = await login("owner@royalpet.in", "owner123");
});
afterAll(async () => { await db.destroy(); });

describe("Persistence through delta sync", () => {
  it("stores arrays, long text, empty strings and settings extras permanently", async () => {
    const longDx = "Chronic dermatitis. ".repeat(40);
    const res = await sync("doctor", {
      owners: { upsert: [{ id: 50, name: "Sync Owner", mobile: "9000000050", email: "", address: "x".repeat(400) }] },
      pets: { upsert: [{ id: 50, name: "Rex", type: "Dog", dob: "", weight: "", ownerId: 50, photo: "🐕", alerts: ["Allergic to Penicillin"], color: "#fff" }] },
      visits: { upsert: [{ id: 50, petId: 50, caseNum: "RPC-T-001", date: "2026-11-20", status: "consulting", reason: "Itching", temp: "", weight: "", diagnosis: longDx, notes: "n", doctorId: 1, source: "owner-portal" }] },
      prescriptions: { upsert: [{ id: 50, visitId: 50, medicines: [{ name: "Cetirizine", dose: "1" }] }] },
      invoices: { upsert: [{ id: 50, visitId: 50, petId: 50, ownerId: 50, date: "2026-11-20", items: [{ name: "Consultation", qty: 1, amt: 500 }], total: 500, status: "paid", method: "UPI", notes: "ok" }] },
      vaccinations: { upsert: [{ id: 50, petId: 50, vaccine: "Rabies", given: "2026-11-20", next: "2027-11-20", batch: "", status: "ok", notes: "lot 7" }] },
      supplier_payments: { upsert: [{ id: 50, vendor: "BioVet", item: "Rabies x10", qty: 10, unitPrice: 300, total: 3000, date: "2026-11-20", status: "pending", notes: "" }] },
      planner_tasks: { upsert: [{ id: 50, time: "10:00", title: "Call owner", notes: "", date: "2026-11-20", done: false }] },
    });
    expect(res.status).toBe(200);

    const data = await bootstrap("doctor");
    const pet = data.pets.find((p) => p.id === 50);
    expect(pet.alerts).toEqual(["Allergic to Penicillin"]);
    expect(pet.dob).toBeNull();
    expect(data.visits.find((v) => v.id === 50).diagnosis).toBe(longDx);
    expect(data.visits.find((v) => v.id === 50).source).toBe("owner-portal");
    expect(data.prescriptions.find((p) => p.id === 50).medicines[0].name).toBe("Cetirizine");
    expect(data.invoices.find((i) => i.id === 50).items[0].amt).toBe(500);
    expect(data.vaccinations.find((v) => v.id === 50).notes).toBe("lot 7");
    expect(data.supplierPayments.find((p) => p.id === 50).total).toBe(3000);
    expect(data.tasks.find((t) => t.id === 50).title).toBe("Call owner");
    expect(data.vaccinations.find((v) => v.id === 50).given).toBe("2026-11-20");
  });

  it("keeps all settings fields for admin", async () => {
    const res = await sync("admin", { clinic_settings: { upsert: [{ id: 1, name: "Royal Pet Clinic", currency: "₹", consultFee: 600, signature: "Dr. X", reminderVaccDays: 9, paymentMethods: ["Cash", "UPI"] }] } });
    expect(res.status).toBe(200);
    const s = (await bootstrap("admin")).clinicSettings;
    expect(s.consultFee).toBe(600);
    expect(s.signature).toBe("Dr. X");
    expect(s.reminderVaccDays).toBe(9);
    expect(s.paymentMethods).toEqual(["Cash", "UPI"]);
  });

  it("deletes only the ids listed and ignores missing parents safely", async () => {
    const res = await sync("doctor", {
      vaccinations: { upsert: [{ id: 51, petId: 9999, vaccine: "Orphan", given: "2026-11-20" }], remove: [50] },
    });
    expect(res.status).toBe(200);
    const data = await bootstrap("doctor");
    expect(data.vaccinations.find((v) => v.id === 50)).toBeUndefined();
    expect(data.vaccinations.find((v) => v.id === 51).petId).toBeNull();
    expect(data.pets.find((p) => p.id === 50)).toBeDefined();
  });

  it("new rows from the API still work after explicit-id sync (sequence reset)", async () => {
    const res = await request(app).post("/api/appointments").set(auth("receptionist"))
      .send({ petId: 50, ownerId: 50, date: "2026-11-21", time: "11:00", type: "Checkup", status: "confirmed" });
    expect(res.status).toBe(201);
  });
});

describe("Role isolation", () => {
  it("receptionist never receives clinical data", async () => {
    const data = await bootstrap("receptionist");
    expect(data.prescriptions).toEqual([]);
    expect(data.invoices).toEqual([]);
    expect(data.inventory).toEqual([]);
    expect(data.vaccinations).toEqual([]);
    expect(data.supplierPayments).toEqual([]);
    expect(data.activityLog).toEqual([]);
    const visit = data.visits.find((v) => v.id === 50);
    expect(visit).toBeDefined();
    expect(visit.diagnosis).toBeUndefined();
    expect(visit.notes).toBeUndefined();
    expect(visit.inventoryDeducted).toBeUndefined();
    expect(data.users.every((u) => !("email" in u) && !("mobile" in u))).toBe(true);
    expect(data.clinicSettings.consultFee).toBeUndefined();
  });

  it("receptionist is blocked from clinical endpoints", async () => {
    for (const path of ["/api/prescriptions", "/api/invoices", "/api/inventory", "/api/vaccinations", "/api/treatments", "/api/users", "/api/admin/backups", "/api/db", "/api/supplier_payments"]) {
      const res = await request(app).get(path).set(auth("receptionist"));
      expect([401, 403]).toContain(res.status);
    }
  });

  it("receptionist cannot write clinical tables or clinical visit fields", async () => {
    const bad = await sync("receptionist", { prescriptions: { upsert: [{ id: 77, visitId: 50, medicines: [] }] } });
    expect(bad.status).toBe(403);
    const bad2 = await sync("receptionist", { invoices: { remove: [50] } });
    expect(bad2.status).toBe(403);

    const ok = await sync("receptionist", { visits: { upsert: [{ id: 50, petId: 50, status: "waiting", diagnosis: "HACKED", notes: "HACKED" }] } });
    expect(ok.status).toBe(200);
    const visit = (await bootstrap("doctor")).visits.find((v) => v.id === 50);
    expect(visit.status).toBe("waiting");
    expect(visit.diagnosis).not.toBe("HACKED");
    expect(visit.notes).toBe("n");
  });

  it("doctor cannot see users' contact info, admin data, backups or change settings", async () => {
    const data = await bootstrap("doctor");
    expect(data.users.every((u) => !("email" in u))).toBe(true);
    expect(data.activityLog).toEqual([]);
    for (const path of ["/api/users", "/api/admin/backups", "/api/db", "/api/activity_log"]) {
      const res = await request(app).get(path).set(auth("doctor"));
      expect([401, 403]).toContain(res.status);
    }
    const res = await sync("doctor", { clinic_settings: { upsert: [{ id: 1, name: "Hijacked" }] } });
    expect(res.status).toBe(403);
    const dRes = await request(app).delete("/api/owners/50").set(auth("doctor"));
    expect([403, 404]).toContain(dRes.status);
  });

  it("owner cannot use staff sync and sees only own records", async () => {
    const res = await sync("owner", { pets: { upsert: [{ id: 99, name: "x" }] } });
    expect(res.status).toBe(403);
    const data = await bootstrap("owner");
    expect(data.pets.every((p) => p.ownerId === 1)).toBe(true);
    expect(data.inventory).toEqual([]);
    const inv = await request(app).get("/api/inventory").set(auth("owner"));
    expect(inv.status).toBe(403);
  });

  it("owner walk-in request is scoped to their own pet and gets a server case number", async () => {
    const mine = await request(app).post("/api/visits").set(auth("owner")).send({ petId: 1, reason: "Limping", status: "done", diagnosis: "x" });
    expect(mine.status).toBe(201);
    expect(mine.body.data.caseNum).toMatch(/^RPC-\d{8}-\d{3}$/);
    const other = await request(app).post("/api/visits").set(auth("owner")).send({ petId: 2, reason: "Not mine" });
    expect(other.status).toBe(403);
    const v = (await bootstrap("doctor")).visits.find((x) => x.id === mine.body.data.id);
    expect(v.status).toBe("waiting");
    expect(v.diagnosis).toBeFalsy();
  });

  it("admin can do everything staff cannot", async () => {
    const res = await request(app).get("/api/users").set(auth("admin"));
    expect(res.status).toBe(200);
    expect((await bootstrap("admin")).users[0].email).toBeDefined();
  });

  it("staff self-registration requires the server-side code", async () => {
    const noCode = await request(app).post("/api/auth/register").send({ name: "Eve Evil", email: "eve@example.com", password: "secret1", role: "doctor" });
    expect(noCode.status).toBe(403);
    const asOwner = await request(app).post("/api/auth/register").send({ name: "New Owner", email: "NewOwner@Example.com", password: "secret1" });
    expect(asOwner.status).toBe(201);
    expect(asOwner.body.data.user.role).toBe("owner");
    const dup = await request(app).post("/api/auth/login").send({ email: "newowner@example.com", password: "secret1" });
    expect(dup.status).toBe(200);
  });

  it("deactivated users are locked out immediately", async () => {
    await db("users").where({ email: "reception@royalpet.in" }).update({ active: false });
    const res = await request(app).get("/api/bootstrap").set(auth("receptionist"));
    expect(res.status).toBe(401);
    await db("users").where({ email: "reception@royalpet.in" }).update({ active: true });
  });
});
