require("dotenv").config({ path: "../.env" });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const PurchaseOrder = require("../models/PurchaseOrder");
const Vendor = require("../models/Vendor");
const Item = require("../models/Item");
const Organization = require("../models/Organization");
const User = require("../models/User");

const seedPurchases = async () => {
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

    console.log(`Found ${vendors.length} vendors and ${items.length} items. Clearing old data and generating 40 seeds...`);

    await PurchaseOrder.deleteMany({ organization: orgId });
    await Purchase.deleteMany({ organization: orgId });

    const statuses = ["Draft", "Pending", "Paid", "Partial", "Cancelled"];
    const poStatuses = ["Pending", "Approved", "Rejected", "Delivered"];
    const gstRates = [0, 5, 12, 18, 28];
    const transTypes = ["intra", "inter"];
    
    let createdPOs = 0;
    let createdPurchases = 0;

    // Create 100 records
    for (let i = 1; i <= 100; i++) {
      // Pick random vendor
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      
      // Pick 1 to 4 random items
      const numItems = Math.floor(Math.random() * 4) + 1;
      const orderItems = [];
      let subtotal = 0;

      for (let j = 0; j < numItems; j++) {
        const item = items[Math.floor(Math.random() * items.length)];
        
        // Handle variants if they exist
        let variantId = undefined;
        let itemName = item.name;
        let itemPrice = item.sellingPrice || 100;
        let itemSku = item.sku || "";

        if (item.variants && item.variants.length > 0) {
          const variant = item.variants[Math.floor(Math.random() * item.variants.length)];
          variantId = variant._id;
          itemName = `${item.name} - ${variant.name}`;
          itemPrice = variant.sellingPrice || itemPrice;
          itemSku = variant.sku || itemSku;
        }

        const quantity = Math.floor(Math.random() * 10) + 1;
        const total = quantity * itemPrice;
        subtotal += total;

        orderItems.push({
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

      // Generate Purchase Order
      const poNumber = `PO-${String(Math.floor(Math.random() * 90000) + 10000)}`;
      const orderDate = new Date(Date.now() - Math.floor(Math.random() * 10000000000));
      
      const po = new PurchaseOrder({
        vendor: vendor._id,
        poNumber,
        orderDate,
        items: orderItems,
        totalAmount: grandTotal, // kept for backward compatibility
        subtotal,
        transactionType,
        gstRate,
        totalTax,
        grandTotal,
        paymentTerms: "Net 30",
        status: poStatuses[Math.floor(Math.random() * poStatuses.length)],
        user: userId,
        organization: orgId,
      });

      await po.save();
      createdPOs++;

      // Generate related Purchase Bill (80% chance to have a bill)
      if (Math.random() > 0.2) {
        const purchaseNumber = `BILL-${String(Math.floor(Math.random() * 90000) + 10000)}`;

        const purchase = new Purchase({
          vendor: vendor._id,
          purchaseOrder: po._id,
          purchaseNumber,
          purchaseDate: new Date(orderDate.getTime() + Math.floor(Math.random() * 86400000 * 5)), // 0-5 days after PO
          items: orderItems,
          subtotal,
          transactionType,
          gstRate,
          totalTax,
          grandTotal,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          user: userId,
          organization: orgId,
        });

        await purchase.save();
        createdPurchases++;
      }
    }

    console.log(`\nSuccess! Seeded ${createdPOs} Purchase Orders and ${createdPurchases} Purchases.`);
    process.exit(0);

  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedPurchases();
