const SalesSubscription = require("../models/SalesSubscription");
const Invoice = require("../models/Invoice");
const Deal = require("../models/Deal");
const { getDocumentSettingsForOrganization, resolveDocumentNumber } = require("../utils/documentNumbering");
const { syncDocumentStock } = require("../utils/inventorySync");

// Same math shape as invoiceController.calculateItemAmount/calculateTotalAmount
// — kept parallel so a subscription's `amount` always matches what its next
// generated Invoice will actually bill.
const calculateItemAmount = (item) => {
  const rate = parseFloat(item.rate) || 0;
  const quantity = parseInt(item.quantity) || 0;
  const subtotal = rate * quantity;
  const discount = parseFloat(item.discount) || 0;
  if (item.discountType === "percentage") return subtotal * (1 - discount / 100);
  return subtotal - discount;
};

const calculateTotalAmount = (items, discount, gstRate = 0, transactionType = "intra") => {
  const subtotal = items.reduce((total, item) => total + calculateItemAmount(item), 0);
  let netAmount = subtotal;
  if (discount && discount.value > 0) {
    netAmount = discount.type === "percentage" ? subtotal * (1 - discount.value / 100) : subtotal - discount.value;
  }
  if (gstRate > 0) {
    netAmount += netAmount * (gstRate / 100);
  }
  return netAmount;
};

// Count-based "SUB-00001" — mirrors SalesReturn/PurchaseReturn's own scheme.
async function generateSubscriptionNumber(organizationId) {
  const count = await SalesSubscription.countDocuments({ organization: organizationId });
  return `SUB-${(count + 1).toString().padStart(5, "0")}`;
}

const POPULATE = [
  { path: "deal", populate: [{ path: "contact", select: "name email phone" }, { path: "company", select: "name email phone gstin billingAddress shippingAddresses" }] },
  { path: "items.itemId", select: "name description sellingPrice hsnSac gstRate variants type" },
  { path: "generatedInvoices.invoice", select: "invoiceNumber status amount date" },
];

// Advances a date by the subscription's own billing interval — shared by
// create (seeding the first nextInvoiceDate) and generateInvoiceForSubscription
// (advancing past the cycle that was just billed).
function addInterval(date, { value, unit }) {
  const next = new Date(date);
  const n = parseInt(value, 10) || 1;
  if (unit === "day") next.setDate(next.getDate() + n);
  else if (unit === "week") next.setDate(next.getDate() + n * 7);
  else if (unit === "year") next.setFullYear(next.getFullYear() + n);
  else next.setMonth(next.getMonth() + n); // "month" default
  return next;
}

