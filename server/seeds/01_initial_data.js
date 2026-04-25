const bcrypt = require("bcrypt");

exports.seed = async function (knex) {
  const client = knex.client && knex.client.config && knex.client.config.client;
  const tables = [
    "activity_log",
    "invoices",
    "inventory",
    "vaccinations",
    "appointments",
    "prescriptions",
    "visits",
    "pets",
    "owners",
    "users",
    "clinic_settings",
  ];

  const clearTables = async (trx) => {
    if (client === "pg") {
      const quoted = tables.map((t) => `"${t}"`).join(", ");
      await trx.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
      return;
    }

    if (client === "mysql" || client === "mysql2") {
      await trx.raw("SET FOREIGN_KEY_CHECKS = 0");
      for (const t of tables) {
        await trx(t).truncate();
      }
      await trx.raw("SET FOREIGN_KEY_CHECKS = 1");
      return;
    }

    if (client === "sqlite3") {
      await trx.raw("PRAGMA foreign_keys = OFF");
      for (const t of tables) {
        await trx(t).del();
      }
      await trx.raw("PRAGMA foreign_keys = ON");
      return;
    }

    for (const t of tables) {
      await trx(t).del();
    }
  };

  const hash = (pwd) => bcrypt.hashSync(pwd, 10);

  await knex.transaction(async (trx) => {
    await clearTables(trx);

    const owners = [
      { id: 1, name: "Rajesh Kumar", mobile: "9876543210", email: "rajesh@gmail.com", address: "12, MG Road, Bangalore" },
      { id: 2, name: "Priya Sharma", mobile: "9823456789", email: "priya@gmail.com", address: "45, Koramangala, Bangalore" },
    ];
    await trx("owners").insert(owners);

    const users = [
      { id: 1, name: "Dr. Rajan Mehta", email: "doctor@royalpet.in", password: hash("doctor123"), role: "doctor", mobile: "9876500001", avatar: "DR", active: true, lastLogin: new Date("2026-03-14T09:00:00"), ownerId: null },
      { id: 2, name: "Rajesh Kumar", email: "owner@royalpet.in", password: hash("owner123"), role: "owner", mobile: "9876543210", avatar: "RK", active: true, lastLogin: new Date("2026-03-13T18:00:00"), ownerId: 1 },
    ];

    await trx("users").insert(users);

    const pets = [
      { id: 1, name: "Bruno", type: "Dog", breed: "Labrador Retriever", dob: "2023-01-15", sex: "Male", weight: 28.5, ownerId: 1, photo: "DOG", alerts: JSON.stringify(["Allergic to Amoxicillin"]), color: "#f5ede0" },
      { id: 2, name: "Whiskers", type: "Cat", breed: "Persian", dob: "2021-06-10", sex: "Female", weight: 4.2, ownerId: 2, photo: "CAT", alerts: JSON.stringify([]), color: "#e5e8f5" },
    ];
    await trx("pets").insert(pets);

    const visits = [
      { id: 1, petId: 1, caseNum: "RPC-20260311-001", date: "2026-03-11", status: "consulting", reason: "Skin rash & itching", temp: 102.8, hr: 88, rr: 22, weight: 28.5, diagnosis: "Skin Allergy", notes: "Chronic condition, needs follow-up", doctorId: 1, emergency: false },
      { id: 2, petId: 2, caseNum: "RPC-20260308-001", date: "2026-03-08", status: "done", reason: "Annual vaccination", temp: 101.2, hr: 95, rr: 20, weight: 4.2, diagnosis: "Routine Vaccination", notes: "", doctorId: 1, emergency: false },
    ];
    await trx("visits").insert(visits);

    const prescriptions = [
      { id: 1, visitId: 1, medicines: JSON.stringify([{ name: "Prednisolone 5mg", dose: "1 tab", duration: "7 days", instruction: "After food" }, { name: "Cetirizine 5mg", dose: "0.5 tab", duration: "5 days", instruction: "Once daily" }]) },
      { id: 2, visitId: 2, medicines: JSON.stringify([{ name: "Tricat Vaccine", dose: "1 dose", duration: "Once", instruction: "Given at clinic" }]) },
    ];
    await trx("prescriptions").insert(prescriptions);

    const appointments = [
      { id: 1, petId: 1, ownerId: 1, date: "2026-03-11", time: "09:00", type: "Follow-up", status: "checked-in", notes: "" },
      { id: 2, petId: 2, ownerId: 2, date: "2026-03-11", time: "10:00", type: "Vaccination", status: "confirmed", notes: "" },
    ];
    await trx("appointments").insert(appointments);

    const vaccinations = [
      { id: 1, petId: 1, vaccine: "9-in-1 (DHPPiL+)", given: "2025-03-10", next: "2026-03-10", batch: "9IN2025A", status: "due" },
      { id: 2, petId: 2, vaccine: "Tricat (FVRCP)", given: "2025-08-20", next: "2026-08-20", batch: "TRI2025A", status: "ok" },
    ];
    await trx("vaccinations").insert(vaccinations);

    const inventory = [
      { id: 1, name: "Amoxicillin 250mg", category: "Antibiotic", stock: 45, unit: "tablets", minStock: 20, batch: "AMX2025B", expiry: "2026-09-15", price: 8, vendor: "Pharma India" },
      { id: 2, name: "Rabies Vaccine", category: "Vaccine", stock: 28, unit: "doses", minStock: 10, batch: "RBV2026A", expiry: "2026-12-01", price: 350, vendor: "BioVet" },
    ];
    await trx("inventory").insert(inventory);

    const invoices = [
      { id: 1, visitId: 1, petId: 1, ownerId: 1, date: "2026-03-11", items: JSON.stringify([{ name: "Consultation", qty: 1, rate: 500, amt: 500 }, { name: "Prednisolone 5mg (14tabs)", qty: 14, rate: 12, amt: 168 }, { name: "Cetirizine 5mg (10tabs)", qty: 10, rate: 6, amt: 60 }]), total: 728, status: "paid", method: "UPI" },
      { id: 2, visitId: 2, petId: 2, ownerId: 2, date: "2026-03-08", items: JSON.stringify([{ name: "Consultation", qty: 1, rate: 500, amt: 500 }, { name: "Tricat Vaccine", qty: 1, rate: 480, amt: 480 }]), total: 980, status: "paid", method: "Cash" },
    ];
    await trx("invoices").insert(invoices);

    await trx("clinic_settings").insert({
      name: "Royal Pet Clinic",
      doctor: "Dr. Rajan Mehta",
      phone: "+91 80 1234 5678",
      email: "info@royalpetclinic.in",
      address: "123, MG Road, Bangalore - 560001",
      regNum: "VET/2020/BLR/0042",
      consultFee: 500,
      currency: "INR",
    });
  });
};
