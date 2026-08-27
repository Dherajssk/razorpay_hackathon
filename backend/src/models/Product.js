const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  stock: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  specifications: {
    ram: {
      type: Number
    },
    storage: {
      type: Number
    },
    processor: {
      type: String
    },
    gpu: {
      type: String
    },
    refreshRate: {
      type: Number
    },
    screenSize: {
      type: Number
    }
  },
  rating: {
    type: Number,
    min: 0,
    max: 5
  },
  deliveryDays: {
    type: Number,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient searching
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ 'specifications.ram': 1 });
productSchema.index({ 'specifications.gpu': 1 });

module.exports = mongoose.model('Product', productSchema);
