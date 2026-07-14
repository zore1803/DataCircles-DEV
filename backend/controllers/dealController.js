// controllers/dealController.js (updated to handle field types)
const Deal = require("../models/Deal");
const Invoice = require("../models/Invoice");
const DealFields = require("../models/DealFields");
const sendGridMail = require("../utils/sendGridMail");
const NotificationSettings = require("../models/NotificationSettings");
const EmailTemplate = require("../models/EmailTemplate");
const User = require("../models/User");

const createDeal = async (req, res) => {
  try {
    const dealData = {
      ...req.body,
      organization: req.user.organization,
      user: req.body.user || req.user._id, // Allow frontend to pass Owner
      createdBy: req.user._id, // ADDED BY
      lastUpdatedBy: req.user._id, // UPDATED BY
    };

    // Process additional fields with proper typing
    if (req.body.additionalFields) {
      const fieldDefinitions = await DealFields.findOne({
        organization: req.user.organization,
      });

      const fieldTypes = {};
      if (fieldDefinitions && fieldDefinitions.fields) {
        fieldDefinitions.fields.forEach((field) => {
          fieldTypes[field.name] = field;
        });
      }

      dealData.additionalFields = req.body.additionalFields.map((field) => {
        const fieldDef = fieldTypes[field.key];
        let processedValue = field.value;

        if (fieldDef) {
          switch (fieldDef.type) {
            case "number":
              processedValue = parseFloat(field.value) || 0;
              break;
            case "dropdown":
            case "string":
            case "text":
            default:
              processedValue = String(field.value || "");
              break;
          }
          return { key: field.key, value: processedValue, type: fieldDef.type };
        }

        return {
          key: field.key,
          value: String(field.value || ""),
          type: "text",
        };
      });
    }

    const deal = await Deal.create(dealData);

    // Populate before sending back
    await deal.populate([
      { path: "company" },
      { path: "contact" },
      { path: "user", select: "name" },
      { path: "createdBy", select: "name" },
      { path: "lastUpdatedBy", select: "name" },
    ]);

    res.status(201).json(deal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getAllDeals = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { "additionalFields.value": { $regex: search, $options: "i" } },
      ];
    }

    const deals = await Deal.find(query)
      .populate("company")
      .populate("contact")
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");
    
    res.json(deals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyDeals = async (req, res) => {
  try {
    const deals = await Deal.find({
      user: req.user.id,
      organization: req.user.organization,
    })
      .populate("company")
      .populate("contact")
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDealById = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate("company")
      .populate("contact")
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");

    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }

    res.json(deal);
  } catch (err) {
    res.status(404).json({ error: "Deal not found" });
  }
};

const updateDeal = async (req, res) => {
  try {
    // 1. Authorization Check
    if (req.user.role !== "admin") {
      const hasEditPermission = req.user.permissions?.some(
        (p) =>
          p.name.toLowerCase() === "deals" && p.permission === "read-write",
      );

      if (!hasEditPermission) {
        return res.status(403).json({
          error:
            "Access denied. You do not have read-write permissions for deals.",
        });
      }
    }

    let updateData = {
      ...req.body,
      lastUpdatedBy: req.user._id, // Track who updated it
    };

    delete updateData.createdBy; // Protect immutable field

    // Process additional fields with proper typing
    if (req.body.additionalFields) {
      const fieldDefinitions = await DealFields.findOne({
        organization: req.user.organization,
      });

      const fieldTypes = {};
      if (fieldDefinitions && fieldDefinitions.fields) {
        fieldDefinitions.fields.forEach((field) => {
          fieldTypes[field.name] = field;
        });
      }

      updateData.additionalFields = req.body.additionalFields.map((field) => {
        const fieldDef = fieldTypes[field.key];
        let processedValue = field.value;

        if (fieldDef) {
          switch (fieldDef.type) {
            case "number":
              processedValue = parseFloat(field.value) || 0;
              break;
            case "dropdown":
            case "string":
            case "text":
            default:
              processedValue = String(field.value || "");
              break;
          }
          return { key: field.key, value: processedValue, type: fieldDef.type };
        }
        return {
          key: field.key,
          value: String(field.value || ""),
          type: "text",
        };
      });
    }

    const deal = await Deal.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      updateData,
      { new: true, runValidators: true },
    )
      .populate("company")
      .populate("contact")
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");

    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }

    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateDealStatus = async (req, res) => {
  try {
    const { oldStatus, newStatus } = req.body;

    if (typeof oldStatus !== "string" || typeof newStatus !== "string") {
      return res
        .status(400)
        .json({ error: "oldStatus and newStatus must be provided as strings" });
    }

    // Inside updateDealStatus, replace the existing findOneAndUpdate with this:
    const deal = await Deal.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
        status: oldStatus,
      },
      {
        status: newStatus,
        lastUpdatedBy: req.user._id, // Track who moved the deal!
      },
      { new: true, runValidators: true },
    )
      .populate("company")
      .populate("contact")
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");

    if (!deal) {
      const existingDeal = await Deal.findOne({
        _id: req.params.id,
        organization: req.user.organization,
      });

      if (!existingDeal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      return res.status(409).json({
        error:
          "Status has changed since last fetch. Please refresh and try again.",
        currentStatus: existingDeal.status,
      });
    }

    // Proceed only if status actually changed
    if (oldStatus !== newStatus) {
      // ✅ Check for users who have notifications enabled for this transition
      const notificationSettings = await NotificationSettings.find({
        organization: req.user.organization,
        deals: true,
        dealTransitions: { $elemMatch: { from: oldStatus, to: newStatus } },
      }).select("userId");

      const notificationUserIds = notificationSettings.map((n) =>
        n.userId.toString(),
      );

      if (notificationUserIds.length > 0) {
        const usersData = await User.find({
          _id: { $in: notificationUserIds },
        });

        // ✅ STEP 1: Check for custom template
        const customTemplate = await EmailTemplate.findOne({
          organization: req.user.organization,
          type: "deal",
          "dealTransition.from": oldStatus,
          "dealTransition.to": newStatus,
        });

        for (const user of usersData) {
          let subject, htmlBody;

          if (customTemplate) {
            // ✅ STEP 2: Use custom template
            subject = customTemplate.subject;
            htmlBody = customTemplate.body
              .replace(/{{userName}}/g, user.name || "")
              .replace(/{{dealTitle}}/g, deal.title || "")
              .replace(/{{oldStatus}}/g, oldStatus)
              .replace(/{{newStatus}}/g, newStatus)
              .replace(
                /{{amount}}/g,
                `₹${parseInt(deal.amount || 0).toLocaleString()}`,
              )
              .replace(/{{companyName}}/g, deal.company?.name || "N/A")
              .replace(/{{contactName}}/g, deal.contact?.name || "N/A")
              .replace(
                /{{updatedAt}}/g,
                new Date(deal.updatedAt).toLocaleDateString(),
              )
              .replace(/<p>(<br\s*\/?>)?<\/p>/g, "") // remove empty paragraphs
              .replace(/(<br\s*\/?>){2,}/g, "<br>") // limit consecutive line breaks
              .trim();
          } else {
            // ✅ STEP 3: Fallback to default HTML
            subject = `Deal Status Updated: ${deal.title}`;
            htmlBody = `
              <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 6px;">
                <h2 style="color: #2c3e50;">Deal Status Updated</h2>
                <p>Hi ${user.name || ""},</p>
                <p>The status of the deal <strong>${
                  deal.title
                }</strong> has been updated. Please find the details below:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr><td style="padding: 8px; font-weight: bold;">Deal Title:</td><td style="padding: 8px;">${
                    deal.title
                  }</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">Old Status:</td><td style="padding: 8px;">${oldStatus}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">New Status:</td><td style="padding: 8px;">${newStatus}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">₹${parseInt(
                    deal.amount || 0,
                  ).toLocaleString()}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">Company:</td><td style="padding: 8px;">${
                    deal.company?.name || "N/A"
                  }</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">Contact:</td><td style="padding: 8px;">${
                    deal.contact?.name || "N/A"
                  }</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold;">Updated At:</td><td style="padding: 8px;">${new Date(
                    deal.updatedAt,
                  ).toLocaleDateString()}</td></tr>
                </table>
                <p>Please review the updated deal status and take any necessary actions.</p>
                <p style="margin-top: 30px;">Best regards,<br>Your Team</p>
              </div>
            `;
          }

          // ✅ STEP 4: Send email to user
          await sendGridMail({
            to: user.email,
            subject,
            html: htmlBody,
          });
        }

        console.log(
          `✅ Deal ${deal._id} updated from ${oldStatus} → ${newStatus}. Emails sent to ${notificationUserIds.length} user(s).`,
        );
      }

      // ✅ STEP 5: Send email to contact if contact exists and has email
      if (deal.contact && deal.contact.email) {
        // Check for custom template for contact
        const customTemplate = await EmailTemplate.findOne({
          organization: req.user.organization,
          type: "deal",
          "dealTransition.from": oldStatus,
          "dealTransition.to": newStatus,
        });

        let subject, htmlBody;

        if (customTemplate) {
          // Use custom template for contact
          subject = customTemplate.subject;
          htmlBody = customTemplate.body
            .replace(/{{userName}}/g, deal.contact.name || "")
            .replace(/{{dealTitle}}/g, deal.title || "")
            .replace(/{{oldStatus}}/g, oldStatus)
            .replace(/{{newStatus}}/g, newStatus)
            .replace(
              /{{amount}}/g,
              `₹${parseInt(deal.amount || 0).toLocaleString()}`,
            )
            .replace(/{{companyName}}/g, deal.company?.name || "N/A")
            .replace(/{{contactName}}/g, deal.contact?.name || "N/A")
            .replace(
              /{{updatedAt}}/g,
              new Date(deal.updatedAt).toLocaleDateString(),
            )
            .replace(/<p>(<br\s*\/?>)?<\/p>/g, "") // remove empty paragraphs
            .replace(/(<br\s*\/?>){2,}/g, "<br>") // limit consecutive line breaks
            .trim();
        } else {
          // Fallback to default HTML for contact
          subject = `Deal Status Updated: ${deal.title}`;
          htmlBody = `
            <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 6px;">
              <h2 style="color: #2c3e50;">Deal Status Updated</h2>
              <p>Hi ${deal.contact.name || ""},</p>
              <p>The status of your deal <strong>${
                deal.title
              }</strong> has been updated. Please find the details below:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr><td style="padding: 8px; font-weight: bold;">Deal Title:</td><td style="padding: 8px;">${
                  deal.title
                }</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Previous Status:</td><td style="padding: 8px;">${oldStatus}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Current Status:</td><td style="padding: 8px;">${newStatus}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Amount:</td><td style="padding: 8px;">₹${parseInt(
                  deal.amount || 0,
                ).toLocaleString()}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Company:</td><td style="padding: 8px;">${
                  deal.company?.name || "N/A"
                }</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Updated At:</td><td style="padding: 8px;">${new Date(
                  deal.updatedAt,
                ).toLocaleDateString()}</td></tr>
              </table>
              <p>If you have any questions, please don't hesitate to reach out to us.</p>
              <p style="margin-top: 30px;">Best regards,<br>Your Team</p>
            </div>
          `;
        }

        // Send email to contact
        await sendGridMail({
          to: deal.contact.email,
          subject,
          html: htmlBody,
        });

        console.log(
          `✅ Deal ${deal._id} status change notification sent to contact: ${deal.contact.email}`,
        );
      }
    }

    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!deal) {
      return res.status(404).json({ error: "Deal not found" });
    }

    const invoices = await Invoice.find({
      deal: req.params.id,
      organization: req.user.organization,
    });

    await Promise.all(invoices.map((inv) => inv.deleteOne()));

    await deal.deleteOne();
    res.json({ message: "Deal deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDeals = async (req, res) => {
  try {
    let filter = { organization: req.user.organization };
    if (req.user.role === "staff") { filter.user = req.user._id; }

    const deals = await Deal.find(filter)
      .populate("contact")
      .populate("company")
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");

    res.json(deals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDashboardDeals = async (req, res) => {
  try {
    let filter = { organization: req.user.organization };
    if (req.user.role === "staff") { filter.user = req.user._id; }

    const deals = await Deal.find(filter)
      .populate("company")
      .populate("contact")
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");

    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const exportSelectedDeals = async (req, res) => {
  try {
    const { selectedIds, columns } = req.body;

    if (!selectedIds || selectedIds.length === 0) {
      return res.status(400).json({ error: "No deals selected for export" });
    }

    // 1. Fetch ALL selected deals
    // Populate company and contact to get their names instead of just IDs
    const deals = await Deal.find({
      _id: { $in: selectedIds },
      organization: req.user.organization,
    })
      .populate("company", "name")
      .populate("contact", "name")
      .lean();

    // 2. Build CSV Header Row
    const headerRow = columns.map((c) => `"${c.label}"`).join(",");

    // 3. Build CSV Data Rows
    const dataRows = deals.map((deal) => {
      return columns
        .map((c) => {
          let val = "";

          if (c.isCustomField) {
            const field = deal.additionalFields?.find((f) => f.key === c.key);
            val = field ? field.value : "";
          } else if (c.key === "company") {
            val = deal.company?.name || "";
          } else if (c.key === "contact") {
            val = deal.contact?.name || "";
          } else {
            val = deal[c.key] || "";
          }

          // Escape quotes for CSV format and convert objects/arrays to strings
          if (typeof val === "object" && val !== null)
            val = JSON.stringify(val);
          val = String(val).replace(/"/g, '""');

          return `"${val}"`;
        })
        .join(",");
    });

    // 4. Combine into a single CSV string
    const csvContent = [headerRow, ...dataRows].join("\n");

    // 5. Send as a downloadable file
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Exported_Deals.csv"',
    );
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export deals" });
  }
};

module.exports = {
  createDeal,
  getAllDeals,
  getDealById,
  updateDeal,
  getMyDeals,
  deleteDeal,
  updateDealStatus,
  getDashboardDeals,
  exportSelectedDeals,
};
