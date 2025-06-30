const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  purchasePrice: { type: Number },
  salePrice: { type: Number },
  initialQty: { type: Number, default: 0 },
  barcode: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('Product', productSchema); 