exports.createSalesSubscription = async (req, res) => {
  try {
    const { deal, items, discount, transactionType, gstRate, billingInterval, startDate, endDate, status, notes, terms } = req.body;

    if (!deal) return res.status(400).json({ message: "A customer (Deal) is required" });
    const dealDoc = await Deal.findOne({ _id: deal, organization: req.user.organization });
    if (!dealDoc) return res.status(404).json({ message: "Deal not found" });

    if (!items || items.length === 0) return res.status(400).json({ message: "At least one item is required" });
    if (!startDate) return res.status(400).json({ message: "A start date is required" });

    const finalDiscount = discount && ["fixed", "percentage"].includes(discount.type)
      ? discount
      : { type: "fixed", value: 0 };
    const finalGstRate = parseFloat(gstRate) || 0;
    const finalTxnType = transactionType || "intra";
    const amount = calculateTotalAmount(items, finalDiscount, finalGstRate, finalTxnType);

    const subscriptionNumber = await generateSubscriptionNumber(req.user.organization);

    const subscription = new SalesSubscription({
      deal,
      subscriptionNumber,
      items,
      discount: finalDiscount,
      transactionType: finalTxnType,
      gstRate: finalGstRate,
      amount,
      billingInterval: {
        value: parseInt(billingInterval?.value, 10) || 1,
        unit: ["day", "week", "month", "year"].includes(billingInterval?.unit) ? billingInterval.unit : "month",
      },
      startDate,
      endDate: endDate || null,
      nextInvoiceDate: startDate,
      status: status || "Draft",
      notes: notes || "",
      terms: terms || "",
      user: req.user.id,
      organization: req.user.organization,
    });

    await subscription.save();
    await subscription.populate(POPULATE);
    res.status(201).json(subscription);
  } catch (err) {
    console.error("Create sales subscription error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getAllSalesSubscriptionsWithPagination = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;
    const { search, status, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query = { organization: req.user.organization };
    if (search) {
      query.$or = [
        { subscriptionNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;

    if (req.query.allIds === "true") {
      const all = await SalesSubscription.find(query).select("_id").lean();
      return res.json({ ids: all.map((x) => x._id) });
    }

    const [subscriptions, totalCount] = await Promise.all([
      SalesSubscription.find(query)
        .populate(POPULATE)
        .skip(skip)
        .limit(limit)
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .lean()
        .select("-__v"),
      SalesSubscription.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    res.json({
      subscriptions,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("List sales subscriptions error:", err);
    res.status(500).json({ error: "Failed to fetch subscriptions", message: err.message });
  }
};

exports.getSalesSubscriptionById = async (req, res) => {
  try {
    const row = await SalesSubscription.findOne({ _id: req.params.id, organization: req.user.organization }).populate(POPULATE);
    if (!row) return res.status(404).json({ message: "Subscription not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSalesSubscription = async (req, res) => {
  try {
    const subscription = await SalesSubscription.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });

    if (subscription.status === "Cancelled") {
      return res.status(400).json({ message: "A Cancelled subscription can't be edited — create a new one instead." });
    }

    const { items, discount, transactionType, gstRate, billingInterval, startDate, endDate, status, notes, terms } = req.body;

    if (items !== undefined) {
      if (!items.length) return res.status(400).json({ message: "At least one item is required" });
      subscription.items = items;
    }
    if (discount !== undefined) subscription.discount = discount;
    if (transactionType !== undefined) subscription.transactionType = transactionType;
    if (gstRate !== undefined) subscription.gstRate = parseFloat(gstRate) || 0;
    if (billingInterval !== undefined) {
      subscription.billingInterval = {
        value: parseInt(billingInterval.value, 10) || 1,
        unit: ["day", "week", "month", "year"].includes(billingInterval.unit) ? billingInterval.unit : "month",
      };
    }
    if (startDate !== undefined) subscription.startDate = startDate;
    if (endDate !== undefined) subscription.endDate = endDate || null;
    if (notes !== undefined) subscription.notes = notes;
    if (terms !== undefined) subscription.terms = terms;
    if (status !== undefined) subscription.status = status;

    // Amount always recomputed from the current items/discount/gst — never
    // trusted from the client, so it can't drift from what a generated
    // invoice would actually total.
    subscription.amount = calculateTotalAmount(subscription.items, subscription.discount, subscription.gstRate, subscription.transactionType);

    await subscription.save();
    await subscription.populate(POPULATE);
    res.json(subscription);
  } catch (err) {
    console.error("Update sales subscription error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.updateSalesSubscriptionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["Draft", "Active", "Expired", "Error", "Cancelled"];
    if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const subscription = await SalesSubscription.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });

    if (subscription.status === "Cancelled") {
      return res.status(400).json({ message: "A Cancelled subscription can't be reactivated — create a new one instead." });
    }

    subscription.status = status;
    // Reactivating out of a paused/errored state needs a real next-billing
    // date to resume from — reseed it if it was cleared.
    if (status === "Active" && !subscription.nextInvoiceDate) {
      subscription.nextInvoiceDate = new Date();
    }
    if (status === "Cancelled") {
      subscription.nextInvoiceDate = null;
    }
    await subscription.save();
    await subscription.populate(POPULATE);
    res.json(subscription);
  } catch (err) {
    console.error("Update sales subscription status error:", err);
    res.status(400).json({ error: err.message });
  }
};

// POST /sales-subscriptions/:id/generate-invoice — manually generate the next
// Invoice from this subscription right now (the "Generate Invoice Now" row
// action). A scheduled job for automatic on-schedule generation would call
// this same function per subscription whose nextInvoiceDate has arrived —
// deliberately factored out so that automation is a thin wrapper around this,
// not a second implementation to keep in sync.
async function generateInvoiceForSubscription(subscription, userId, organizationId) {
  const dealDoc = await Deal.findById(subscription.deal).populate("company");
  if (!dealDoc) throw new Error("Deal for this subscription no longer exists");

  const documentSettings = await getDocumentSettingsForOrganization(organizationId);
  const effectivePrefix = documentSettings.documentTypeSettings?.invoice?.prefix || documentSettings.invoicePrefix || "INV-";
  const effectiveSuffix = documentSettings.documentTypeSettings?.invoice?.suffix || documentSettings.invoiceSuffix || "";

  const invoiceNumber = await resolveDocumentNumber({
    Model: Invoice,
    numberField: "invoiceNumber",
    organization: organizationId,
    documentTypeKey: "invoice",
    prefix: effectivePrefix,
    suffix: effectiveSuffix,
  });

  let billingAddress = {};
  let shippingAddress = {};
  let receiverGSTIN = "";
  if (dealDoc.company) {
    billingAddress = dealDoc.company.billingAddress || {};
    shippingAddress = dealDoc.company.shippingAddresses?.[0] || {};
    receiverGSTIN = dealDoc.company.gstin || "";
  }

  const invoice = new Invoice({
    deal: subscription.deal,
    invoiceNumber,
    date: new Date(),
    amount: subscription.amount,
    discount: subscription.discount,
    status: "Draft",
    items: subscription.items,
    notes: `Generated from Subscription ${subscription.subscriptionNumber}${subscription.notes ? `\n${subscription.notes}` : ""}`,
    terms: subscription.terms || "",
    isTaxInvoice: (subscription.gstRate || 0) > 0,
    receiverGSTIN,
    billingAddress,
    shippingAddress,
    transactionType: subscription.transactionType,
    gstRate: subscription.gstRate,
    user: userId,
    organization: organizationId,
  });

  await invoice.save();

  // Stock OUT for any product lines — same call every other Invoice creation
  // path uses; services are filtered out inside syncDocumentStock itself.
  try {
    await syncDocumentStock({
      organization: organizationId,
      documentId: invoice._id,
      documentModel: "Invoice",
      documentNumber: invoice.invoiceNumber,
      items: invoice.items,
      previousItems: [],
      baseDirection: "out",
      userId,
      reason: "sale",
      isReversal: false,
    });
    invoice.stockMovementStatus = "applied";
    await invoice.save({ validateModifiedOnly: true });
  } catch (stockErr) {
    // A subscription generating an invoice that oversells stock shouldn't
    // silently vanish — the Invoice still exists (Draft), but the
    // subscription itself flips to Error so the user notices and can
    // adjust quantities/stock before the next cycle.
    subscription.status = "Error";
    subscription.lastError = stockErr.message;
    await subscription.save();
    throw stockErr;
  }

  subscription.invoiceCount += 1;
  subscription.generatedInvoices.push({
    invoice: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.date,
    amount: invoice.amount,
  });

  const advanced = addInterval(subscription.nextInvoiceDate || subscription.startDate, subscription.billingInterval);
  if (subscription.endDate && advanced > new Date(subscription.endDate)) {
    subscription.nextInvoiceDate = null;
    subscription.status = "Expired";
  } else {
    subscription.nextInvoiceDate = advanced;
    if (subscription.status === "Draft") subscription.status = "Active";
  }
  subscription.lastError = "";

  await subscription.save();
  return invoice;
}
exports.generateInvoiceForSubscription = generateInvoiceForSubscription;

exports.generateInvoiceNow = async (req, res) => {
  try {
    const subscription = await SalesSubscription.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });
    if (subscription.status === "Cancelled") {
      return res.status(400).json({ message: "A Cancelled subscription can't generate invoices." });
    }
    if (subscription.status === "Expired") {
      return res.status(400).json({ message: "This subscription has passed its end date." });
    }

    const invoice = await generateInvoiceForSubscription(subscription, req.user.id, req.user.organization);
    await subscription.populate(POPULATE);
    res.json({ subscription, invoice });
  } catch (err) {
    console.error("Generate invoice from subscription error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.deleteSalesSubscription = async (req, res) => {
  try {
    const subscription = await SalesSubscription.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!subscription) return res.status(404).json({ message: "Subscription not found" });
    // Deleting the subscription record only stops future generation — it
    // never touches invoices already generated from it (they're independent
    // documents at that point, same as an Invoice surviving its Deal being
    // archived elsewhere in this app).
    await subscription.deleteOne();
    res.json({ message: "Subscription deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
