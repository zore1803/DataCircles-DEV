const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Organization = require("../models/Organization");
const User = require("../models/User");
const Company = require("../models/Company");
const Contact = require("../models/Contact");
const Deal = require("../models/Deal");

dotenv.config();

// ========== Helper Functions ==========

// Random date in a given month offset (0 = current month, 1 = last month, etc.)
function getRandomDateInMonth(monthOffset) {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth() - monthOffset,
    1
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth() - monthOffset + 1,
    0
  );

  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

// Generates deal amounts with natural up-down trend
function generateDealAmount(index) {
  const base = 4000 + Math.sin(index) * 2000 + Math.random() * 1500;
  return Math.round(base + index * 800);
}

async function seedDeals() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const organizations = await Organization.find();
    console.log(`🏢 Found ${organizations.length} organizations`);

    for (const org of organizations) {
      console.log(`\n🚀 Seeding data for organization: ${org.name}`);

      // Find one user in the organization
      const user = await User.findOne({ organization: org._id });

      if (!user) {
        console.log(`⚠️ No user found for ${org.name}, skipping...`);
        continue;
      }

      // ---------------- Companies ----------------

      const companyData = [
        {
          name: "Tech Innovations Ltd",
          industry: "Technology",
          address: "123 Innovation St, Tech City",
          website: "www.techinnovations.com",
        },
        {
          name: "Green Energy Corp",
          industry: "Energy",
          address: "456 Green Ave, Eco Town",
          website: "www.greenenergy.com",
        },
        {
          name: "HealthCare Solutions",
          industry: "Healthcare",
          address: "789 Health Blvd, Med City",
          website: "www.healthcaresolutions.com",
        },
        {
          name: "Finance Experts Inc",
          industry: "Finance",
          address: "101 Finance Rd, Money City",
          website: "www.financeexperts.com",
        },
        {
          name: "EduTech Academy",
          industry: "Education",
          address: "202 Edu Lane, Learn Town",
          website: "www.edutechacademy.com",
        },
        {
          name: "Auto Manufacturers",
          industry: "Automotive",
          address: "303 Auto Dr, Car City",
          website: "www.automanufacturers.com",
        },
        {
          name: "Retail Giants",
          industry: "Retail",
          address: "404 Retail St, Shop Town",
          website: "www.retailgiants.com",
        },
        {
          name: "Food Services Co",
          industry: "Food",
          address: "505 Food Ave, Eat City",
          website: "www.foodservices.com",
        },
        {
          name: "Travel Adventures",
          industry: "Travel",
          address: "606 Travel Blvd, Adventure Town",
          website: "www.traveladventures.com",
        },
        {
          name: "Media Entertainment",
          industry: "Media",
          address: "707 Media Rd, Entertain City",
          website: "www.mediaentertainment.com",
        },
      ].map((company) => ({
        ...company,
        organization: org._id,
        user: user._id,
        createdBy: user._id,
        lastUpdatedBy: user._id,
      }));

      const createdCompanies = await Company.insertMany(companyData);
      console.log(`🏢 Created ${createdCompanies.length} companies`);

      // ---------------- Contacts ----------------

      const contactData = createdCompanies.map((company, index) => ({
        name: `Contact Person ${index + 1}`,
        email: `contact${index + 1}@example.com`,
        phone: `+1-555-000${index + 1}`,
        company: company._id,
        lifecycleStage:
          index % 3 === 0
            ? "Lead"
            : index % 3 === 1
            ? "Sales Qualified Lead"
            : "Customer",
        stageStatus:
          index % 3 === 0
            ? "New"
            : index % 3 === 1
            ? "Qualified"
            : "Won",
        organization: org._id,
        user: user._id,
        createdBy: user._id,
        lastUpdatedBy: user._id,
      }));

      const createdContacts = await Contact.insertMany(contactData);
      console.log(`👤 Created ${createdContacts.length} contacts`);

      // ---------------- Deals ----------------

      const dealData = createdContacts.map((contact, index) => {
        const monthOffset = index % 5;

        return {
          title: `Deal Opportunity ${index + 1}`,
          amount: generateDealAmount(index),

          status:
            index % 3 === 0
              ? "Open"
              : index % 3 === 1
              ? "Won"
              : "Lost",

          contact: contact._id,
          company: createdCompanies[index]._id,

          // Owner
          user: user._id,

          // Audit fields
          createdBy: user._id,
          lastUpdatedBy: user._id,

          organization: org._id,

          additionalFields: [],

          createdAt: getRandomDateInMonth(monthOffset),
          updatedAt: getRandomDateInMonth(monthOffset),
        };
      });

      const createdDeals = await Deal.insertMany(dealData);
      console.log(`💼 Created ${createdDeals.length} deals`);
    }

    console.log("\n✅ Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    process.exit(1);
  }
}

seedDeals();