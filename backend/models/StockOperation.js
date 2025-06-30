const mongoose = require('mongoose');

const stockOperationSchema = new mongoose.Schema({
  type: { type: String, enum: ['add', 'issue', 'transfer', 'بيع', 'استرجاع'], required: true }, // إضافة/صرف/تحويل/بيع/استرجاع
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  transferTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }, // لمخزن التحويل (اختياري)
  date: { type: Date, default: Date.now },
  notes: { type: String }
});

module.exports = mongoose.model('StockOperation', stockOperationSchema); 