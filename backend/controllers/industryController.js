const Industry = require('../models/Industry');

// Default 10 industries (seed data)
const defaultIndustries = [
  "Information Technology & Services",
  "Finance & Banking",
  "Healthcare & Pharmaceuticals",
  "Education & EdTech",
  "Retail & E-Commerce",
  "Manufacturing",
  "Real Estate",
  "Marketing & Advertising",
  "Travel & Hospitality",
  "Nonprofit / Government / Public Sector"
];

// Seed default industries if not already added
const ensureDefaultIndustries = async () => {
  const count = await Industry.countDocuments({ isDefault: true });
  if (count === 0) {
    const defaults = defaultIndustries.map(name => ({ name, isDefault: true }));
    await Industry.insertMany(defaults);
    console.log('✅ Default industries seeded');
  }
};

// CREATE custom industry
const createIndustry = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Industry name is required' });
    }

    // Check if industry already exists (for same organization)
    const existing = await Industry.findOne({
      name: { $regex: new RegExp('^' + name + '$', 'i') },
      organization: req.user.organization
    });

    if (existing) {
      return res.status(400).json({ error: 'Industry already exists' });
    }

    const industry = new Industry({
      name,
      isDefault: false,
      organization: req.user.organization,
      user: req.user.id
    });

    await industry.save();
    res.status(201).json(industry);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create industry: ' + err.message });
  }
};

// READ all industries (default + custom for org)
const getIndustries = async (req, res) => {
  try {
    await ensureDefaultIndustries();

    const industries = await Industry.find({
      $or: [
        { isDefault: true },
        { organization: req.user.organization }
      ]
    }).sort({ isDefault: -1, name: 1 });

    res.json(industries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch industries: ' + err.message });
  }
};

// UPDATE custom industry
const updateIndustry = async (req, res) => {
  try {
    const { name } = req.body;

    const industry = await Industry.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
        isDefault: false
      },
      { name },
      { new: true, runValidators: true }
    );

    if (!industry) {
      return res.status(404).json({ error: 'Industry not found or cannot modify default industry' });
    }

    res.json(industry);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update industry: ' + err.message });
  }
};

// DELETE custom industry
const deleteIndustry = async (req, res) => {
  try {
    const deleted = await Industry.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization,
      isDefault: false
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Industry not found or cannot delete default industry' });
    }

    res.json({ message: 'Industry deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete industry: ' + err.message });
  }
};

module.exports = {
  createIndustry,
  getIndustries,
  updateIndustry,
  deleteIndustry
};
