const mongoose = require('mongoose');

const companyFolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  companies: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
    },
  ],
  organization: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Organization', 
      required: true 
    },
}, { timestamps: true });

module.exports = mongoose.model('CompanyFolder', companyFolderSchema);
