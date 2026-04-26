const { sendSuccess } = require("../utils/apiResponse");
const ApiError = require("../utils/ApiError");
const { importPetsOwners, importInventory, importVaccinations, importAppointments } = require("../services/csvImportService");

const getBody = (req) => {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body.csv === "string") return req.body.csv;
  if (req.body && typeof req.body.data === "string") return req.body.data;
  throw new ApiError(400, "Request body must be CSV text. Send as plain text/csv or JSON with a 'csv' field.");
};

const importPetsOwnersHandler = async (req, res) => {
  const result = await importPetsOwners(getBody(req));
  return sendSuccess(res, result, "Pets and owners imported", 201);
};

const importInventoryHandler = async (req, res) => {
  const result = await importInventory(getBody(req));
  return sendSuccess(res, result, "Inventory imported", 201);
};

const importVaccinationsHandler = async (req, res) => {
  const result = await importVaccinations(getBody(req));
  return sendSuccess(res, result, "Vaccinations imported", 201);
};

const importAppointmentsHandler = async (req, res) => {
  const result = await importAppointments(getBody(req));
  return sendSuccess(res, result, "Appointments imported", 201);
};

// Return column templates as downloadable CSV
const getTemplate = async (req, res) => {
  const { type } = req.params;
  const templates = {
    "pets-owners":  "ownerName,mobile,email,address,petName,type,breed,dob,sex,weight,color\nJohn Smith,9876543210,john@email.com,123 Main St,Buddy,Dog,Labrador,2020-01-15,Male,25,Black",
    inventory:      "name,category,stock,unit,minStock,batch,expiry,price,vendor\nAmoxicillin 250mg,Medicine,100,strips,20,BATCH001,2027-06-30,45,MedSupply Co",
    vaccinations:   "petId,petName,vaccine,given,next,batch,status\n1,Buddy,Rabies,2026-01-10,2027-01-10,VACC2026,given",
    appointments:   "petId,petName,ownerMobile,date,time,type,status,notes\n1,Buddy,9876543210,2026-05-15,10:30,Checkup,scheduled,Annual wellness visit",
  };

  const csv = templates[type];
  if (!csv) throw new ApiError(400, `Unknown template type: ${type}. Valid: pets-owners, inventory, vaccinations, appointments`);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="royalpet-${type}-template.csv"`);
  res.send(csv);
};

module.exports = { importPetsOwnersHandler, importInventoryHandler, importVaccinationsHandler, importAppointmentsHandler, getTemplate };
