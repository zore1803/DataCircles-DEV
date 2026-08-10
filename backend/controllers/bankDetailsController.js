const BankDetails = require("../models/BankDetails");
const getDefaultBankDetails = require("../utils/getDefaultBankDetails");

const clearOtherDefaults = async (organizationId, exceptId = null) => {
  const query = { organization: organizationId, isDefault: true };
  if (exceptId) query._id = { $ne: exceptId };
  await BankDetails.updateMany(query, { $set: { isDefault: false } });
};

const sanitizeBankPayload = (body = {}) => {
  const payload = { ...body };
  delete payload._id;
  delete payload.organization;
  delete payload.user;
  delete payload.createdAt;
  delete payload.updatedAt;
  delete payload.__v;
  if (payload.ifscCode) payload.ifscCode = String(payload.ifscCode).trim().toUpperCase();
  return payload;
};

exports.createBankDetails = async (req, res) => {
  try {
    const payload = sanitizeBankPayload(req.body);

    if (payload.isDefault) {
      await clearOtherDefaults(req.user.organization);
    }

    const newBank = new BankDetails({
      ...payload,
      organization: req.user.organization,
      user: req.user._id,
    });
    const saved = await newBank.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getLatestBankDetails = async (req, res) => {
  try {
    const bank = await getDefaultBankDetails(req.user.organization);
    res.json(bank);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllBankDetails = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { bank: { $regex: search, $options: "i" } },
        { accountHolder: { $regex: search, $options: "i" } },
        { branch: { $regex: search, $options: "i" } },
        { ifscCode: { $regex: search, $options: "i" } },
        { upi: { $regex: search, $options: "i" } },
      ];
    }

    const banks = await BankDetails.find(query).sort({ isDefault: -1, updatedAt: -1 });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBankDetailsById = async (req, res) => {
  try {
    const bank = await BankDetails.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!bank) {
      return res.status(404).json({ error: "Bank details not found" });
    }

    res.json(bank);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateBankDetails = async (req, res) => {
  try {
    if (req.params.id === "undefined") {
      const payload = sanitizeBankPayload(req.body);
      if (payload.isDefault) {
        await clearOtherDefaults(req.user.organization);
      }

      const newBank = new BankDetails({
        ...payload,
        organization: req.user.organization,
        user: req.user._id,
      });
      const saved = await newBank.save();
      return res.status(201).json(saved);
    }

    const payload = sanitizeBankPayload(req.body);

    if (payload.isDefault) {
      await clearOtherDefaults(req.user.organization, req.params.id);
    }

    const updated = await BankDetails.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      payload,
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

exports.setDefaultBankDetails = async (req, res) => {
  try {
    const bank = await BankDetails.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!bank) {
      return res.status(404).json({ error: "Bank details not found" });
    }

    await clearOtherDefaults(req.user.organization, bank._id);
    bank.isDefault = true;
    await bank.save();

    res.json(bank);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteBankDetails = async (req, res) => {
  try {
    const deleted = await BankDetails.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Bank details not found" });
    }

    if (deleted.isDefault) {
      const nextDefault = await BankDetails.findOne({
        organization: req.user.organization,
      }).sort({ updatedAt: -1 });

      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }

    res.json({ message: "Bank details deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
