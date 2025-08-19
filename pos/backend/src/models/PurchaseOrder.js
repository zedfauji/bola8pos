const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PurchaseOrderItemSchema = new Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  receivedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  }
});

const PurchaseOrderSchema = new Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  supplier: {
    type: Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  location: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'ordered', 'partial', 'received', 'cancelled'],
    default: 'draft'
  },
  items: [PurchaseOrderItemSchema],
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date
  },
  receivedDate: {
    type: Date
  },
  subtotal: {
    type: Number,
    min: 0,
    default: 0
  },
  taxAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  shippingCost: {
    type: Number,
    min: 0,
    default: 0
  },
  totalAmount: {
    type: Number,
    min: 0,
    default: 0
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

// Add indexes for common queries
PurchaseOrderSchema.index({ orderNumber: 1 });
PurchaseOrderSchema.index({ supplier: 1 });
PurchaseOrderSchema.index({ status: 1 });
PurchaseOrderSchema.index({ orderDate: -1 });

// Pre-save hook to calculate totals
PurchaseOrderSchema.pre('save', function(next) {
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitCost);
  }, 0);
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.taxAmount + this.shippingCost;
  
  next();
});

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
