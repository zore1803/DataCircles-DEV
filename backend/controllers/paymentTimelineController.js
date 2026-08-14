const Payment = require("../models/Payment");
const Vendor = require("../models/Vendor");
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const SubscriptionPayment = require("../models/SubscriptionPayment.js");
const BankDetails = require("../models/BankDetails");
const Wallet = require("../models/Wallet");

exports.getPaymentsTimeline = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const partyFilter = req.query.party ? req.query.party.trim().toLowerCase() : "";
    const typeFilter = req.query.type ? req.query.type.trim() : "";
    const directionFilter = req.query.direction ? req.query.direction.trim().toUpperCase() : "";
    const searchQuery = req.query.search ? req.query.search.trim().toLowerCase() : "";
    
    let rules = [];
    if (req.query.rules) {
      try {
        rules = JSON.parse(req.query.rules);
      } catch (e) {
        rules = [];
      }
    }

    // Fetch from all relevant collections concurrently
    const [payments, invoices, purchases, subPayments, bankAccounts, wallet] = await Promise.all([
      Payment.find({ organization: orgId }).populate("vendor", "name companyName"),
      Invoice.find({ organization: orgId }).populate({
        path: "deal",
        populate: [
          { path: "company", select: "name" },
          { path: "contact", select: "name" }
        ]
      }),
      Purchase.find({ organization: orgId }).populate("vendor", "name companyName"),
      SubscriptionPayment.find({ organization: orgId }),
      BankDetails.find({ organization: orgId }),
      Wallet.findOne({ organization: orgId })
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

    if (searchQuery) {
      allTransactions = allTransactions.filter(t => 
        (t["payment-id"] || "").toLowerCase().includes(searchQuery) ||
        (t.party || "").toLowerCase().includes(searchQuery)
      );
    }

    if (directionFilter) {
      if (directionFilter === "CREDIT" || directionFilter === "IN") {
        allTransactions = allTransactions.filter(t => t.direction === "IN");
      } else if (directionFilter === "DEBIT" || directionFilter === "OUT") {
        allTransactions = allTransactions.filter(t => t.direction === "OUT");
      }
    }

    if (typeFilter) {
      if (typeFilter === "Credit") {
        allTransactions = allTransactions.filter(t => t.direction === "IN");
      } else if (typeFilter === "Debit") {
        allTransactions = allTransactions.filter(t => t.direction === "OUT");
      } else if (["Invoice", "Purchase", "Subscription", "Payment"].includes(typeFilter)) {
        allTransactions = allTransactions.filter(t => (t.source || "").toLowerCase() === typeFilter.toLowerCase());
      }
    }

    // Apply Advanced Filter Rules
    if (Array.isArray(rules) && rules.length > 0) {
      allTransactions = allTransactions.filter(t => {
        return rules.every(rule => {
          if (!rule.column) return true;
          let colVal = t[rule.column];

          // Handle direction mapping for Credit/Debit
          if (rule.column === "direction") {
            colVal = t.direction === "IN" ? "Credit" : "Debit";
          }

          const op = rule.operator || "contains";
          const val = rule.value != null ? String(rule.value).trim().toLowerCase() : "";

          if (op === "is_empty") return colVal == null || String(colVal).trim() === "";
          if (op === "is_not_empty") return colVal != null && String(colVal).trim() !== "";

          if (rule.column === "amount") {
            const numT = Number(t.amount) || 0;
            const numV = Number(rule.value) || 0;
            if (op === "greater_than") return numT > numV;
            if (op === "less_than") return numT < numV;
            if (op === "is") return numT === numV;
            if (op === "is_not") return numT !== numV;
          }

          const strVal = colVal != null ? String(colVal).toLowerCase() : "";

          if (op === "contains") return strVal.includes(val);
          if (op === "not_contains") return !strVal.includes(val);
          if (op === "is") return strVal === val;
          if (op === "is_not") return strVal !== val;
          if (op === "greater_than") return Number(strVal) > Number(val);
          if (op === "less_than") return Number(strVal) < Number(val);
          if (op === "in") {
            const parts = val.split(",").map(p => p.trim());
            return parts.includes(strVal);
          }
          if (op === "not_in") {
            const parts = val.split(",").map(p => p.trim());
            return !parts.includes(strVal);
          }

          return true;
        });
      });
    }

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Manual Pagination
    const totalCount = allTransactions.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

    // Compute account balances (Wallet + Banks)
    // 1. Bank balances: opening balance + sum(IN) - sum(OUT) for payments assigned to that bank
    const bankSummaries = bankAccounts.map((b) => {
      const bankName = b.bank || "Bank Account";
      const accNumber = b.accountNumber ? `•••• ${b.accountNumber.slice(-4)}` : "";
      const opening = Number(b.openingBalance) || 0;

      // Filter all transactions linked to this bank
      const bankTx = allTransactions.filter((t) => {
        if (!t.bank) return false;
        const bName = t.bank.toLowerCase();
        return bName.includes(bankName.toLowerCase()) || bName.includes((b.accountNumber || "").toLowerCase());
      });

      const inSum = bankTx.filter((t) => t.direction === "IN").reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const outSum = bankTx.filter((t) => t.direction === "OUT").reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const currentBalance = opening + inSum - outSum;

      return {
        id: b._id,
        type: "bank",
        title: bankName,
        accountNumber: accNumber,
        accountHolder: b.accountHolder || "",
        openingBalance: opening,
        currentBalance,
        isDefault: b.isDefault || false
      };
    });

    // 2. Wallet balance
    const walletBalance = wallet ? Number(wallet.balance) || 0 : 0;
    const walletSummary = {
      id: wallet ? wallet._id : "wallet-card",
      type: "wallet",
      title: "DataCircles Wallet",
      accountNumber: "Prepaid Credits",
      currentBalance: walletBalance,
      credits: wallet ? wallet.credits || 0 : 0
    };

    // 3. Cash balance: all Payment records with paymentType === "Cash"
    const cashTx = payments.filter((p) => p.paymentType === "Cash");
    const cashIn  = cashTx.filter((p) => p.direction === "IN" ).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const cashOut = cashTx.filter((p) => p.direction === "OUT").reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const cashSummary = {
      id: "cash-card",
      type: "cash",
      title: "Cash",
      accountNumber: "Physical Cash",
      currentBalance: cashIn - cashOut,
    };

    const accountsSummary = [walletSummary, cashSummary, ...bankSummaries];

    res.json({
      documents: paginatedTransactions,
      accountsSummary,
      pagination: {
        currentPage: page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error("Fetch payments timeline error:", err);
    res.status(500).json({ error: "Failed to fetch unified payments timeline" });
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

