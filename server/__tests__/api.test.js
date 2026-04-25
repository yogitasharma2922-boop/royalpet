process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const bcrypt = require("bcrypt");
const request = require("supertest");
const app = require("../src/app");
const db = require("../src/db/knex");

const login = async (email, password) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.data.token;
};

beforeAll(async () => {
  await db.migrate.latest();
  await db.seed.run();
  const seededUsers = [
    { id: 3, name: "Front Desk", email: "reception@royalpet.in", password: "recep123", role: "receptionist", mobile: "9876500002", avatar: "FD", active: true, ownerId: null },
    { id: 4, name: "Clinic Admin", email: "admin@royalpet.in", password: "admin123", role: "admin", mobile: "9876500003", avatar: "CA", active: true, ownerId: null },
  ];
  for (const user of seededUsers) {
    const exists = await db("users").where({ email: user.email }).first();
    if (!exists) {
      await db("users").insert({
        ...user,
        password: await bcrypt.hash(user.password, 10),
        lastLogin: new Date(),
      });
    }
  }
});

afterAll(async () => {
  await db.destroy();
});

describe("Auth", () => {
  it("logs in with seeded doctor", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "doctor@royalpet.in", password: "doctor123" });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });
});

describe("Health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
  });
});

describe("Pets", () => {
  it("lists pets with auth", async () => {
    const token = await login("doctor@royalpet.in", "doctor123");
    const res = await request(app).get("/api/pets").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("searches pets by owner phone", async () => {
    const token = await login("reception@royalpet.in", "recep123");
    const res = await request(app).get("/api/pets/search?phone=9876543210").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe("Bootstrap", () => {
  it("returns scoped owner data", async () => {
    const token = await login("owner@royalpet.in", "owner123");
    const res = await request(app).get("/api/bootstrap").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.pets)).toBe(true);
    expect(res.body.data.inventory).toEqual([]);
    expect(res.body.data.pets.every((pet) => pet.ownerId === 1)).toBe(true);
  });
});

describe("Treatments", () => {
  it("lists treatments", async () => {
    const token = await login("doctor@royalpet.in", "doctor123");
    const res = await request(app).get("/api/treatments").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("Appointments", () => {
  it("allows owners to create their own appointment", async () => {
    const token = await login("owner@royalpet.in", "owner123");
    const res = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${token}`)
      .send({ petId: 1, date: "2026-04-30", time: "11:00", type: "Follow-up", status: "pending", notes: "Needs review" });
    expect(res.status).toBe(201);

    const list = await request(app).get("/api/appointments").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((item) => item.id === res.body.data.id)).toBe(true);
  });
});

describe("Inventory CSV upload", () => {
  it("uploads a CSV and inserts items", async () => {
    const token = await login("admin@royalpet.in", "admin123");
    const csv = "name,category,stock,unit,minStock,batch,expiry,price,vendor\nTest Med,Antibiotic,10,tablets,5,TST2026A,2026-12-31,20,TestVendor";
    const res = await request(app)
      .post("/api/inventory/csv-upload")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "text/csv")
      .send(csv);
    expect([201, 409]).toContain(res.status);
  });
});

describe("Uploads", () => {
  it("stores an uploaded image and returns a public path", async () => {
    const token = await login("doctor@royalpet.in", "doctor123");
    const res = await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake-image"), "pet.jpg");

    expect(res.status).toBe(201);
    expect(res.body.data.file.path).toContain("/uploads/");
    expect(res.body.data.file.provider).toBeTruthy();
  });
});
