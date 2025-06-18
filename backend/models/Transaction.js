// backend/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    treasury: { // الخزينة التي تمت فيها الحركة المالية
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Treasury',
        required: true
    },
    project: { // المشروع المرتبط بالمعاملة (إذا وجدت)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: false // المعاملة يمكن أن تكون غير مرتبطة بمشروع (مثل رواتب الموظفين العامة)
    },
    type: { // نوع المعاملة: 'إيداع' (إيراد), '' (مصروف), 'تحويل' (بين الخزائن), 'دفعة مقاول'
        type: String,
        enum: ['إيداع', 'مصروف', 'تحويل', 'دفعة مقاول'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0 // لا يمكن أن يكون المبلغ سالباً
    },
    description: {
        type: String,
        trim: true
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    category: { // تصنيف المصروفات (إذا كان النوع مصروف)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: function() { return this.type === 'مصروف'; }
    },
    vendor: { // البائع/المستفيد (إذا كان مصروف)
        type: String,
        trim: true,
        required: false // ليس إلزامياً
    },
    paymentMethod: { // طريقة الدفع/التحويل (إذا كان إيداع)
        type: String,
        enum: ['كاش', 'تحويل بنكي', 'شيك'],
    },
    // حقول خاصة بالتحويلات
    targetTreasury: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Treasury',
        required: function() { return this.type === 'تحويل'; } // مطلوب فقط إذا كان النوع 'تحويل'
    },
    // حقل خاص بدفعات المقاولين
    contractPayment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContractPayment',
        required: function() { return this.type === 'دفعة مقاول'; } // مطلوب فقط إذا كان النوع 'دفعة مقاول'
    }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
