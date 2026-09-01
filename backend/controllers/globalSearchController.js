const Company = require("../models/Company");
const Contact = require("../models/Contact");
const Deal = require("../models/Deal");
const Vendor = require("../models/Vendor");
const Note = require("../models/Note");
const Invoice = require("../models/Invoice");
const { cacheGetOrSet } = require("../cacheHelper");

exports.globalSearch = async (req, res) => {
  try {
    const { search, lifecycleStage, stageStatus } = req.query;
    const orgId = req.user.organization;
    const cacheKey = `globalSearch:v2:${orgId}:${search || ""}:${
      lifecycleStage || ""
    }:${stageStatus || ""}`;

    const data = await cacheGetOrSet(cacheKey, 60, async () => {
      // Build queries for each collection
      const companyQuery = { organization: orgId };
      if (search) {
        companyQuery.$or = [
          { name: { $regex: search, $options: "i" } },
          { industry: { $regex: search, $options: "i" } },
          { gstin: { $regex: search, $options: "i" } },
          { website: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
          { "additionalFields.value": { $regex: search, $options: "i" } },
        ];
      }

      const contactQuery = { organization: orgId };
      if (search) {
        contactQuery.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { "additionalFields.value": { $regex: search, $options: "i" } },
        ];
      }
      if (lifecycleStage) contactQuery.lifecycleStage = lifecycleStage;
      if (stageStatus) contactQuery.stageStatus = stageStatus;

      const dealQuery = { organization: orgId };
      if (search) {
        dealQuery.$or = [
          { title: { $regex: search, $options: "i" } },
          { status: { $regex: search, $options: "i" } },
          { "additionalFields.value": { $regex: search, $options: "i" } },
        ];
      }

      const vendorQuery = { organization: orgId };
      if (search) {
        vendorQuery.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { company: { $regex: search, $options: "i" } },
          { gstin: { $regex: search, $options: "i" } },
          { "additionalFields.value": { $regex: search, $options: "i" } },
        ];
      }

      // Notes match on their title and body text, plus the note type, so
      // searching e.g. "call summary" finds notes filed under that type.
      const noteQuery = { organization: orgId };
      if (search) {
        noteQuery.$or = [
          { title: { $regex: search, $options: "i" } },
          { note: { $regex: search, $options: "i" } },
          { noteType: { $regex: search, $options: "i" } },
        ];
      }

      // Tax invoices only — pro formas, quotations and delivery challans are
      // separate collections and separate Accounting tabs; folding them into
      // one "Invoices" row would make the count mean something the user can't
      // act on from a single "View all".
      const invoiceQuery = { organization: orgId };
      if (search) {
        invoiceQuery.$or = [
          { invoiceNumber: { $regex: search, $options: "i" } },
          { status: { $regex: search, $options: "i" } },
          { receiverGSTIN: { $regex: search, $options: "i" } },
          { "items.name": { $regex: search, $options: "i" } },
        ];
      }

      // Run all queries in parallel
      const [companies, contacts, deals, vendors, notes, invoices] =
        await Promise.all([
          Company.find(companyQuery),
          Contact.find(contactQuery).populate("company"),
          Deal.find(dealQuery)
            .populate("company")
            .populate("contact")
            .populate("user"),
          Vendor.find(vendorQuery),
          // Notes carry no display name of their own beyond title/body, so the
          // company comes along to label the row in the search panel.
          Note.find(noteQuery).populate("company", "name"),
          Invoice.find(invoiceQuery).select(
            "invoiceNumber status amount date deal organization createdAt updatedAt"
          ),
        ]);

      return { companies, contacts, deals, vendors, notes, invoices };
    });

    res.json(data);
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({ message: "Search failed", error: error.message });
  }
};
