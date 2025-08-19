const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LocationSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['storage', 'sales', 'production', 'waste', 'other'],
    default: 'storage'
  },
  description: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  parentLocation: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    default: null
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add text index for search
LocationSchema.index({ 
  name: 'text', 
  description: 'text',
  'address.city': 'text'
});

module.exports = mongoose.model('Location', LocationSchema);
