require("dotenv").config({ path: __dirname + "/../.env" });
const mongoose = require("mongoose");
const SalesReturn = require("../models/SalesReturn");
const Invoice = require("../models/Invoice");
const Deal = require("../models/Deal");
const Organization = require("../models/Organization");
const User = require("../models/User");
const Item = require("../models/Item");

const generateRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const seedSalesReturns = async () => {
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
    const items = await Item.find({ organization: org._id });
    const deals = await Deal.find({ organization: org._id });
    const invoices = await Invoice.find({ organization: org._id });

    if (!deals.length) throw new Error("No deals found.");
    if (!items.length) throw new Error("No items found.");
    if (!user) throw new Error("No users found.");

    const salesReturnsToInsert = [];
    const numReturns = generateRandomNumber(40, 60);

    let srCounter = await SalesReturn.countDocuments({ organization: org._id }) + 1000;

    const reasons = ["Damaged", "Defective", "Wrong Item", "Wrong Size/Variant", "Customer Changed Mind", "Other"];
    const statuses = ["Draft", "Pending", "Confirmed", "Refunded", "Cancelled"];
    const refundModes = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Credit Note", "Other"];

    for (let i = 0; i < numReturns; i++) {
      srCounter++;
      
      let invoice = null;
      let deal = null;
      let returnItems = [];
      let subtotal = 0;
      let gstRate = getRandomElement([0, 5, 12, 18, 28]);

      // 80% chance to tie to an existing invoice if invoices exist
      if (invoices.length > 0 && Math.random() > 0.2) {
        invoice = getRandomElement(invoices);
        deal = invoice.deal;
        
        // Return some items from this invoice
        const itemsToReturnCount = generateRandomNumber(1, invoice.items?.length || 1);
        for (let j = 0; j < itemsToReturnCount; j++) {
          if (invoice.items && invoice.items[j]) {
            const maxQty = invoice.items[j].quantity || 1;
            const qty = generateRandomNumber(1, Math.max(1, Math.floor(maxQty / 2) || 1));
            // Invoices usually use rate, but SalesReturn uses unitPrice
            const unitPrice = invoice.items[j].rate || invoice.items[j].unitPrice || 0;
            const total = qty * unitPrice;
            subtotal += total;

            returnItems.push({
              itemId: invoice.items[j].itemId,
              name: invoice.items[j].name,
              quantity: qty,
              unitPrice: unitPrice,
              total: total,
              gstRate: invoice.items[j].gstRate || gstRate,
              reason: getRandomElement(reasons)
            });
          }
        }
      } else {
        deal = getRandomElement(deals)._id;
        // generate random items
        const itemsToReturnCount = generateRandomNumber(1, 4);
        for (let j = 0; j < itemsToReturnCount; j++) {
          const item = getRandomElement(items);
          const qty = generateRandomNumber(1, 10);
          const unitPrice = item.sellingPrice || generateRandomNumber(100, 1000);
          const total = qty * unitPrice;
          subtotal += total;

          returnItems.push({
            itemId: item._id,
            name: item.name,
            quantity: qty,
            unitPrice: unitPrice,
            total: total,
            gstRate: gstRate,
            reason: getRandomElement(reasons)
          });
        }
      }

      // Skip if somehow no items were added
      if (returnItems.length === 0) continue;

      const totalTax = (subtotal * gstRate) / 100;
      const grandTotal = subtotal + totalTax;
      
      const status = getRandomElement(statuses);

      salesReturnsToInsert.push({
        deal: deal,
        invoice: invoice ? invoice._id : null,
        returnNumber: `SR-${srCounter}`,
        returnDate: randomDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()), // Last 90 days
        items: returnItems,
        subtotal: subtotal,
        transactionType: Math.random() > 0.5 ? "intra" : "inter",
        gstRate: gstRate,
        totalTax: totalTax,
        grandTotal: grandTotal,
        status: status,
        refundMode: status === "Refunded" ? getRandomElement(refundModes) : "",
        reason: getRandomElement(reasons),
        notes: "Autoseeded sales return record.",
        stockMovementStatus: status === "Confirmed" ? "applied" : getRandomElement(["pending", "reversed"]),
        user: user._id,
        organization: org._id
      });
    }

    await SalesReturn.insertMany(salesReturnsToInsert);
    console.log(`Successfully seeded ${salesReturnsToInsert.length} Sales Returns.`);

  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    mongoose.connection.close();
  }
};

seedSalesReturns();
