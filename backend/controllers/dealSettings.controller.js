// controllers/dealSettings.controller.js
const DealSettings = require('../models/dealSettings.model');

exports.getDealSettings = async (req, res) => {
  try {
    const organization = req.user.organization;

    let settings = await DealSettings.findOne({ organization });
    if (!settings) {
      settings = await new DealSettings({ organization, staleDays: 0 }).save();
    }
    res.json({ staleDays: settings.staleDays });
  } catch (error) {
    console.error('Error fetching deal settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateDealSettings = async (req, res) => {
  const { staleDays } = req.body;
  if (typeof staleDays !== 'number' || staleDays < 0) {
    return res.status(400).json({ message: 'Invalid staleDays value' });
  }

  try {
    const organization = req.user.organization;

    let settings = await DealSettings.findOne({ organization });
    if (!settings) {
      settings = new DealSettings({ organization });
    }
    settings.staleDays = staleDays;
    await settings.save();
    res.json({ staleDays: settings.staleDays });
  } catch (error) {
    console.error('Error updating deal settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
