const mongoose = require('mongoose');

const saleReturnSchema = new mongoose.Schema({
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true }, // مرجع الفاتورة الأصلية
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }, // مرجع العميل (اختياري)
    clientName: { type: String }, // اسم العميل (اختياري)
    items: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
            name: { type: String },
            quantity: { type: Number, required: true },
            unitPrice: { type: Number },
            total: { type: Number }
        }
    ],
    total: { type: Number, required: true },
    reason: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: false },
    treasury: { type: mongoose.Schema.Types.ObjectId, ref: 'Treasury', required: false },
});

module.exports = mongoose.model('SaleReturn', saleReturnSchema); 