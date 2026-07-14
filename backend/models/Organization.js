// models/Organization.js
const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, unique: true, required: true },
    address: { type: String },
    state: { type: String },
    logo: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Organization", organizationSchema);
