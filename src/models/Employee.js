// server/src/models/Employee.js
import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true }, // e.g. "Backend Engineer"
    project: { type: String, required: true, trim: true }, // simple string ref for hackathon scale
    status: {
      type: String,
      enum: ["active", "offboarding"],
      default: "active",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Employee", employeeSchema);
