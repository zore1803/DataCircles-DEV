const mongoose = require('mongoose');

const contactFolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true 
  },
  contacts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model('ContactFolder', contactFolderSchema);
