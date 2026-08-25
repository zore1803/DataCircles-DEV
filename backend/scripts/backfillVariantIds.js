// One-off migration: assign a permanent _id to every existing Item variant that doesn't
// have one yet.
//
// Item.js's variantSchema used to be declared with `{ _id: false }`, so no variant ever got
// a persisted _id. Worse, Mongoose's default `_id` generation regenerates a *new* random
// ObjectId every time such a document is loaded from the DB (verified: hydrating the same
// raw document twice produces two different ids), so `variantId` sent by the frontend never
// reliably matched a variant on the backend. Now that the schema declares a real `_id` path,
// this script writes a stable, permanent id into every variant that's still missing one, so
// existing items don't keep getting a fresh (and different) id on every read.
//
// Reads with .lean() deliberately — that bypasses Mongoose's schema-default hydration, so it
// reflects exactly what's stored in Mongo, not a phantom generated id.
require("dotenv").config({ path: "../.env" });
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const mongoose = require("mongoose");
const Item = require("../models/Item");

const backfillVariantIds = async () => {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    const items = await Item.find({ "variants.0": { $exists: true } })
      .select("_id variants")
      .lean();

    let itemsTouched = 0;
    let variantsBackfilled = 0;

    for (const item of items) {
      let changed = false;
      const variants = (item.variants || []).map((variant) => {
        if (variant._id) return variant;
        changed = true;
        variantsBackfilled += 1;
        return { ...variant, _id: new mongoose.Types.ObjectId() };
      });

      if (!changed) continue;

      await Item.updateOne({ _id: item._id }, { $set: { variants } });
      itemsTouched += 1;
    }

    console.log(
      `Done. Backfilled ${variantsBackfilled} variant id(s) across ${itemsTouched} item(s) (${items.length} items had variants).`
    );
    process.exit(0);
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exit(1);
  }
};

backfillVariantIds();
