require("dotenv").config({ path: __dirname + "/../.env" });
const mongoose = require("mongoose");
const PurchaseReturn = require("../models/PurchaseReturn");
const Purchase = require("../models/Purchase");
const Organization = require("../models/Organization");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Item = require("../models/Item");

const generateRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const seedPurchaseReturns = async () => {
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

    // Get an organization
    const org = await Organization.findOne();
    if (!org) {
      throw new Error("No organization found. Please seed the basic data first.");
    }

    const user = await User.findOne({ organization: org._id });
    const vendors = await Vendor.find({ organization: org._id });
    const items = await Item.find({ organization: org._id });
    const purchases = await Purchase.find({ organization: org._id });

    if (!vendors.length) throw new Error("No vendors found.");
    if (!items.length) throw new Error("No items found.");

    const purchaseReturnsToInsert = [];
    const numReturns = generateRandomNumber(40, 50);

    let prCounter = await PurchaseReturn.countDocuments({ organization: org._id }) + 1000;

    const reasons = ["Defective", "Damaged", "Wrong Item", "Excess Quantity", "Other"];
    const modes = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"];
    const statuses = ["Draft", "Pending", "Confirmed", "Paid", "Cancelled"];
    const stockMovementStatuses = ["pending", "applied", "reversed"];

    for (let i = 0; i < numReturns; i++) {
      prCounter++;
      
      let purchase = null;
      let vendor = null;
      let returnItems = [];
      let subtotal = 0;
      let gstRate = getRandomElement([0, 5, 12, 18, 28]);

      // 80% chance to tie to an existing purchase if purchases exist
      if (purchases.length > 0 && Math.random() > 0.2) {
        purchase = getRandomElement(purchases);
        vendor = purchase.vendor;
        
        // Return some items from this purchase
        const itemsToReturnCount = generateRandomNumber(1, purchase.items.length || 1);
        for (let j = 0; j < itemsToReturnCount; j++) {
          if (purchase.items[j]) {
            const qty = generateRandomNumber(1, Math.max(1, Math.floor(purchase.items[j].quantity / 2) || 1));
            const unitPrice = purchase.items[j].unitPrice;
            const total = qty * unitPrice;
            subtotal += total;

            returnItems.push({
              itemId: purchase.items[j].itemId,
              name: purchase.items[j].name,
              quantity: qty,
              unitPrice: unitPrice,
              total: total,
              reason: getRandomElement(reasons)
            });
          }
        }
      } else {
        vendor = getRandomElement(vendors)._id;
        // generate random items
        const itemsToReturnCount = generateRandomNumber(1, 4);
        for (let j = 0; j < itemsToReturnCount; j++) {
          const item = getRandomElement(items);
          const qty = generateRandomNumber(1, 10);
          const unitPrice = item.purchasePrice || generateRandomNumber(100, 1000);
          const total = qty * unitPrice;
          subtotal += total;

          returnItems.push({
            itemId: item._id,
            name: item.name,
            quantity: qty,
            unitPrice: unitPrice,
            total: total,
            reason: getRandomElement(reasons)
          });
        }
      }

      if (returnItems.length === 0) continue;

      const totalTax = (subtotal * gstRate) / 100;
      const grandTotal = subtotal + totalTax;
      
      const status = getRandomElement(statuses);

      purchaseReturnsToInsert.push({
        vendor: vendor,
        purchase: purchase ? purchase._id : null,
        returnNumber: `PR-${prCounter}`,
        returnDate: randomDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date()), // Last 90 days
        items: returnItems,
        subtotal: subtotal,
        transactionType: Math.random() > 0.5 ? "intra" : "inter",
        gstRate: gstRate,
        totalTax: totalTax,
        grandTotal: grandTotal,
        status: status,
        mode: status === "Paid" ? getRandomElement(modes) : "",
        reason: getRandomElement(reasons),
        notes: "Autoseeded purchase return record.",
        stockMovementStatus: status === "Confirmed" ? "applied" : getRandomElement(["pending", "reversed"]),
        user: user ? user._id : null,
        organization: org._id
      });
    }

    await PurchaseReturn.insertMany(purchaseReturnsToInsert);
    console.log(`Successfully seeded ${purchaseReturnsToInsert.length} Purchase Returns.`);

  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    mongoose.connection.close();
  }
};

seedPurchaseReturns();
