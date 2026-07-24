// One-off script: adds more companies to the organization of a specific user.
// Usage: node scripts/seed100Companies.js [email] [count]
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const Company = require("../models/Company");

dotenv.config({ quiet: true });

const TARGET_EMAIL = process.argv[2] || "rohit.zore@datacircles.in";
const COUNT = parseInt(process.argv[3], 10) || 100;

const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Retail",
  "Education",
  "Manufacturing",
  "Real Estate",
  "Hospitality",
  "Logistics",
  "Media",
  "Energy",
  "Automotive",
  "Agriculture",
  "Construction",
  "Telecommunications",
];

const NAME_PREFIXES = [
  "Apex", "Bright", "Summit", "Northwind", "Blue Ridge", "Silverline", "Horizon",
  "Cedar", "Pioneer", "Vertex", "Golden Gate", "Crimson", "Evergreen", "Falcon",
  "Nova", "Sterling", "Ironclad", "Bluewater", "Skyline", "Meridian", "Cobalt",
  "Redwood", "Amber", "Granite", "Orbit", "Pinnacle", "Lighthouse", "Fusion",
  "Quantum", "Zenith",
];

const NAME_SUFFIXES = [
  "Industries", "Solutions", "Group", "Enterprises", "Holdings", "Partners",
  "Systems", "Ventures", "Corp", "Labs", "Works", "Collective", "Networks",
  "Consulting", "Technologies",
];

const CITIES = [
  "Austin", "Denver", "Seattle", "Boston", "Chicago", "Miami", "Portland",
  "Nashville", "Phoenix", "Atlanta", "Dallas", "San Diego", "Houston",
  "Charlotte", "Columbus", "Raleigh", "Salt Lake City", "Kansas City",
  "Minneapolis", "Tampa",
];

const STREET_NAMES = [
  "Main St", "Market St", "Commerce Ave", "Industrial Pkwy", "Harbor Rd",
  "Innovation Dr", "Liberty Ln", "Union Sq", "Federal Ave", "Cypress Blvd",
];

const LEAD_SOURCES = ["Website", "Referral", "Cold Outreach", "Trade Show", "LinkedIn", "Partner", ""];

function pick(arr, i) {
  return arr[i % arr.length];
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function seed100Companies() {
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

    console.log(`Seeding ${COUNT} companies for organization: ${user.organization}`);

    const existingCount = await Company.countDocuments({ organization: user.organization });

    const companyData = [];
    for (let i = existingCount; i < existingCount + COUNT; i++) {
      const prefix = pick(NAME_PREFIXES, i);
      const suffix = pick(NAME_SUFFIXES, Math.floor(i / NAME_PREFIXES.length) + i);
      const name = `${prefix} ${suffix} ${i + 1}`;
      const city = pick(CITIES, i);
      const street = pick(STREET_NAMES, i + 3);
      const industry = pick(INDUSTRIES, i);
      const domain = `${slugify(prefix)}${slugify(suffix)}${i + 1}.com`;

      companyData.push({
        name,
        industry,
        address: `${100 + i} ${street}, ${city}`,
        website: `www.${domain}`,
        gstin: i % 4 === 0 ? `29ABCDE${1000 + i}F1Z${i % 10}` : "",
        documentSigned: i % 3 === 0,
        leadSource: pick(LEAD_SOURCES, i),
        organization: user.organization,
        user: user._id,
        createdBy: user._id,
        lastUpdatedBy: user._id,
      });
    }

    const created = await Company.insertMany(companyData);
    console.log(`Created ${created.length} companies for ${TARGET_EMAIL}`);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding companies:", error);
    process.exit(1);
  }
}

seed100Companies();
