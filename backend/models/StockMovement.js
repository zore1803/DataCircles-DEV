// models/StockMovement.js
// Append-only ledger of every stock change for an Item. This collection — not
// Item.inventory.currentStock — is the source of truth for inventory history: each row records
// the stock level before and after, so a drifted running total can always be recomputed and any
// change can be traced back to who made it and why.
//
// Rows are never edited or deleted in normal operation. Correcting a mistake means recording a
// compensating movement ("adjustment"), which keeps the audit trail intact.
const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      index: true,
    },

    // "in" adds stock (purchase, return, correction up), "out" removes it (sale, damage,
    // correction down). Sign is carried by this field; `quantity` is always positive.
    direction: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.000001, "Quantity must be greater than zero"],
    },

    // Stock level immediately before and after this movement, captured inside the same
    // transaction that wrote it. Stored rather than recomputed so history stays readable even
    // if an item's stock is later adjusted by other means.
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },

    // Why the stock moved. Kept as a small enum so the ledger can be grouped/reported on,
    // with `notes` for the free-text detail.
    reason: {
      type: String,
      enum: [
        "purchase",
        "sale",
        "return",
        "damage",
        "opening_stock",
        "adjustment",
        "transfer",
        "other",
      ],
      default: "other",
    },
    notes: { type: String, default: "" },

    // Free-text label the user picks (or types) for why the stock moved. `reason` above stays
    // the small enum that reports group on; this keeps whatever wording the user actually chose,
    // including org-specific categories the enum has no value for.
    category: { type: String, default: "" },

    // When the movement actually happened, as opposed to `createdAt` (when it was keyed in).
    // Backdating a movement is normal — stock is often recorded after the fact.
    recordDate: { type: Date, default: Date.now },

    // Optional pointer to whatever document caused this movement (invoice number, PO number,
    // challan number...). Free-text on purpose: movements can originate from documents this
    // model shouldn't need a hard reference to.
    referenceNumber: { type: String, default: "" },

    // Per-unit price at the time of the movement, so historical stock value stays accurate even
    // after the item's own price changes. Defaults are filled from the item at write time.
    unitPrice: { type: Number, default: 0 },

    // Whether `unitPrice` is tax-inclusive, so P&L reporting doesn't have to guess.
    priceIncludesTax: { type: Boolean, default: false },

    // quantity × unitPrice at the time of the movement. Stored rather than recomputed so the
    // historical value survives later price changes, same reasoning as unitPrice itself.
    totalValue: { type: Number, default: 0 },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// The item's movement history, newest first — the primary read pattern.
stockMovementSchema.index({ organization: 1, item: 1, createdAt: -1 });
// Org-wide recent activity feed.
stockMovementSchema.index({ organization: 1, createdAt: -1 });

module.exports = mongoose.model("StockMovement", stockMovementSchema);
