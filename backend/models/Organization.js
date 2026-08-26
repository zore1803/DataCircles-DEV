// models/Organization.js
const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, unique: true, required: true },
    address: { type: String },
    state: { type: String },
    logo: { type: String },
    gstNumber: { type: String, trim: true },
    // Reserved "<handle>.dc" identity slug — claimed via the Email Domain
    // settings card. Not yet wired into actual mail sending (no SendGrid
    // domain authentication behind it); it just reserves the name so it's
    // ready to use once that infra is built.
    emailHandle: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Organization", organizationSchema);
