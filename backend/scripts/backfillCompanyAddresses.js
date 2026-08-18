const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Company = require("../models/Company");

dotenv.config({ path: __dirname + "/../.env", quiet: true });

const CITIES_STATES = [
  { city: "Visakhapatnam", state: "Andhra Pradesh", pincode: "530001" },
  { city: "Itanagar", state: "Arunachal Pradesh", pincode: "791111" },
  { city: "Guwahati", state: "Assam", pincode: "781001" },
  { city: "Patna", state: "Bihar", pincode: "800001" },
  { city: "Raipur", state: "Chhattisgarh", pincode: "492001" },
  { city: "Panaji", state: "Goa", pincode: "403001" },
  { city: "Ahmedabad", state: "Gujarat", pincode: "380001" },
  { city: "Gurugram", state: "Haryana", pincode: "122001" },
  { city: "Shimla", state: "Himachal Pradesh", pincode: "171001" },
  { city: "Ranchi", state: "Jharkhand", pincode: "834001" },
  { city: "Bengaluru", state: "Karnataka", pincode: "560001" },
  { city: "Kochi", state: "Kerala", pincode: "682001" },
  { city: "Indore", state: "Madhya Pradesh", pincode: "452001" },
  { city: "Mumbai", state: "Maharashtra", pincode: "400001" },
  { city: "Imphal", state: "Manipur", pincode: "795001" },
  { city: "Shillong", state: "Meghalaya", pincode: "793001" },
  { city: "Aizawl", state: "Mizoram", pincode: "796001" },
  { city: "Kohima", state: "Nagaland", pincode: "797001" },
  { city: "Bhubaneswar", state: "Odisha", pincode: "751001" },
  { city: "Ludhiana", state: "Punjab", pincode: "141001" },
  { city: "Jaipur", state: "Rajasthan", pincode: "302001" },
  { city: "Gangtok", state: "Sikkim", pincode: "737101" },
  { city: "Chennai", state: "Tamil Nadu", pincode: "600001" },
  { city: "Hyderabad", state: "Telangana", pincode: "500001" },
  { city: "Agartala", state: "Tripura", pincode: "799001" },
  { city: "Lucknow", state: "Uttar Pradesh", pincode: "226001" },
  { city: "Dehradun", state: "Uttarakhand", pincode: "248001" },
  { city: "Kolkata", state: "West Bengal", pincode: "700001" },
  { city: "Port Blair", state: "Andaman and Nicobar Islands", pincode: "744101" },
  { city: "Chandigarh", state: "Chandigarh", pincode: "160001" },
  { city: "New Delhi", state: "Delhi", pincode: "110001" },
  { city: "Srinagar", state: "Jammu and Kashmir", pincode: "190001" },
  { city: "Leh", state: "Ladakh", pincode: "194101" },
  { city: "Puducherry", state: "Puducherry", pincode: "605001" },
];

const STREETS = [
  "M.G. Road",
  "Linking Road",
  "FC Road",
  "Brigade Road",
  "Connaught Place",
  "Anna Salai",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomGST() {
  // Format: 2 digits + 10 letters/numbers + 3 characters
  const stateCode = Math.floor(10 + Math.random() * 89).toString();
  const pan = "ABCDE" + Math.floor(1000 + Math.random() * 8999).toString() + "F";
  const suffix = "1Z" + Math.floor(1 + Math.random() * 9).toString();
  return stateCode + pan + suffix;
}

async function backfillCompanyAddresses() {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not found in .env");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    const companies = await Company.find({});
    console.log(`Found ${companies.length} companies to check.`);

    let updatedCount = 0;

    for (const company of companies) {
      let needsUpdate = false;

      // Always overwrite to redistribute states
      company.gstin = generateRandomGST();
      
      const billingLocation = pickRandom(CITIES_STATES);
      const billingStreet = pickRandom(STREETS);
      
      company.billingAddress = {
        addressLine1: `${Math.floor(1 + Math.random() * 100)}, ${billingStreet}`,
        addressLine2: "Business Park",
        city: billingLocation.city,
        state: billingLocation.state,
        pincode: billingLocation.pincode,
        country: "India",
      };

      const shippingLocation = pickRandom(CITIES_STATES);
      const shippingStreet = pickRandom(STREETS);

      company.shippingAddresses = [{
        addressLine1: `${Math.floor(1 + Math.random() * 100)}, ${shippingStreet}`,
        addressLine2: "Industrial Area",
        city: shippingLocation.city,
        state: shippingLocation.state,
        pincode: shippingLocation.pincode,
        country: "India",
      }];

      needsUpdate = true;

      if (needsUpdate) {
        await company.save();
        updatedCount++;
      }
    }

    console.log(`\nSuccessfully updated ${updatedCount} companies.`);
    process.exit(0);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

backfillCompanyAddresses();
