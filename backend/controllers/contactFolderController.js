const ContactFolder = require('../models/ContactFolder');
const Contact = require('../models/Contact');

// CREATE a folder
exports.createFolder = async (req, res) => {
  try {
    const { name, contacts } = req.body;
    
    // Validate that all contacts belong to the same organization
    if (contacts && contacts.length > 0) {
      const contactDocs = await Contact.find({
        _id: { $in: contacts },
        organization: req.user.organization
      });
      
      if (contactDocs.length !== contacts.length) {
        return res.status(400).json({ 
          error: 'Some contacts do not belong to your organization' 
        });
      }
    }
    
    const folder = new ContactFolder({ 
      name, 
      user: req.user._id, 
      organization: req.user.organization,
      contacts: contacts || []
    });
    
    await folder.save();
    res.status(201).json(folder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET all folders for the user's organization
exports.getAllFolders = async (req, res) => {
  try {
    const folders = await ContactFolder.find({
      organization: req.user.organization
    }).populate({
      path: 'contacts',
      match: { organization: req.user.organization }, // Ensure populated contacts are from same org
      populate: {
        path: 'company',
        match: { organization: req.user.organization }
      }
    }).populate('user', 'name email');
    
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET all folders created by the current user
exports.getMyFolders = async (req, res) => {
  try {
    const folders = await ContactFolder.find({
      user: req.user.id,
      organization: req.user.organization
    }).populate({
      path: 'contacts',
      match: { organization: req.user.organization },
      populate: {
        path: 'company',
        match: { organization: req.user.organization }
      }
    });
    
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET a single folder
exports.getFolderById = async (req, res) => {
  try {
    const folder = await ContactFolder.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate({
      path: 'contacts',
      match: { organization: req.user.organization },
      populate: {
        path: 'company',
        match: { organization: req.user.organization }
      }
    }).populate('user', 'name email');
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE folder (name or contacts)
exports.updateFolder = async (req, res) => {
  try {
    const { name, contacts } = req.body;
    
    // Check if folder exists and belongs to the organization
    const existingFolder = await ContactFolder.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!existingFolder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Validate that all new contacts belong to the same organization
    if (contacts && contacts.length > 0) {
      const contactDocs = await Contact.find({
        _id: { $in: contacts },
        organization: req.user.organization
      });
      
      if (contactDocs.length !== contacts.length) {
        return res.status(400).json({ 
          error: 'Some contacts do not belong to your organization' 
        });
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (contacts !== undefined) updateData.contacts = contacts;
    
    const folder = await ContactFolder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate({
      path: 'contacts',
      match: { organization: req.user.organization },
      populate: {
        path: 'company',
        match: { organization: req.user.organization }
      }
    });
    
    res.json(folder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ADD contact to folder
exports.addContactToFolder = async (req, res) => {
  try {
    const { contactId } = req.body;
    
    // Verify folder exists and belongs to organization
    const folder = await ContactFolder.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Verify contact exists and belongs to organization
    const contact = await Contact.findOne({
      _id: contactId,
      organization: req.user.organization
    });
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    // Add contact if not already in folder
    if (!folder.contacts.includes(contactId)) {
      folder.contacts.push(contactId);
      await folder.save();
    }
    
    const updatedFolder = await ContactFolder.findById(folder._id).populate({
      path: 'contacts',
      match: { organization: req.user.organization },
      populate: {
        path: 'company',
        match: { organization: req.user.organization }
      }
    });
    
    res.json(updatedFolder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// REMOVE contact from folder
exports.removeContactFromFolder = async (req, res) => {
  try {
    const { contactId } = req.body;
    
    const folder = await ContactFolder.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Remove contact from folder
    folder.contacts = folder.contacts.filter(
      contact => contact.toString() !== contactId
    );
    await folder.save();
    
    const updatedFolder = await ContactFolder.findById(folder._id).populate({
      path: 'contacts',
      match: { organization: req.user.organization },
      populate: {
        path: 'company',
        match: { organization: req.user.organization }
      }
    });
    
    res.json(updatedFolder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE a folder
exports.deleteFolder = async (req, res) => {
  try {
    const folder = await ContactFolder.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    await ContactFolder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET contacts not in any folder (for organization)
exports.getUnassignedContacts = async (req, res) => {
  try {
    // Get all folders for the organization
    const folders = await ContactFolder.find({
      organization: req.user.organization
    }).select('contacts');
    
    // Get all contact IDs that are in folders
    const contactsInFolders = folders.reduce((acc, folder) => {
      return acc.concat(folder.contacts);
    }, []);
    
    // Get contacts not in any folder
    const unassignedContacts = await Contact.find({
      organization: req.user.organization,
      _id: { $nin: contactsInFolders }
    }).populate('company');
    
    res.json(unassignedContacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
