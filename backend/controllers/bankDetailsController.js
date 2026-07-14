const BankDetails = require("../models/BankDetails");

// Create bank details
exports.createBankDetails = async (req, res) => {
  try {
    const bankDetailsData = {
      ...req.body,
      organization: req.user.organization, // Add organization from authenticated user
      user: req.user._id, // Track which user created it
    };

    const newBank = new BankDetails(bankDetailsData);
    const saved = await newBank.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Read latest bank details for the organization
exports.getLatestBankDetails = async (req, res) => {
  try {
    const banks = await BankDetails.findOne({
      organization: req.user.organization, // Filter by organization
    }).sort({ updatedAt: -1 });

    res.json(banks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all bank details for the organization (if you need this)
exports.getAllBankDetails = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization }; // Filter by organization

    if (search) {
      query.$or = [
        { bank: { $regex: search, $options: "i" } },
        { accountHolder: { $regex: search, $options: "i" } },
        { branch: { $regex: search, $options: "i" } },
        { ifscCode: { $regex: search, $options: "i" } },
      ];
    }

    const banks = await BankDetails.find(query).sort({ updatedAt: -1 });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Read one bank details by ID
exports.getBankDetailsById = async (req, res) => {
  try {
    const bank = await BankDetails.findOne({
      _id: req.params.id,
      organization: req.user.organization, // Filter by organization
    });

    if (!bank) {
      return res.status(404).json({ error: "Bank details not found" });
    }

    res.json(bank);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update or Create bank details
exports.updateBankDetails = async (req, res) => {
  try {
    // If no ID is provided -> create new bank details
    if (req.params.id == "undefined") {
      const bankDetailsData = {
        ...req.body,
        organization: req.user.organization, // Add organization from authenticated user
        user: req.user._id, // Track which user created it
      };

      const newBank = new BankDetails(bankDetailsData);
      const saved = await newBank.save();
      return res.status(201).json(saved);
    }

    // If ID is provided -> update existing bank details
    const updated = await BankDetails.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization, // Filter by organization
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Bank details not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


// Delete bank details
exports.deleteBankDetails = async (req, res) => {
  try {
    const deleted = await BankDetails.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization, // Filter by organization
    });

    if (!deleted) {
      return res.status(404).json({ error: "Bank details not found" });
    }

    res.json({ message: "Bank details deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
