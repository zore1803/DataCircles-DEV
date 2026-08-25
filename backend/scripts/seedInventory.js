const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Item = require("../models/Item");
const StockMovement = require("../models/StockMovement");

dotenv.config({ path: __dirname + "/../.env", quiet: true });

async function seedInventory() {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI not found in .env");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    const products = await Item.find({ type: "product" });
    
    if (products.length === 0) {
      console.log("No products found in the inventory.");
      process.exit(0);
    }

    let updatedCount = 0;

    for (const product of products) {
      const prev = product.inventory?.currentStock || 0;
      if (prev === 10) continue; // Skip if already 10

      const diff = 10 - prev;
      const direction = diff > 0 ? "in" : "out";
      
      product.inventory = {
        ...(product.inventory || {}),
        trackInventory: true,
        currentStock: 10,
        lastMovementAt: new Date()
      };
      
      await product.save();
      
      // Keep the audit trail perfect by logging a StockMovement
      await StockMovement.create({
        organization: product.organization, 
        item: product._id,
        direction,
        quantity: Math.abs(diff),
        previousStock: prev,
        newStock: 10,
        reason: "adjustment",
        notes: "Dev Seed: Forced stock to exactly 10",
        unitPrice: product.purchasePrice || 0
      });
      
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} products to have exactly 10 quantity in stock!`);
    process.exit(0);
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

seedInventory();
