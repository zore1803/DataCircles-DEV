require("dotenv").config({ path: "../.env" });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require("mongoose");
const PurchaseReturn = require("../models/PurchaseReturn");
const Vendor = require("../models/Vendor");
const Item = require("../models/Item");
const Organization = require("../models/Organization");
const User = require("../models/User");

const seedPurchaseReturns = async () => {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    // Get an organization
    const org = await Organization.findOne();
    if (!org) {
      console.error("No organization found. Please run the main seeder first.");
      process.exit(1);
    }
    const orgId = org._id;

    // Get a user
    const user = await User.findOne({ organization: orgId }) || await User.findOne();
    const userId = user ? user._id : null;

    // Get vendors
    const vendors = await Vendor.find({ organization: orgId });
    if (vendors.length === 0) {
      console.error("No vendors found. Please create some vendors first.");
      process.exit(1);
    }

    // Get items
    const items = await Item.find({ organization: orgId });
    if (items.length === 0) {
      console.error("No items found. Please create some items first.");
      process.exit(1);
    }

    console.log(`Found ${vendors.length} vendors and ${items.length} items. Clearing old data and generating 20 purchase returns...`);

    await PurchaseReturn.deleteMany({ organization: orgId });

    const statuses = ["Draft", "Pending", "Paid", "Cancelled"];
    const modes = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"];
    const gstRates = [0, 5, 12, 18, 28];
    const transTypes = ["intra", "inter"];
    const reasons = ["Defective", "Not required", "Wrong item", "Damaged in transit", "Quality issue"];
    
    let createdReturns = 0;

    // Create 20 records
    for (let i = 1; i <= 20; i++) {
      // Pick random vendor
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      
      // Pick 1 to 3 random items
      const numItems = Math.floor(Math.random() * 3) + 1;
      const returnItems = [];
      let subtotal = 0;

      for (let j = 0; j < numItems; j++) {
        const item = items[Math.floor(Math.random() * items.length)];
        
        let variantId = undefined;
        let itemName = item.name;
        let itemPrice = item.purchasePrice || 100;
        let itemSku = item.sku || "";

        if (item.variants && item.variants.length > 0) {
          const variant = item.variants[Math.floor(Math.random() * item.variants.length)];
          variantId = variant._id;
          itemName = `${item.name} - ${variant.name}`;
          itemPrice = variant.purchasePrice || itemPrice;
          itemSku = variant.sku || itemSku;
        }

        const quantity = Math.floor(Math.random() * 5) + 1;
        const total = quantity * itemPrice;
        subtotal += total;

        returnItems.push({
          itemId: item._id,
          variantId,
          name: itemName,
          quantity,
          unitPrice: itemPrice,
          total,
          sku: itemSku,
        });
      }

      // Calculate GST
      const gstRate = gstRates[Math.floor(Math.random() * gstRates.length)];
      const transactionType = transTypes[Math.floor(Math.random() * transTypes.length)];
      const totalTax = (subtotal * gstRate) / 100;
      const grandTotal = subtotal + totalTax;

      // Generate Purchase Return
      const returnNumber = `PR-${String(Math.floor(Math.random() * 90000) + 10000)}`;
      const returnDate = new Date(Date.now() - Math.floor(Math.random() * 10000000000));
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const mode = status === "Paid" ? modes[Math.floor(Math.random() * modes.length)] : "";
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      
      const pr = new PurchaseReturn({
        vendor: vendor._id,
        returnNumber,
        returnDate,
        items: returnItems,
        subtotal,
        transactionType,
        gstRate,
        totalTax,
        grandTotal,
        status,
        mode,
        reason,
        notes: "Automated seed data",
        user: userId,
        organization: orgId,
      });

      await pr.save();
      createdReturns++;
    }

    console.log(`\nSuccess! Seeded ${createdReturns} Purchase Returns.`);
    process.exit(0);

  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedPurchaseReturns();
