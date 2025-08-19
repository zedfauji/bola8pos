const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sku: {
    type: String,
    trim: true,
    unique: true
  },
  barcode: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  cost: {
    type: Number,
    min: 0,
    default: 0
  },
  stock: {
    type: Number,
    min: 0,
    default: 0
  },
  minStockLevel: {
    type: Number,
    min: 0,
    default: 10
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category'
  },
  supplier: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  location: {
    type: Schema.Types.ObjectId,
    ref: 'Location'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isIngredient: {
    type: Boolean,
    default: false
  },
  isComposite: {
    type: Boolean,
    default: false
  },
  unitId: {
    type: Schema.Types.ObjectId,
    ref: 'Unit'
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
ProductSchema.index({ 
  name: 'text', 
  description: 'text', 
  sku: 'text', 
  barcode: 'text' 
});

module.exports = mongoose.model('Product', ProductSchema);
