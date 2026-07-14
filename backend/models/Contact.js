// models/Contact.js
const mongoose = require("mongoose");

const additionalFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed, // Can store string, number, or any value
  type: {
    type: String,
    enum: [
      "string",
      "number",
      "dropdown",
      "text",
      "url",
      "date",
      "multiselect",
    ],
    default: "text",
  },
  // 👉 ADDED: This stores the category name that this field belongs to
  category: { 
    type: String,
    default: 'Uncategorized' 
  }
});

const socialMediaSchema = new mongoose.Schema(
  {
    twitter: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    facebook: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
  },
  { _id: false },
);

const contactSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },

    // Replace 'tag' with lifecycle stage system
    lifecycleStage: {
      type: String,
      enum: ["Lead", "Sales Qualified Lead", "Customer"],
      default: "Lead",
      required: true,
    },
    stageStatus: {
      type: String,
      enum: [
        "New",
        "Contacted",
        "Interested",
        "Unqualified",
        "Qualified",
        "Lost",
        "Won",
        "Churned",
      ],
      required: true,
      default: "New",
    },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    }, // ADDED BY (Immutable)
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // UPDATED BY (Mutable)
    avatar: { type: String },
    socialMedia: {
      type: socialMediaSchema,
      default: () => ({}),
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    additionalFields: [additionalFieldSchema],
  },
  { timestamps: true },
);

// Validation to ensure stageStatus is valid for the lifecycleStage
contactSchema.pre("save", function (next) {
  const stageStatusMap = {
    Lead: ["New", "Contacted", "Interested", "Unqualified"],
    "Sales Qualified Lead": ["Qualified", "Lost"],
    Customer: ["Won", "Churned"],
  };

  if (!stageStatusMap[this.lifecycleStage].includes(this.stageStatus)) {
    return next(
      new Error(
        `Invalid stageStatus '${this.stageStatus}' for lifecycleStage '${this.lifecycleStage}'`,
      ),
    );
  }
  next();
});

module.exports = mongoose.model("Contact", contactSchema);