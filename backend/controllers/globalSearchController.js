const Company = require("../models/Company");
const Contact = require("../models/Contact");
const Deal = require("../models/Deal");
const Vendor = require("../models/Vendor");
const { cacheGetOrSet } = require("../cacheHelper");

exports.globalSearch = async (req, res) => {
  try {
    const { search, lifecycleStage, stageStatus } = req.query;
    const orgId = req.user.organization;
    const cacheKey = `globalSearch:v1:${orgId}:${search || ""}:${
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

      // Run all queries in parallel
      const [companies, contacts, deals, vendors] = await Promise.all([
        Company.find(companyQuery),
        Contact.find(contactQuery).populate("company"),
        Deal.find(dealQuery)
          .populate("company")
          .populate("contact")
          .populate("user"),
        Vendor.find(vendorQuery),
      ]);

      return { companies, contacts, deals, vendors };
    });

    res.json(data);
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({ message: "Search failed", error: error.message });
  }
};
