// models/Note.js
const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
  },
  note: {
    type: String,
    required: true,
  },
  noteType: {
    type: String,
    enum: ['Meeting Note', 'Call Note', 'General Note', 'Follow-up Note'],
    default: 'General Note',
  },
  visibility: {
    type: String,
    enum: ['Team', 'Private'],
    default: 'Team',
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  taggedContacts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
    },
  ],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
