const mongoose = require('mongoose');

const layoutSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  thumbnail: {
    type: String,
    required: true,
  },
  file: {
    type: [String],
    required: true,
  },
  techStack: {
    type: [String],
    default: [],
  },
  archived: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Layout', layoutSchema);
