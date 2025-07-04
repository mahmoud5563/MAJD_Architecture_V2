const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false }, // قد يكون صنف أو خدمة
    name: { type: String, required: true }, // اسم الصنف أو الخدمة
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true }
});

const saleSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: false },
    clientName: { type: String, required: false }, // في حال لم يكن العميل مسجلاً
    type: { type: String, enum: ['بضاعة', 'خدمة', 'مختلط'], required: true },
    items: [saleItemSchema],
    total: { type: Number, required: true },
    status: { type: String, enum: ['مدفوعة', 'غير مدفوعة', 'ملغاة', 'عرض سعر'], default: 'مدفوعة' },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    treasury: { type: mongoose.Schema.Types.ObjectId, ref: 'Treasury', required: false },
    paymentType: { type: String, enum: ['نقدي', 'أجل'], default: 'نقدي' },
    paymentMethod: { type: String, enum: ['كاش', 'تحويل بنكي'], default: 'كاش' },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: false },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema); 