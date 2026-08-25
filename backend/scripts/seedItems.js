require("dotenv").config({ path: "../.env" });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require("mongoose");
const Item = require("../models/Item");
const Organization = require("../models/Organization");
const User = require("../models/User");

const seedItems = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    // Find any organization to attach the items to
    const org = await Organization.findOne();
    if (!org) {
      console.error("No organization found. Please create an organization first.");
      process.exit(1);
    }
    console.log(`Using Organization ID: ${org._id}`);

    // Optional: Find a user to attach to
    const user = await User.findOne();
    const userId = user ? user._id : undefined;

    const baseProducts = [
      { name: "Smartphone", type: "product", purchasePrice: 500, sellingPrice: 700, hsnSac: "8517", category: "Electronics", gstRate: 18 },
      { name: "Cloud Hosting", type: "service", purchasePrice: 200, sellingPrice: 300, hsnSac: "9983", category: "Software", gstRate: 18 },
      { name: "Tablet", type: "product", purchasePrice: 250, sellingPrice: 350, hsnSac: "8471", category: "Electronics", gstRate: 18 },
      { name: "Desk Chair", type: "product", purchasePrice: 150, sellingPrice: 250, hsnSac: "9403", category: "Furniture", gstRate: 18 },
      { name: "Consulting", type: "service", purchasePrice: 1000, sellingPrice: 1500, hsnSac: "9983", category: "Professional", gstRate: 18 },
      { name: "Laptop", type: "product", purchasePrice: 800, sellingPrice: 1000, hsnSac: "8471", category: "Electronics", gstRate: 18 },
      { name: "Wireless Mouse", type: "product", purchasePrice: 15, sellingPrice: 30, hsnSac: "8471", category: "Electronics", gstRate: 18 },
      { name: "Mechanical Keyboard", type: "product", purchasePrice: 40, sellingPrice: 80, hsnSac: "8471", category: "Electronics", gstRate: 18 },
      { name: "Monitor", type: "product", purchasePrice: 120, sellingPrice: 180, hsnSac: "8528", category: "Electronics", gstRate: 18 },
      { name: "Web Development", type: "service", purchasePrice: 5000, sellingPrice: 7500, hsnSac: "9983", category: "Software", gstRate: 18 },
      { name: "SEO Audit", type: "service", purchasePrice: 300, sellingPrice: 500, hsnSac: "9983", category: "Marketing", gstRate: 18 },
      { name: "Graphic Design", type: "service", purchasePrice: 200, sellingPrice: 350, hsnSac: "9983", category: "Design", gstRate: 18 },
      { name: "Office Desk", type: "product", purchasePrice: 200, sellingPrice: 350, hsnSac: "9403", category: "Furniture", gstRate: 18 },
      { name: "Ergonomic Chair", type: "product", purchasePrice: 250, sellingPrice: 400, hsnSac: "9403", category: "Furniture", gstRate: 18 },
      { name: "Bookshelf", type: "product", purchasePrice: 80, sellingPrice: 120, hsnSac: "9403", category: "Furniture", gstRate: 18 },
      { name: "Notebook", type: "product", purchasePrice: 2, sellingPrice: 5, hsnSac: "4820", category: "Stationery", gstRate: 12 },
      { name: "Pens (Box of 50)", type: "product", purchasePrice: 10, sellingPrice: 20, hsnSac: "9608", category: "Stationery", gstRate: 12 },
      { name: "Stapler", type: "product", purchasePrice: 5, sellingPrice: 10, hsnSac: "8472", category: "Stationery", gstRate: 18 },
      { name: "Copy Paper (Ream)", type: "product", purchasePrice: 4, sellingPrice: 8, hsnSac: "4802", category: "Stationery", gstRate: 12 },
      { name: "Server Maintenance", type: "service", purchasePrice: 800, sellingPrice: 1200, hsnSac: "9983", category: "IT Support", gstRate: 18 },
      { name: "Data Backup", type: "service", purchasePrice: 100, sellingPrice: 150, hsnSac: "9983", category: "IT Support", gstRate: 18 },
      { name: "Network Setup", type: "service", purchasePrice: 1500, sellingPrice: 2200, hsnSac: "9983", category: "IT Support", gstRate: 18 },
      { name: "Coffee Machine", type: "product", purchasePrice: 300, sellingPrice: 450, hsnSac: "8516", category: "Appliances", gstRate: 18 },
      { name: "Water Dispenser", type: "product", purchasePrice: 150, sellingPrice: 220, hsnSac: "8418", category: "Appliances", gstRate: 18 },
      { name: "Microwave Oven", type: "product", purchasePrice: 100, sellingPrice: 160, hsnSac: "8516", category: "Appliances", gstRate: 18 },
      { name: "Cleaning Service (Monthly)", type: "service", purchasePrice: 400, sellingPrice: 600, hsnSac: "9985", category: "Facilities", gstRate: 18 },
      { name: "Security Guard Service", type: "service", purchasePrice: 1500, sellingPrice: 2000, hsnSac: "9985", category: "Facilities", gstRate: 18 },
      { name: "Pest Control", type: "service", purchasePrice: 150, sellingPrice: 250, hsnSac: "9985", category: "Facilities", gstRate: 18 },
      { name: "Safety Shoes", type: "product", purchasePrice: 40, sellingPrice: 70, hsnSac: "6403", category: "Safety", gstRate: 18 },
      { name: "Hard Hat", type: "product", purchasePrice: 10, sellingPrice: 20, hsnSac: "6506", category: "Safety", gstRate: 18 },
      { name: "Safety Goggles", type: "product", purchasePrice: 5, sellingPrice: 12, hsnSac: "9004", category: "Safety", gstRate: 18 },
      { name: "First Aid Kit", type: "product", purchasePrice: 25, sellingPrice: 45, hsnSac: "3006", category: "Safety", gstRate: 12 },
      { name: "Legal Consultation", type: "service", purchasePrice: 2000, sellingPrice: 3000, hsnSac: "9982", category: "Legal", gstRate: 18 },
      { name: "Contract Drafting", type: "service", purchasePrice: 500, sellingPrice: 800, hsnSac: "9982", category: "Legal", gstRate: 18 },
      { name: "Accounting Audit", type: "service", purchasePrice: 3000, sellingPrice: 4500, hsnSac: "9982", category: "Financial", gstRate: 18 },
      { name: "Tax Filing", type: "service", purchasePrice: 400, sellingPrice: 650, hsnSac: "9982", category: "Financial", gstRate: 18 },
      { name: "Payroll Management", type: "service", purchasePrice: 800, sellingPrice: 1100, hsnSac: "9982", category: "Financial", gstRate: 18 },
      { name: "Marketing Campaign", type: "service", purchasePrice: 4000, sellingPrice: 6000, hsnSac: "9983", category: "Marketing", gstRate: 18 },
      { name: "Social Media Ads", type: "service", purchasePrice: 1000, sellingPrice: 1400, hsnSac: "9983", category: "Marketing", gstRate: 18 },
      { name: "Content Writing", type: "service", purchasePrice: 200, sellingPrice: 350, hsnSac: "9983", category: "Marketing", gstRate: 18 },
      { name: "Video Production", type: "service", purchasePrice: 3000, sellingPrice: 5000, hsnSac: "9983", category: "Marketing", gstRate: 18 },
      { name: "Projector", type: "product", purchasePrice: 400, sellingPrice: 600, hsnSac: "8528", category: "Electronics", gstRate: 18 },
      { name: "Whiteboard", type: "product", purchasePrice: 60, sellingPrice: 100, hsnSac: "9610", category: "Office Supplies", gstRate: 18 },
      { name: "Markers (Set of 10)", type: "product", purchasePrice: 8, sellingPrice: 15, hsnSac: "9608", category: "Office Supplies", gstRate: 12 },
      { name: "Laser Printer", type: "product", purchasePrice: 200, sellingPrice: 350, hsnSac: "8443", category: "Electronics", gstRate: 18 },
      { name: "Printer Toner", type: "product", purchasePrice: 50, sellingPrice: 85, hsnSac: "8443", category: "Electronics", gstRate: 18 },
      { name: "Paper Shredder", type: "product", purchasePrice: 80, sellingPrice: 130, hsnSac: "8472", category: "Electronics", gstRate: 18 },
      { name: "Filing Cabinet", type: "product", purchasePrice: 120, sellingPrice: 190, hsnSac: "9403", category: "Furniture", gstRate: 18 },
      { name: "Desk Lamp", type: "product", purchasePrice: 25, sellingPrice: 45, hsnSac: "9405", category: "Office Supplies", gstRate: 18 },
      { name: "USB Flash Drive 64GB", type: "product", purchasePrice: 8, sellingPrice: 15, hsnSac: "8523", category: "Electronics", gstRate: 18 }
    ];

    const itemsToInsert = baseProducts.map(p => ({
      ...p,
      organization: org._id,
      user: userId,
      primaryUnit: p.type === "product" ? "NOS NUMBERS" : "OTH OTHERS",
      variants: p.type === "product" ? [
        { name: "Standard", purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice, stock: 100, gstRate: p.gstRate }
      ] : []
    }));

    console.log(`Prepared ${itemsToInsert.length} items for insertion...`);
    
    // Optional: Clear existing
    // await Item.deleteMany({ organization: org._id });
    
    const inserted = await Item.insertMany(itemsToInsert);
    console.log(`Successfully added ${inserted.length} items.`);

  } catch (error) {
    console.error("Error seeding items:", error);
  } finally {
    mongoose.connection.close();
    console.log("Database connection closed.");
    process.exit(0);
  }
};

seedItems();
