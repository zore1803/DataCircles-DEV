// models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  dueDate: Date,
  selectedDate: Date,
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
  
  // Updated: Array of related entities
  relatedEntities: [{
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedEntities.entityModel'
    },
    entityModel: {
      type: String,
      enum: ['Company', 'Contact', 'Deal', 'Vendor']
    }
  }],
  
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
