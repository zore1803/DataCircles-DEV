const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Journal = require("../models/Journal");

dotenv.config({ path: __dirname + "/../.env", quiet: true });

async function seedJournals() {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not found in .env");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    // Get any org and user
    const Organization = mongoose.model('Organization', new mongoose.Schema({ name: String }, { strict: false }));
    const User = mongoose.model('User', new mongoose.Schema({ email: String }, { strict: false }));

    const org = await Organization.findOne();
    const user = await User.findOne();

    if (!org || !user) {
      console.error("No Organization or User found in the database. Cannot seed.");
      process.exit(1);
    }

    const categories = ["Bank", "Cash", "Loan", "Credit Card", "Petty Cash", "Other"];
    const banks = ["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak Mahindra"];
    const names = ["Operating Account", "Main Cash", "Founder Loan", "Corporate Credit Card", "Daily Petty Cash", "Miscellaneous Fund"];

    const journalsToInsert = [];
    const count = 55; // 50-60 journals

    for (let i = 0; i < count; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      let name = "";
      if (category === "Bank") {
        name = `${banks[Math.floor(Math.random() * banks.length)]} - ${Math.floor(1000 + Math.random() * 9000)}`;
      } else {
        name = `${names[Math.floor(Math.random() * names.length)]} ${i + 1}`;
      }

      const balanceType = Math.random() > 0.5 ? "Debit" : "Credit";
      const openingBalance = Math.floor(Math.random() * 100000);

      // Create journal
      journalsToInsert.push({
        organization: org._id,
        user: user._id,
        name: name,
        category: category,
        description: `Seeded journal entry #${i + 1}`,
        openingBalance: openingBalance,
        balanceType: balanceType,
        currentBalance: openingBalance,
        status: "active"
      });
    }

    await Journal.insertMany(journalsToInsert);

    console.log(`Successfully seeded ${journalsToInsert.length} journals.`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding journals:", error);
    process.exit(1);
  }
}

seedJournals();
