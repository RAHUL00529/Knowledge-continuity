// server/src/data/seed/seedEmployees.js
require("dotenv").config();
const mongoose = require("mongoose");
const Employee = require("../../models/Employee");
const employees = require("./employees.json");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await Employee.deleteMany({});
  for (const emp of employees) {
    const { note, ...doc } = emp; // strip the demo-only annotation
    await Employee.create(doc);
  }
  console.log(`Seeded ${employees.length} employees.`);
  await mongoose.disconnect();
}
seed();
