const { parse } = require("csv-parse/sync");
const db = require("../db/knex");
const ApiError = require("../utils/ApiError");

// ── Helpers ───────────────────────────────────────────────────────────────

const normKey = (k) => String(k || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const parseNum = (v, fallback = 0) => {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
};

const parseDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
};

// Parse CSV or tab-delimited text into an array of objects
const parseCsvText = (text) => {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new ApiError(400, "Empty file content");
  // Auto-detect delimiter
  const firstLine = trimmed.split("\n")[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  try {
    return parse(trimmed, { columns: true, skip_empty_lines: true, trim: true, delimiter });
  } catch {
    throw new ApiError(400, "Invalid CSV/TSV format — check file encoding and structure");
  }
};

// ── PETS + OWNERS ─────────────────────────────────────────────────────────
// Expected columns: ownerName, mobile, email, address, petName, type, breed, dob, sex, weight, color

const importPetsOwners = async (csvText) => {
  const records = parseCsvText(csvText);
  if (!records.length) throw new ApiError(400, "No data rows found");

  let created = { owners: 0, pets: 0 };
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const r = {};
    Object.keys(row).forEach((k) => { r[normKey(k)] = (row[k] || "").trim(); });

    const ownerName = r.ownername || r.owner || r.clientname;
    const mobile    = r.mobile || r.phone || r.contact;
    const petName   = r.petname || r.pet || r.name;

    if (!ownerName || !petName) {
      errors.push(`Row ${i + 2}: ownerName and petName are required`);
      continue;
    }

    try {
      // Find or create owner by mobile
      let owner = mobile
        ? await db("owners").where("mobile", mobile).first()
        : null;

      if (!owner) {
        const [ownerRow] = await db("owners")
          .insert({ name: ownerName, mobile: mobile || "", email: r.email || "", address: r.address || "" })
          .returning("id");
        owner = { id: ownerRow?.id ?? ownerRow };
        created.owners++;
      }

      // Check for duplicate pet (same name + owner)
      const existingPet = await db("pets").where({ name: petName, ownerId: owner.id }).first();
      if (!existingPet) {
        await db("pets").insert({
          name: petName,
          type:   r.type || r.species || "Dog",
          breed:  r.breed || "",
          dob:    parseDate(r.dob || r.dateofbirth),
          sex:    r.sex || r.gender || "",
          weight: parseNum(r.weight),
          color:  r.color || r.colour || "",
          ownerId: owner.id,
          photo:  "🐾",
          alerts: JSON.stringify([]),
        });
        created.pets++;
      }
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  return { created, errors, total: records.length };
};

// ── INVENTORY ─────────────────────────────────────────────────────────────
// Expected columns: name, category, stock, unit, minStock, batch, expiry, price, vendor

const importInventory = async (csvText) => {
  const records = parseCsvText(csvText);
  if (!records.length) throw new ApiError(400, "No data rows found");

  const rows = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const r = {};
    Object.keys(row).forEach((k) => { r[normKey(k)] = (row[k] || "").trim(); });

    const name = r.name || r.medicine || r.medicinename || r.drugname;
    if (!name) { errors.push(`Row ${i + 2}: name is required`); continue; }

    const expiry = parseDate(r.expiry || r.expirydate);
    if (expiry && new Date(expiry) < new Date()) {
      errors.push(`Row ${i + 2}: ${name} — expiry date is in the past`);
      continue;
    }

    rows.push({
      name,
      category: r.category || r.type || "Medicine",
      stock:    parseNum(r.stock || r.quantity),
      unit:     r.unit || "pcs",
      minStock: parseNum(r.minstock || r.minimumstock || r.reorderlevel, 10),
      batch:    r.batch || r.batchno || r.batchnumber || "",
      expiry,
      price:    parseNum(r.price || r.unitprice),
      vendor:   r.vendor || r.supplier || "",
    });
  }

  if (!rows.length) throw new ApiError(400, "No valid rows to import");

  // Skip duplicates by name+batch
  const existing = await db("inventory").select("name", "batch");
  const existingKeys = new Set(existing.map((e) => `${e.name}|${e.batch || ""}`.toLowerCase()));
  const toInsert = rows.filter((r) => !existingKeys.has(`${r.name}|${r.batch || ""}`.toLowerCase()));

  let inserted = 0;
  if (toInsert.length) {
    await db("inventory").insert(toInsert);
    inserted = toInsert.length;
  }

  return { inserted, skipped: rows.length - inserted, errors, total: records.length };
};

// ── VACCINATIONS ──────────────────────────────────────────────────────────
// Expected columns: petId OR petName, vaccine, given, next, batch, status

const importVaccinations = async (csvText) => {
  const records = parseCsvText(csvText);
  const created = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const r = {};
    Object.keys(row).forEach((k) => { r[normKey(k)] = (row[k] || "").trim(); });

    let petId = parseNum(r.petid);
    if (!petId && r.petname) {
      const pet = await db("pets").whereRaw("LOWER(name) = ?", [r.petname.toLowerCase()]).first();
      if (pet) petId = pet.id;
    }

    if (!petId)   { errors.push(`Row ${i + 2}: petId or petName required and must exist`); continue; }
    if (!r.vaccine) { errors.push(`Row ${i + 2}: vaccine is required`); continue; }
    if (!r.given)   { errors.push(`Row ${i + 2}: given date is required`); continue; }

    try {
      await db("vaccinations").insert({
        petId,
        vaccine: r.vaccine,
        given:   parseDate(r.given),
        next:    parseDate(r.next || r.nextdue),
        batch:   r.batch || "",
        status:  r.status || "given",
      });
      created.push(i + 2);
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  return { inserted: created.length, errors, total: records.length };
};

// ── APPOINTMENTS ─────────────────────────────────────────────────────────
// Expected columns: petId OR petName, ownerId OR ownerMobile, date, time, type, status, notes

const importAppointments = async (csvText) => {
  const records = parseCsvText(csvText);
  const created = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const r = {};
    Object.keys(row).forEach((k) => { r[normKey(k)] = (row[k] || "").trim(); });

    let petId = parseNum(r.petid);
    if (!petId && r.petname) {
      const pet = await db("pets").whereRaw("LOWER(name) = ?", [r.petname.toLowerCase()]).first();
      if (pet) petId = pet.id;
    }

    let ownerId = parseNum(r.ownerid);
    if (!ownerId && (r.mobile || r.phone || r.ownermobile)) {
      const mobile = r.mobile || r.phone || r.ownermobile;
      const owner = await db("owners").where("mobile", mobile).first();
      if (owner) ownerId = owner.id;
    }

    if (!petId)   { errors.push(`Row ${i + 2}: valid petId or petName required`); continue; }
    if (!ownerId) { errors.push(`Row ${i + 2}: valid ownerId or ownerMobile required`); continue; }
    if (!r.date)  { errors.push(`Row ${i + 2}: date is required`); continue; }
    if (!r.time)  { errors.push(`Row ${i + 2}: time is required`); continue; }

    try {
      await db("appointments").insert({
        petId,
        ownerId,
        date:   parseDate(r.date),
        time:   r.time,
        type:   r.type || r.appointmenttype || "Consultation",
        status: r.status || "scheduled",
        notes:  r.notes || "",
      });
      created.push(i + 2);
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  return { inserted: created.length, errors, total: records.length };
};

module.exports = { importPetsOwners, importInventory, importVaccinations, importAppointments };
