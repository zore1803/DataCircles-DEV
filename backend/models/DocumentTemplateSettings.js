const mongoose = require("mongoose");

/*
 * Per-organization defaults for how accounting documents are *rendered*.
 * Distinct from DocumentSettings, which owns document *numbering*
 * (prefixes/suffixes/next number) — separate models, separate collections.
 * Currently just the template each document type uses; kept as its own model
 * (rather than folded into Branding) because Branding's routes sit behind
 * multipart upload middleware, and this is a plain JSON preference.
 */
const TEMPLATES = [
  "Classic",
  "Modern",
  "Minimal",
  "Elegant",
  "Compact",
  "Corporate",
  "Vibrant",
  "Mono",
  "Vintage",
  "Professional",
  "Landscape",
  "Service",
];

const templateField = {
  type: String,
  enum: TEMPLATES,
  default: "Classic",
};

const documentTemplateSettingsSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    templates: {
      tax: templateField,
      performa: templateField,
      quotation: templateField,
      deliveryChallan: templateField,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "DocumentTemplateSettings",
  documentTemplateSettingsSchema
);
module.exports.TEMPLATES = TEMPLATES;
