/**
 * Central role policy. Every read, write and delete on a clinic table goes
 * through this file, so one role can never see or change another role's data.
 *
 * Roles: admin, doctor, receptionist, owner (owners are scoped per record
 * inside the controllers and never use the staff sync endpoint).
 */

const ALL_TABLES = [
  "owners", "pets", "visits", "prescriptions", "appointments", "vaccinations",
  "inventory", "invoices", "supplier_payments", "planner_tasks",
  "activity_log", "clinic_settings",
];

// Visit columns that front desk may see and change. Intake vitals are recorded at the
// desk; diagnosis, notes and inventoryDeducted stay with doctor/admin.
const VISIT_FRONT_DESK_COLUMNS = [
  "id", "petId", "caseNum", "date", "status", "reason", "emergency", "doctorId",
  "temp", "hr", "rr", "weight", "source", "createdAt", "updatedAt",
];

const CLINIC_SETTINGS_FRONT_DESK_COLUMNS = [
  "id", "name", "phone", "email", "address", "currency",
];

const POLICY = {
  admin: {
    read: Object.fromEntries(ALL_TABLES.map((t) => [t, null])),
    write: Object.fromEntries(ALL_TABLES.map((t) => [t, null])),
    remove: ALL_TABLES,
  },
  doctor: {
    read: {
      owners: null, pets: null, visits: null, prescriptions: null,
      appointments: null, vaccinations: null, inventory: null, invoices: null,
      supplier_payments: null, planner_tasks: null, clinic_settings: null,
    },
    write: {
      owners: null, pets: null, visits: null, prescriptions: null,
      appointments: null, vaccinations: null, inventory: null, invoices: null,
      supplier_payments: null, planner_tasks: null, activity_log: null,
    },
    remove: ["visits", "prescriptions", "appointments", "vaccinations", "inventory", "invoices", "supplier_payments", "planner_tasks"],
  },
  receptionist: {
    read: {
      owners: null, pets: null, visits: VISIT_FRONT_DESK_COLUMNS,
      appointments: null, planner_tasks: null,
      clinic_settings: CLINIC_SETTINGS_FRONT_DESK_COLUMNS,
    },
    write: {
      owners: null, pets: null, visits: VISIT_FRONT_DESK_COLUMNS,
      appointments: null, planner_tasks: null, activity_log: null,
    },
    remove: ["visits", "appointments", "planner_tasks"],
  },
};

const STAFF_ROLES = ["admin", "doctor", "receptionist"];

const canRead = (role, table) => !!(POLICY[role] && Object.prototype.hasOwnProperty.call(POLICY[role].read, table));
const canWrite = (role, table) => !!(POLICY[role] && Object.prototype.hasOwnProperty.call(POLICY[role].write, table));
const canRemove = (role, table) => !!(POLICY[role] && POLICY[role].remove.includes(table));

// null means "every column"
const readColumns = (role, table) => (canRead(role, table) ? POLICY[role].read[table] : []);
const writeColumns = (role, table) => (canWrite(role, table) ? POLICY[role].write[table] : []);

const rolesThatRead = (table) => Object.keys(POLICY).filter((r) => canRead(r, table));
const rolesThatWrite = (table) => Object.keys(POLICY).filter((r) => canWrite(r, table));
const rolesThatRemove = (table) => Object.keys(POLICY).filter((r) => canRemove(r, table));

const pick = (row, columns) => {
  if (!row || !columns) return row;
  const out = {};
  columns.forEach((c) => { if (c in row) out[c] = row[c]; });
  return out;
};

const pickRows = (rows, columns) => (columns ? rows.map((r) => pick(r, columns)) : rows);

module.exports = {
  ALL_TABLES, STAFF_ROLES, POLICY,
  canRead, canWrite, canRemove, readColumns, writeColumns,
  rolesThatRead, rolesThatWrite, rolesThatRemove, pick, pickRows,
};
