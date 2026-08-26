require("dotenv").config({ path: __dirname + "/../.env" });
const mongoose = require("mongoose");
const SalesOrder = require("../models/SalesOrder");
const Deal = require("../models/Deal");
const Organization = require("../models/Organization");
const User = require("../models/User");
const Item = require("../models/Item");

const generateRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const seedSalesOrders = async () => {
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

    if (!deals.length) throw new Error("No deals found.");
    if (!items.length) throw new Error("No items found.");
    if (!user) throw new Error("No users found.");

    const salesOrdersToInsert = [];
    const numOrders = generateRandomNumber(40, 50);
    let soCounter = await SalesOrder.countDocuments({ organization: org._id }) + 1000;

    const statuses = ["Draft", "Confirmed", "Cancelled"];
    
    for (let i = 0; i < numOrders; i++) {
      soCounter++;
      
      const deal = getRandomElement(deals);
      
      // Select 1-4 random items
      const orderItems = [];
      const itemsCount = generateRandomNumber(1, 4);
      let subtotal = 0;
      let totalTax = 0;

      for (let j = 0; j < itemsCount; j++) {
        const item = getRandomElement(items);
        const quantity = generateRandomNumber(1, 10);
        const rate = item.sellingPrice || generateRandomNumber(100, 1000);
        const gstRate = getRandomElement([0, 5, 12, 18, 28]);
        
        // No item discount for simplicity
        const discountType = "amount";
        const discount = 0;

        const lineTotalPreTax = quantity * rate;
        const lineTax = (lineTotalPreTax * gstRate) / 100;

        subtotal += lineTotalPreTax;
        totalTax += lineTax;

        orderItems.push({
          itemId: item._id,
          name: item.name,
          description: item.description || "Sample item description",
          rate: rate,
          quantity: quantity,
          hsn: item.hsnCode || "",
          discountType: discountType,
          discount: discount,
          gstRate: gstRate,
          taxInclusive: false
        });
      }

      // Document level discount
      const docDiscountType = Math.random() > 0.5 ? "fixed" : "percentage";
      const docDiscountValue = docDiscountType === "fixed" ? generateRandomNumber(0, 500) : generateRandomNumber(0, 15);
      
      let discountAmt = 0;
      if (docDiscountType === "percentage") {
        discountAmt = (subtotal * docDiscountValue) / 100;
      } else {
        discountAmt = docDiscountValue;
      }

      let grandTotal = subtotal - discountAmt + totalTax;
      if (grandTotal < 0) grandTotal = 0;

      const date = randomDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), new Date());
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + generateRandomNumber(7, 30));

      const address = {
        addressLine1: "123 Business Rd",
        addressLine2: "Suite " + generateRandomNumber(100, 999),
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India"
      };

      salesOrdersToInsert.push({
        deal: deal._id,
        salesOrderPrefix: "SO-",
        salesOrderNumber: `${soCounter}`,
        reference: `REF-${generateRandomNumber(1000, 9999)}`,
        date: date,
        dueDate: dueDate,
        amount: Math.round(grandTotal),
        user: user._id,
        organization: org._id,
        status: getRandomElement(statuses),
        billingAddress: address,
        shippingAddress: address,
        discount: {
          type: docDiscountType,
          value: docDiscountValue
        },
        notes: "Autoseeded sales order record.",
        terms: "Payment due within 30 days.",
        isRoundOff: true,
        transactionType: Math.random() > 0.5 ? "intra" : "inter",
        signatureType: "text",
        signature: "Authorized Signatory",
        items: orderItems
      });
    }

    await SalesOrder.insertMany(salesOrdersToInsert);
    console.log(`Successfully seeded ${salesOrdersToInsert.length} Sales Orders.`);

  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    mongoose.connection.close();
  }
};

seedSalesOrders();
