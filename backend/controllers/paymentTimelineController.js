const Payment = require("../models/Payment");
const Vendor = require("../models/Vendor");
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const SubscriptionPayment = require("../models/SubscriptionPayment.js");

exports.getPaymentsTimeline = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const partyFilter = req.query.party ? req.query.party.trim().toLowerCase() : "";

    // Fetch from all relevant collections concurrently
    const [payments, invoices, purchases, subPayments] = await Promise.all([
      Payment.find({ organization: orgId }).populate("vendor", "name companyName"),
      Invoice.find({ organization: orgId }).populate({
        path: "deal",
        populate: [
          { path: "company", select: "name" },
          { path: "contact", select: "name" }
        ]
      }),
      Purchase.find({ organization: orgId }).populate("vendor", "name companyName"),
      SubscriptionPayment.find({ organization: orgId })
    ]);

    const formattedPayments = payments.map((p) => ({
      _id: p._id,
      "payment-id": p._id.toString().substring(0, 8).toUpperCase(),
      party: p.vendor ? p.vendor.companyName || p.vendor.name : "Unknown Vendor",
      amount: p.amount,
      direction: p.direction,
      type: p.paymentType || "Payment",
      date: p.paymentDate,
      bank: p.bank || "",
      notes: p.notes || "",
      source: "Payment",
      status: "Paid"
    }));

    const formattedInvoices = invoices.map((inv) => {
      let party = "Unknown Client";
      if (inv.deal) {
        if (inv.deal.company && inv.deal.company.name) party = inv.deal.company.name;
        else if (inv.deal.contact && inv.deal.contact.name) party = inv.deal.contact.name;
      }
      return {
        _id: inv._id,
        "payment-id": inv.invoiceNumber || inv._id.toString().substring(0, 8).toUpperCase(),
        party,
        amount: inv.amount,
        direction: "IN",
        type: "Invoice",
        date: inv.date || inv.createdAt,
        bank: "",
        notes: inv.notes || "",
        source: "Invoice",
        status: inv.status
      };
    });

    const formattedPurchases = purchases.map((pur) => ({
      _id: pur._id,
      "payment-id": pur.purchaseNumber || pur._id.toString().substring(0, 8).toUpperCase(),
      party: pur.vendor ? pur.vendor.companyName || pur.vendor.name : "Unknown Vendor",
      amount: pur.grandTotal || pur.subtotal,
      direction: "OUT",
      type: "Purchase",
      date: pur.purchaseDate || pur.createdAt,
      bank: "",
      notes: pur.notes || "",
      source: "Purchase",
      status: pur.status
    }));

    const formattedSubs = subPayments.map((sub) => ({
      _id: sub._id,
      "payment-id": sub.razorpayPaymentId || sub._id.toString().substring(0, 8).toUpperCase(),
      party: "DataCircles System",
      amount: sub.amount,
      direction: "OUT",
      type: sub.method || "Subscription",
      date: sub.createdAt,
      bank: "",
      notes: sub.paymentFor || "",
      source: "Subscription",
      status: sub.status
    }));

    let allTransactions = [
      ...formattedPayments,
      ...formattedInvoices,
      ...formattedPurchases,
      ...formattedSubs
    ];

    if (partyFilter) {
      allTransactions = allTransactions.filter(t => (t.party || "").toLowerCase().includes(partyFilter));
    }

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Manual Pagination
    const totalCount = allTransactions.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

    // KPI totals over every matching transaction (all pages), not just the
    // slice being returned — the frontend was computing these from
    // `documents` alone, which is only the current page (10 rows), so the
    // Total Credit/Debit/Net/Transactions cards read wildly low against the
    // real "534 total" count.
    let totalCredit = 0;
    let totalDebit = 0;
    allTransactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.direction === "IN") totalCredit += amt;
      else totalDebit += amt;
    });

    res.json({
      documents: paginatedTransactions,
      pagination: {
        currentPage: page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      summary: {
        totalCredit,
        totalDebit,
        net: totalCredit - totalDebit,
        count: totalCount
      }
    });
  } catch (err) {
    console.error("Fetch payments timeline error:", err);
    res.status(500).json({ error: "Failed to fetch unified payments timeline" });
  }
};

