const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Company = require("../models/Company");
const Contact = require("../models/Contact");
const User = require("../models/User");
const CallLog = require("../models/CallLog");

dotenv.config({ path: __dirname + "/../.env", quiet: true });

async function seedCallLogs() {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not found in .env");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    const users = await User.find({}).limit(5);
    if (users.length === 0) {
      console.error("No users found to assign call logs to.");
      process.exit(1);
    }
    
    // Clear old call logs
    await CallLog.deleteMany({});
    console.log("Cleared existing call logs.");

    // Find specific company + some random ones
    const specificCompany = await Company.findOne({ name: /Amber Collective 143/i });
    const randomCompanies = await Company.find({}).limit(4);
    
    const companiesToSeed = [];
    if (specificCompany) companiesToSeed.push(specificCompany);
    for (const c of randomCompanies) {
      if (!companiesToSeed.find(existing => existing._id.equals(c._id))) {
        companiesToSeed.push(c);
      }
    }

    console.log(`Found ${companiesToSeed.length} specific companies to seed call logs for.`);

    const callLogsToInsert = [];

    const notesExamples = {
      Connected: [
        "Had a great conversation about the new product features. They are very interested.",
        "Discussed the upcoming renewal. They requested a slight discount, need to follow up with manager.",
        "Checked in on their implementation progress. Everything is going smoothly.",
        "They had some technical questions about the API integration. Answered most of them, sent documentation for the rest.",
        "Quarterly business review call. They are very happy with the service so far.",
        "Discussed adding 5 more seats to their license. Will send a quote shortly."
      ],
      Voicemail: [
        "Left a voicemail regarding the Q3 check-in.",
        "Left a voicemail to follow up on the proposal sent last week.",
        "Called to wish them happy holidays. Left a friendly voicemail."
      ],
      Missed: [
        "Tried calling but got disconnected immediately.",
        "No answer, will try again tomorrow morning."
      ],
      "No Answer": [
        "Rang for a full minute, no answer. Emailed instead.",
        "Called their direct line, no answer. Might be out of office."
      ]
    };

    for (const company of companiesToSeed) {
      const contacts = await Contact.find({ company: company._id });
      
      // Seed 8-15 call logs per company for a good timeline view
      let numLogs = Math.floor(Math.random() * 8) + 8;
      
      if (company.name.match(/Amber Collective 143/i)) {
        numLogs = Math.floor(Math.random() * 11) + 60; // 60 to 70 logs for Amber Collective
      }
      
      for (let i = 0; i < numLogs; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        let contactId = null;
        if (contacts.length > 0) {
          contactId = contacts[Math.floor(Math.random() * contacts.length)]._id;
        }

        const statuses = ["Connected", "Connected", "Connected", "Missed", "Voicemail", "No Answer"];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        const callTypes = ["Inbound", "Outbound", "Outbound", "Outbound"];
        const callType = callTypes[Math.floor(Math.random() * callTypes.length)];
        
        let duration = 0;
        if (status === "Connected") {
          duration = Math.floor(Math.random() * 1800) + 120; // 2 minutes to 30 minutes
        } else if (status === "Voicemail") {
          duration = Math.floor(Math.random() * 60) + 15; // 15s to 75s
        }

        const notesList = notesExamples[status];
        const notes = notesList[Math.floor(Math.random() * notesList.length)];

        // Generate a random date within the last 60 days
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 60));
        date.setHours(Math.floor(Math.random() * 10) + 8); // 8 AM to 6 PM
        date.setMinutes(Math.floor(Math.random() * 60));

        callLogsToInsert.push({
          company: company._id,
          contact: contactId,
          user: user._id,
          organization: company.organization,
          callType,
          status,
          duration,
          notes,
          createdAt: date,
          updatedAt: date
        });
      }
    }

    if (callLogsToInsert.length > 0) {
      await CallLog.insertMany(callLogsToInsert);
      console.log(`\nSuccessfully seeded ${callLogsToInsert.length} call logs instantly.`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

seedCallLogs();
