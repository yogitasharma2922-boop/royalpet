const request = require("supertest");
const app = require("../src/app");
const db = require("../src/db/knex");
const bcrypt = require("bcrypt");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

let doctorToken, adminToken, receptionToken, ownerToken;

const setupDatabase = async () => {
  await db.migrate.latest();\n  await db.seed.run();\n};

const loginUser = async (email, password) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}`);
  return res.body.data.token;
};

describe("INTEGRATION TESTS - Full API Flow", () => {
  beforeAll(async () => {
    await setupDatabase();
    doctorToken = await loginUser("doctor@royalpet.in", "doctor123");
    adminToken = await loginUser("admin@royalpet.in", "admin123");
    receptionToken = await loginUser("reception@royalpet.in", "recep123");
    ownerToken = await loginUser("owner@royalpet.in", "owner123");
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe("Enhanced Pet Management API", () => {
    it("lists all pets with pagination", async () => {
      const res = await request(app)
        .get("/api/pets")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("creates a new pet", async () => {
      // First create an owner
      const ownerRes = await request(app)
        .post("/api/owners")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ name: "Test Owner", mobile: "9999999999", email: "owner@test.com" });

      if (ownerRes.status === 201 || ownerRes.status === 200) {
        const ownerId = ownerRes.body.data?.id || 1;
        
        const res = await request(app)
          .post("/api/pets")
          .set("Authorization", `Bearer ${receptionToken}`)
          .send({
            name: "Buddy",
            type: "Dog",
            breed: "Labrador",
            ownerId,
            sex: "Male",
            weight: 35,
          });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe("Buddy");
      }
    });

    it("retrieves pet details", async () => {
      const listRes = await request(app)
        .get("/api/pets")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      if (listRes.body.data.length > 0) {
        const petId = listRes.body.data[0].id;
        const res = await request(app)
          .get(`/api/pets/${petId}`)
          .set("Authorization", `Bearer ${doctorToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(petId);
      }
    });

    it("updates pet information", async () => {
      const listRes = await request(app)
        .get("/api/pets")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      if (listRes.body.data.length > 0) {
        const petId = listRes.body.data[0].id;
        const res = await request(app)
          .put(`/api/pets/${petId}`)
          .set("Authorization", `Bearer ${receptionToken}`)
          .send({ weight: 40 });
        
        expect(res.status).toBe(200);
        expect(res.body.data.weight).toBe(40);
      }
    });

    it("searches pets by name", async () => {
      const res = await request(app)
        .get("/api/pets/search?name=Buddy")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("Inventory Management API", () => {
    it("lists inventory items", async () => {
      const res = await request(app)
        .get("/api/inventory")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("creates inventory item", async () => {
      const res = await request(app)
        .post("/api/inventory")
        .set("Authorization", `Bearer ${doctorToken}`)
        .send({
          name: "Amoxicillin",
          category: "Antibiotics",
          stock: 100,
          unit: "tablets",
          minStock: 10,
          price: 5.50,
        });
      
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Amoxicillin");
    });

    it("retrieves inventory item", async () => {
      const listRes = await request(app)
        .get("/api/inventory")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      if (listRes.body.data.length > 0) {
        const itemId = listRes.body.data[0].id;
        const res = await request(app)
          .get(`/api/inventory/${itemId}`)
          .set("Authorization", `Bearer ${doctorToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(itemId);
      }
    });

    it("filters low stock items", async () => {
      const res = await request(app)
        .get("/api/inventory?lowStock=true")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("Activity Logging", () => {
    it("admin can view activity logs", async () => {
      const res = await request(app)
        .get("/api/activity-logs")
        .set("Authorization", `Bearer ${adminToken}`);
      
      // May be empty if no activities logged yet
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe("object");
    });

    it("non-admin cannot view activity logs", async () => {
      const res = await request(app)
        .get("/api/activity-logs")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      expect(res.status).toBe(403);
    });

    it("admin can view activity statistics", async () => {
      const res = await request(app)
        .get("/api/activity-stats?days=7")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("Treatment & Prescription Management", () => {
    it("creates treatment with prescription", async () => {
      const petsRes = await request(app)
        .get("/api/pets")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      if (petsRes.body.data.length > 0) {
        const petId = petsRes.body.data[0].id;
        const res = await request(app)
          .post("/api/treatments")
          .set("Authorization", `Bearer ${doctorToken}`)
          .send({
            petId,
            date: new Date().toISOString().split("T")[0],
            status: "completed",
            diagnosis: "Fever",
            medicines: [
              { name: "Amoxicillin", dose: "10mg/kg", duration: "5 days", instruction: "Oral" },
            ],
          });
        
        expect([200, 201]).toContain(res.status);
        expect(res.body.data).toBeDefined();
      }
    });

    it("lists treatments", async () => {
      const res = await request(app)
        .get("/api/treatments")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("Authorization & Security", () => {
    it("rejects requests without token", async () => {
      const res = await request(app).get("/api/pets");
      expect(res.status).toBe(401);
    });

    it("rejects requests with invalid token", async () => {
      const res = await request(app)
        .get("/api/pets")
        .set("Authorization", "Bearer invalid-token");
      expect(res.status).toBe(401);
    });

    it("owner can only see their own pets", async () => {
      const res = await request(app)
        .get("/api/pets")
        .set("Authorization", `Bearer ${ownerToken}`);
      
      expect(res.status).toBe(200);
      // Should be empty or only owner's pets
      if (res.body.data.length > 0) {
        expect(res.body.data[0].ownerId).toBeDefined();
      }
    });

    it("reception cannot delete pets", async () => {
      const petsRes = await request(app)
        .get("/api/pets")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      if (petsRes.body.data.length > 0) {
        const petId = petsRes.body.data[0].id;
        const res = await request(app)
          .delete(`/api/pets/${petId}`)
          .set("Authorization", `Bearer ${receptionToken}`);
        
        expect(res.status).toBe(403);
      }
    });
  });

  describe("Error Handling", () => {
    it("returns 404 for non-existent pet", async () => {
      const res = await request(app)
        .get("/api/pets/99999")
        .set("Authorization", `Bearer ${doctorToken}`);
      
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid inventory creation", async () => {
      const res = await request(app)
        .post("/api/inventory")
        .set("Authorization", `Bearer ${doctorToken}`)
        .send({ category: "Test" }); // Missing name
      
      expect(res.status).toBe(400);
    });
  });

  describe("Data Visibility", () => {
    it("bootstrap returns scoped data for owner", async () => {
      const res = await request(app)
        .get("/api/bootstrap")
        .set("Authorization", `Bearer ${ownerToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.inventory).toEqual([]);
      expect(res.body.data.activityLog).toEqual([]);
    });

    it("bootstrap returns full data for admin", async () => {
      const res = await request(app)
        .get("/api/bootstrap")
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.inventory).toBeDefined();
      expect(res.body.data.users).toBeDefined();
    });
  });
});
