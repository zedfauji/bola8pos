const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StockMovementSchema = new Schema({
  transactionType: {
    type: String,
    enum: ['purchase', 'sale', 'adjustment_in', 'adjustment_out', 'transfer', 'waste', 'return'],
    required: true
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variant: {
    type: Schema.Types.ObjectId,
    ref: 'ProductVariant',
    default: null
  },
  fromLocation: {
    type: Schema.Types.ObjectId,
    ref: 'Location'
  },
  toLocation: {
    type: Schema.Types.ObjectId,
    ref: 'Location'
  },
  quantity: {
    type: Number,
    required: true
  },
  unitCost: {
    type: Number,
    min: 0,
    default: 0
  },
  referenceType: {
    type: String,
    enum: ['order', 'purchase_order', 'adjustment', 'transfer', 'waste', 'return', 'other'],
    default: 'adjustment'
  },
  referenceId: {
    type: Schema.Types.ObjectId
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Add indexes for common queries
StockMovementSchema.index({ product: 1 });
StockMovementSchema.index({ createdAt: -1 });
StockMovementSchema.index({ transactionType: 1 });
StockMovementSchema.index({ referenceType: 1, referenceId: 1 });

module.exports = mongoose.model('StockMovement', StockMovementSchema);
