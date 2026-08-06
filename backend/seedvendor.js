require("dotenv").config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require("mongoose");
const Vendor = require("./models/Vendor");
const Organization = require("./models/Organization");
const User = require("./models/User");

const seedVendors = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    // Find any organization to attach the vendors to
    const org = await Organization.findOne();
    if (!org) {
      console.error("No organization found. Please create an organization first.");
      process.exit(1);
    }
    console.log(`Using Organization ID: ${org._id}`);

    // Optional: Find a user to attach to
    const user = await User.findOne();
    const userId = user ? user._id : undefined;

    // Define base vendor data from image + extras to reach 50+ records
    const baseNames = [
      "Auto Parts Ltd", "Edu Supplies Co", "Energy Parts Ltd", "Finance Solutions",
      "Food Distributors", "Tech Innovations Inc", "Global Logistics", "Prime Hardware",
      "Apex Software", "Green Energy Corp", "NextGen Marketing", "Pinnacle Consulting",
      "Velocity Delivery", "Core Network Systems", "Summit Medical", "Alpha Manufacturing",
      "Omega Retailers", "Nexus Enterprises", "Horizon Ventures", "Frontier Technologies",
      "BlueSky Media", "Starlight Productions", "Metro Builders", "Silverline Properties",
      "Crestwood Financial", "Delta Dynamics", "Echo Electronics", "Fusion Services",
      "Gateway Solutions", "Haven Healthcare", "Infinity Communications", "Jupiter Aerospace",
      "Keystone Construction", "Lumina Lighting", "Meridian Consulting", "Nova Networks",
      "Orion Optics", "Pulse Fitness", "Quantum Computing", "Radiant Renewables",
      "Sentinel Security", "Terra Farming", "Unity Logistics", "Vanguard Investments",
      "Zenith Advertising", "Aegis Insurance", "Beacon Hospitality", "Catalyst Chemicals",
      "Domino Delivery", "Eclipse Entertainment", "Falcon Logistics", "Genesis BioTech"
    ];

    const vendorsToInsert = [];

    // Create 2 of each to simulate the duplicates shown in the image, or just unique
    for (let i = 0; i < baseNames.length; i++) {
      const name = baseNames[i];
      const domain = name.split(" ")[0].toLowerCase() + ".com";
      
      vendorsToInsert.push({
        name: name,
        email: `contact@${domain}`,
        phone: `+1-555-${1000 + i}`,
        company: name,
        gstin: `27AAAAA${1000 + i}A1Z${i % 9}`,
        address: {
          line1: `${(i + 1) * 100} ${name.split(" ")[0]} Ave`,
          line2: `Suite ${i + 1}`,
          city: "Tech City",
          state: "CA",
          pincode: `900${i.toString().padStart(2, "0")}`,
          country: "India"
        },
        balance: i % 5 === 0 ? 42524.00 : 0.00, // Some have balances like in image
        socialMedia: {
          twitter: `https://twitter.com/${name.split(" ")[0].toLowerCase()}`,
          linkedin: `https://linkedin.com/company/${name.split(" ")[0].toLowerCase()}`,
        },
        organization: org._id,
        user: userId,
        additionalFields: [
          {
            key: "Vendor Category",
            value: i % 2 === 0 ? "Supplier" : "Service Provider",
            type: "dropdown",
            category: "General"
          }
        ]
      });
    }

    console.log(`Prepared ${vendorsToInsert.length} vendors for insertion...`);
    
    // Clear existing vendors? (Optional, skipping to just add MORE records as requested)
    // await Vendor.deleteMany({ organization: org._id });
    
    const inserted = await Vendor.insertMany(vendorsToInsert);
    console.log(`Successfully added ${inserted.length} vendors.`);

  } catch (error) {
    console.error("Error seeding vendors:", error);
  } finally {
    mongoose.connection.close();
    console.log("Database connection closed.");
    process.exit(0);
  }
};

seedVendors();
