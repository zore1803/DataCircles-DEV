const SystemSettings = require('../models/SystemSettings');

// Default locked arrays
const DEFAULT_TASK_STATUSES = ['Pending', 'In Progress', 'Completed'];
const DEFAULT_NOTE_TYPES = ['General Note', 'Meeting Note', 'Call Note', 'Follow-up Note'];
const DEFAULT_MEETING_TYPES = ['General Meeting', 'Client Call', 'Demo', 'Follow-up'];

// Get system settings for the organization
exports.getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ organization: req.user.organization });
    
    if (!settings) {
      settings = await SystemSettings.create({ organization: req.user.organization });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ message: 'Error fetching system settings', error: error.message });
  }
};

// Update task statuses
exports.updateTaskStatuses = async (req, res) => {
  try {
    const { statuses } = req.body;
    
    if (!Array.isArray(statuses)) {
      return res.status(400).json({ message: 'Statuses must be an array' });
    }

    // Ensure default statuses are never removed
    const missingDefaults = DEFAULT_TASK_STATUSES.filter(s => !statuses.includes(s));
    if (missingDefaults.length > 0) {
      return res.status(400).json({ message: `Cannot remove default task statuses: ${missingDefaults.join(', ')}` });
    }

    let settings = await SystemSettings.findOne({ organization: req.user.organization });
    if (!settings) {
      settings = new SystemSettings({ organization: req.user.organization });
    }
    
    settings.taskStatuses = statuses;
    await settings.save();
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating task statuses:', error);
    res.status(500).json({ message: 'Error updating task statuses', error: error.message });
  }
};

// Update meeting types
exports.updateMeetingTypes = async (req, res) => {
  try {
    const { meetingTypes } = req.body;

    if (!Array.isArray(meetingTypes)) {
      return res.status(400).json({ message: 'Meeting types must be an array' });
    }

    const missingDefaults = DEFAULT_MEETING_TYPES.filter(t => !meetingTypes.includes(t));
    if (missingDefaults.length > 0) {
      return res.status(400).json({ message: `Cannot remove default meeting types: ${missingDefaults.join(', ')}` });
    }

    let settings = await SystemSettings.findOne({ organization: req.user.organization });
    if (!settings) {
      settings = new SystemSettings({ organization: req.user.organization });
    }

    settings.meetingTypes = meetingTypes;
    await settings.save();

    res.json(settings);
  } catch (error) {
    console.error('Error updating meeting types:', error);
    res.status(500).json({ message: 'Error updating meeting types', error: error.message });
  }
};

// Update note types
exports.updateNoteTypes = async (req, res) => {
  try {
    const { noteTypes } = req.body;
    
    if (!Array.isArray(noteTypes)) {
      return res.status(400).json({ message: 'Note types must be an array' });
    }

    // Ensure default note types are never removed
    const missingDefaults = DEFAULT_NOTE_TYPES.filter(t => !noteTypes.includes(t));
    if (missingDefaults.length > 0) {
      return res.status(400).json({ message: `Cannot remove default note types: ${missingDefaults.join(', ')}` });
    }

    let settings = await SystemSettings.findOne({ organization: req.user.organization });
    if (!settings) {
      settings = new SystemSettings({ organization: req.user.organization });
    }
    
    settings.noteTypes = noteTypes;
    await settings.save();
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating note types:', error);
    res.status(500).json({ message: 'Error updating note types', error: error.message });
  }
};
