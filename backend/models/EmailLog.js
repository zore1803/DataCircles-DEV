// models/EmailLog.js
const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  body: { type: String, required: true },
  toEmail: { type: String, required: true },
  fromEmail: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['sent', 'failed', 'pending'],
    default: 'pending'
  },
  response: mongoose.Schema.Types.Mixed, // Store SendGrid response or error
  recipientType: {
    type: String,
    enum: ['company', 'contact', 'vendor'],
    required: true
  },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

// Ensure only one recipient reference is set
emailLogSchema.pre('save', function(next) {
  const recipients = [this.company, this.contact, this.vendor].filter(Boolean);
  if (recipients.length !== 1) {
    return next(new Error('Exactly one recipient (company, contact, or vendor) must be specified'));
  }
  next();
});

module.exports = mongoose.model('EmailLog', emailLogSchema);