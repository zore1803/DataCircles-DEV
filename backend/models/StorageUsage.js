// models/StorageUsage.js
const mongoose = require('mongoose');

const storageUsageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  currentUsage: {
    type: Number,
    default: 0, // in bytes
    required: true
  },
  storageLimit: {
    type: Number,
    required: true,
    default: 1073741824 // 1GB in bytes (adjust based on plan)
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Method to check if user has space
storageUsageSchema.methods.hasSpace = function(fileSize) {
  return (this.currentUsage + fileSize) <= this.storageLimit;
};

// Method to get remaining space
storageUsageSchema.methods.getRemainingSpace = function() {
  return Math.max(0, this.storageLimit - this.currentUsage);
};

// Method to get usage percentage
storageUsageSchema.methods.getUsagePercentage = function() {
  return ((this.currentUsage / this.storageLimit) * 100).toFixed(2);
};

module.exports = mongoose.model('StorageUsage', storageUsageSchema);
