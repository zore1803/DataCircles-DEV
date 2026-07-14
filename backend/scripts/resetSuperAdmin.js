// scripts/resetSuperAdmin.js

require("dotenv").config();
const mongoose = require("mongoose");
const SuperAdmin = require("../models/SuperAdmin"); // Adjust path if needed

async function resetSuperAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ Connected to MongoDB");

    const email = process.env.SUPER_ADMIN_EMAIL || "admin@example.com";
    const password = process.env.SUPER_ADMIN_PASSWORD || "Admin@123";
    const name = process.env.SUPER_ADMIN_NAME || "Super Admin";

    // Remove existing admin
    await SuperAdmin.deleteOne({ email });

    console.log("🗑️ Existing Super Admin removed (if it existed)");

    // Create new admin
    const admin = new SuperAdmin({
      email,
      password,
      name,
    });

    await admin.save();

    console.log("==================================");
    console.log("✅ Super Admin recreated");
    console.log("Email   :", email);
    console.log("Password:", password);
    console.log("==================================");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

resetSuperAdmin();