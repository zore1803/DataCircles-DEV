// One-off script: adds N contacts to a specific user's organization.
// Usage: node scripts/seed1000Contacts.js [email] [count]
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const Company = require("../models/Company");
const Contact = require("../models/Contact");

dotenv.config({ quiet: true });

const TARGET_EMAIL = process.argv[2] || "rohit.zore@datacircles.in";
const COUNT = parseInt(process.argv[3], 10) || 1000;

const FIRST_NAMES = [
  "Aarav", "Priya", "Rohan", "Ananya", "Vikram", "Neha", "Arjun", "Isha",
  "Karan", "Sneha", "Rahul", "Pooja", "Amit", "Divya", "Sanjay", "Meera",
  "James", "Emily", "Michael", "Sarah", "David", "Laura", "Daniel", "Olivia",
  "Chris", "Sophia", "Ryan", "Emma", "Kevin", "Grace",
];
const LAST_NAMES = [
  "Sharma", "Patel", "Kumar", "Singh", "Reddy", "Nair", "Mehta", "Gupta",
  "Iyer", "Desai", "Rao", "Joshi", "Malhotra", "Kapoor", "Bose",
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Taylor",
];
// Stage and status were picked from two independent lists, which produced
// impossible pairs like Lead/Won — exactly the combinations the model's
// pre-save hook rejects (and that insertMany, used below, would slip past).
// Both now come from the one authoritative map, status chosen WITHIN the
// stage that was picked.
const { LIFECYCLE_STAGES, STAGE_STATUS_MAP } = require("../constants/contactLifecycle");
const DOMAINS = ["gmail.com", "outlook.com", "company.com", "corp.in", "business.co", "example.org"];

const pick = (arr, i) => arr[i % arr.length];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const user = await User.findOne({ email: TARGET_EMAIL });
    if (!user) {
      console.error(`No user found with email: ${TARGET_EMAIL}`);
      process.exit(1);
    }
    if (!user.organization) {
      console.error(`User ${TARGET_EMAIL} has no organization assigned`);
      process.exit(1);
    }

    const companies = await Company.find({ organization: user.organization }).select("_id");
    console.log(`Found ${companies.length} companies to link contacts to`);

    const existing = await Contact.countDocuments({ organization: user.organization });
    console.log(`Seeding ${COUNT} contacts for organization ${user.organization} (existing: ${existing})`);

    const data = [];
    for (let i = existing; i < existing + COUNT; i++) {
      const first = pick(FIRST_NAMES, i);
      const last = pick(LAST_NAMES, Math.floor(i / FIRST_NAMES.length) + i);
      const name = `${first} ${last} ${i + 1}`;
      const emailUser = `${first}.${last}${i + 1}`.toLowerCase();
      const lifecycleStage = pick(LIFECYCLE_STAGES, i);
      const stageStatus = pick(STAGE_STATUS_MAP[lifecycleStage], i);
      const company = companies.length ? companies[i % companies.length]._id : undefined;

      data.push({
        name,
        email: `${emailUser}@${pick(DOMAINS, i)}`,
        phone: `+91-9${String(800000000 + (i * 137) % 99999999).padStart(9, "0")}`,
        company,
        lifecycleStage,
        stageStatus,
        organization: user.organization,
        user: user._id,
        createdBy: user._id,
        lastUpdatedBy: user._id,
      });
    }

    const created = await Contact.insertMany(data);
    console.log(`Created ${created.length} contacts for ${TARGET_EMAIL}`);
    process.exit(0);
  } catch (error) {
    console.error("Error seeding contacts:", error);
    process.exit(1);
  }
}

seed();
