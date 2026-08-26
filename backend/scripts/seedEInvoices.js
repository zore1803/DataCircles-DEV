require("dotenv").config({ path: __dirname + "/../.env" });
const mongoose = require("mongoose");
const EInvoice = require("../models/EInvoice");
const Invoice = require("../models/Invoice");
const Deal = require("../models/Deal");
const Organization = require("../models/Organization");
const User = require("../models/User");

const generateRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const pad = (n, len) => String(n).padStart(len, "0");

const generateIRN = () => {
  const chars = "0123456789abcdef";
  let irn = "";
  for (let i = 0; i < 64; i++) irn += chars[generateRandomNumber(0, 15)];
  return irn;
};

const generateAckNo = () => String(generateRandomNumber(100000000000, 999999999999));

const seedEInvoices = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing in .env file");
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    const org = await Organization.findOne();
    if (!org) {
      throw new Error("No organization found. Please seed the basic data first.");
    }

    const user = await User.findOne({ organization: org._id });
    if (!user) throw new Error("No users found.");

    const deals = await Deal.find({ organization: org._id });
    const invoices = await Invoice.find({ organization: org._id });

    const statuses = ["Success", "Success", "Success", "Pending", "Failed", "Cancelled"];
    const failureReasons = [
      "Invalid GSTIN of recipient",
      "Duplicate IRN request",
      "Invalid HSN code",
      "Total amount mismatch",
    ];

    const eInvoicesToInsert = [];
    const numEInvoices = generateRandomNumber(40, 60);

    for (let i = 0; i < numEInvoices; i++) {
      const status = getRandomElement(statuses);
      const date = randomDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date());

      let invoiceRef = null;
      let dealRef = null;
      let invoiceNumber;
      let customerName;
      let amount;

      if (invoices.length > 0 && Math.random() > 0.15) {
        const invoice = getRandomElement(invoices);
        invoiceRef = invoice._id;
        dealRef = invoice.deal;
        invoiceNumber = invoice.invoiceNumber;
        amount = invoice.amount || generateRandomNumber(1000, 100000);
      } else {
        if (deals.length > 0) dealRef = getRandomElement(deals)._id;
        invoiceNumber = `INV-${pad(1000 + i, 5)}`;
        amount = generateRandomNumber(1000, 100000);
      }

      const deal = dealRef ? deals.find((d) => String(d._id) === String(dealRef)) : null;
      customerName = deal?.name || deal?.dealName || `Customer ${i + 1}`;

      const record = {
        invoice: invoiceRef,
        deal: dealRef,
        invoiceNumber,
        customer: { name: customerName, gstin: "" },
        amount,
        date,
        status,
        user: user._id,
        organization: org._id,
      };

      if (status === "Success" || status === "Cancelled") {
        record.irn = generateIRN();
        record.ackNo = generateAckNo();
        record.ackDate = date;
        record.qrCode = "";
      }

      if (status === "Failed") {
        record.failureReason = getRandomElement(failureReasons);
      }

      eInvoicesToInsert.push(record);
    }

    await EInvoice.insertMany(eInvoicesToInsert);
    console.log(`Successfully seeded ${eInvoicesToInsert.length} E-Invoices.`);
  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    mongoose.connection.close();
  }
};

seedEInvoices();
