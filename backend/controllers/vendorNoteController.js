const VendorNote = require('../models/VendorNote');

// CREATE Vendor Note
exports.createVendorNote = async (req, res) => {
  try {
    const { note, vendor } = req.body;
    const newVendorNote = await VendorNote.create({ 
      note, 
      vendor,
      user: req.user._id,
      organization: req.user.organization
    });
    
    const populatedNote = await VendorNote.findById(newVendorNote._id)
      .populate('vendor', 'name company email phone')
      .populate('user', 'name email');
    
    res.status(201).json(populatedNote);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create vendor note', details: err.message });
  }
};

// GET all notes for a vendor
exports.getNotesByVendor = async (req, res) => {
  try {
    const notes = await VendorNote.find({ 
      vendor: req.params.vendorId,
      organization: req.user.organization 
    })
      .populate('user', 'name email')
      .populate('vendor', 'name company')
      .sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor notes' });
  }
};

// GET all vendor notes for organization
exports.getAllVendorNotes = async (req, res) => {
  try {
    const { search, vendor, limit = 50 } = req.query;
    
    let query = { organization: req.user.organization };
    
    if (search) {
      query.note = { $regex: search, $options: 'i' };
    }
    
    if (vendor) {
      query.vendor = vendor;
    }
    
    const notes = await VendorNote.find(query)
      .populate('vendor', 'name company email phone')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
      
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vendor notes' });
  }
};

// GET single note
exports.getVendorNoteById = async (req, res) => {
  try {
    const note = await VendorNote.findOne({
      _id: req.params.id,
      organization: req.user.organization
    })
      .populate('vendor', 'name company email phone')
      .populate('user', 'name email');
      
    if (!note) {
      return res.status(404).json({ error: 'Vendor note not found' });
    }
    
    res.json(note);
  } catch (err) {
    res.status(404).json({ error: 'Vendor note not found' });
  }
};

// UPDATE note content
exports.updateVendorNote = async (req, res) => {
  try {
    const { note } = req.body;
    
    const updated = await VendorNote.findOneAndUpdate(
      { 
        _id: req.params.id,
        organization: req.user.organization 
      },
      { note },
      { new: true }
    )
      .populate('vendor', 'name company email phone')
      .populate('user', 'name email');
      
    if (!updated) {
      return res.status(404).json({ error: 'Vendor note not found' });
    }
    
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update vendor note' });
  }
};

// DELETE vendor note
exports.deleteVendorNote = async (req, res) => {
  try {
    const deleted = await VendorNote.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!deleted) {
      return res.status(404).json({ error: 'Vendor note not found' });
    }
    
    res.json({ message: 'Vendor note deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vendor note' });
  }
};