// Backs the timeline's "View" action — fetches the full record (the list
// endpoint above only returns a flattened summary row) plus its party, in the
// shape PaymentReceiptModal expects. Every timeline source is normalized into
// one receipt shape so the View action behaves consistently across tabs.
exports.getPaymentReceipt = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { id } = req.params;
    const source = (req.query.source || "").trim();

    if (source === "Payment") {
      const payment = await Payment.findOne({ _id: id, organization: orgId }).populate("vendor");
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      return res.json({ payment, vendor: payment.vendor });
    }

    if (source === "Purchase") {
      const purchase = await Purchase.findOne({ _id: id, organization: orgId }).populate("vendor");
      if (!purchase) return res.status(404).json({ error: "Purchase not found" });
      // Normalized onto the same field names PaymentReceiptModal reads from a
      // real Payment document, so the modal doesn't need to know the source.
      const payment = {
        _id: purchase._id,
        amount: purchase.grandTotal || purchase.subtotal,
        paymentDate: purchase.purchaseDate || purchase.createdAt,
        direction: "OUT",
        paymentType: "Purchase",
        bank: "",
        notes: purchase.notes || "",
      };
      return res.json({ payment, vendor: purchase.vendor });
    }

    if (source === "Invoice") {
      const invoice = await Invoice.findOne({ _id: id, organization: orgId })
        .populate({ path: "deal", populate: ["contact", "company"] });
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });

      const party = invoice.deal?.company || invoice.deal?.contact || {
        name: invoice.deal?.title || "Customer",
      };
      const payment = {
        _id: invoice._id,
        amount: invoice.amount,
        paymentDate: invoice.date || invoice.createdAt,
        direction: "IN",
        paymentType: "Invoice",
        bank: "",
        notes: invoice.notes || "",
        reference: invoice.invoiceNumber,
      };
      return res.json({ payment, vendor: party });
    }

    if (source === "Subscription") {
      const subscriptionPayment = await SubscriptionPayment.findOne({
        _id: id,
        organization: orgId,
      });
      if (!subscriptionPayment) return res.status(404).json({ error: "Subscription payment not found" });

      const payment = {
        _id: subscriptionPayment._id,
        amount: subscriptionPayment.amount,
        paymentDate: subscriptionPayment.createdAt,
        direction: "OUT",
        paymentType: subscriptionPayment.method || "Subscription",
        bank: "",
        notes: subscriptionPayment.paymentFor || "",
        reference: subscriptionPayment.razorpayPaymentId || "",
      };
      return res.json({
        payment,
        vendor: { name: "DataCircles", company: "DataCircles System" },
      });
    }

    return res.status(400).json({ error: `Receipts aren't available for "${source}" entries` });
  } catch (err) {
    console.error("Fetch payment receipt error:", err);
    res.status(500).json({ error: "Failed to fetch payment receipt" });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { vendor, vendorName, amount, paymentDate, direction, paymentType, bank, notes } = req.body;
    const orgId = req.user.organization;
    const userId = req.user._id;

    if (!amount || !paymentDate || !direction || !paymentType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let vendorId = vendor;

    if (!vendorId && vendorName) {
      const newVendor = new Vendor({
        name: vendorName,
        organization: orgId,
        user: userId,
      });
      await newVendor.save();
      vendorId = newVendor._id;
    }

    if (!vendorId) {
      return res.status(400).json({ error: "Vendor is required" });
    }

    const payment = new Payment({
      vendor: vendorId,
      amount: Number(amount),
      paymentDate: new Date(paymentDate),
      direction, // "IN" or "OUT"
      paymentType,
      bank,
      notes,
      organization: orgId,
      user: userId,
    });

    await payment.save();
    res.status(201).json(payment);
  } catch (err) {
    console.error("Create payment error:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
};

exports.updateTimelineEntry = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { id } = req.params;
    const { source, vendor, vendorName, paymentDate, direction, paymentType, bank, notes } = req.body;

    if (!source) {
      return res.status(400).json({ error: "Missing 'source' parameter" });
    }

    let Model;
    switch (source) {
      case "Payment":      Model = Payment; break;
      case "Invoice":       Model = Invoice; break;
      case "Purchase":      Model = Purchase; break;
      case "Subscription":  Model = SubscriptionPayment; break;
      default:
        return res.status(400).json({ error: `Unknown source: ${source}` });
    }

    const doc = await Model.findOne({ _id: id, organization: orgId });
    if (!doc) {
      return res.status(404).json({ error: "Document not found or not authorized" });
    }

    // Resolve vendor if changing vendor
    let vendorId = vendor;
    if (!vendorId && vendorName) {
      const newVendor = new Vendor({
        name: vendorName,
        organization: orgId,
        user: req.user._id,
      });
      await newVendor.save();
      vendorId = newVendor._id;
    }

    if (source === "Payment") {
      if (vendorId) doc.vendor = vendorId;
      if (paymentDate) doc.paymentDate = new Date(paymentDate);
      if (direction) doc.direction = direction;
      if (paymentType) doc.paymentType = paymentType;
      if (bank !== undefined) doc.bank = bank;
      if (notes !== undefined) doc.notes = notes;
    } else {
      // Generic fallback fields update across models
      if (paymentDate) {
        if (doc.date !== undefined) doc.date = new Date(paymentDate);
        if (doc.paymentDate !== undefined) doc.paymentDate = new Date(paymentDate);
        if (doc.issueDate !== undefined) doc.issueDate = new Date(paymentDate);
      }
      if (notes !== undefined) doc.notes = notes;
      if (bank !== undefined) doc.bank = bank;
    }

    await doc.save();
    res.json({ message: "Updated successfully", doc });
  } catch (err) {
    console.error("Update timeline entry error:", err);
    res.status(500).json({ error: "Failed to update entry" });
  }
};

exports.deleteTimelineEntry = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { id } = req.params;
    const source = (req.query.source || "").trim();

    if (!source) {
      return res.status(400).json({ error: "Missing 'source' query parameter" });
    }

    let Model;
    switch (source) {
      case "Payment":      Model = Payment; break;
      case "Invoice":       Model = Invoice; break;
      case "Purchase":      Model = Purchase; break;
      case "Subscription":  Model = SubscriptionPayment; break;
      default:
        return res.status(400).json({ error: `Unknown source: ${source}` });
    }

    const doc = await Model.findOneAndDelete({ _id: id, organization: orgId });
    if (!doc) {
      return res.status(404).json({ error: "Document not found or not authorized" });
    }

    res.json({ message: "Deleted successfully", id, source });
  } catch (err) {
    console.error("Delete timeline entry error:", err);
    res.status(500).json({ error: "Failed to delete timeline entry" });
  }
};
