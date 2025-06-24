const mongoose = require('mongoose');

const salaryTransactionSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    type: {
        type: String,
        required: true,
        enum: ['salary', 'bonus', 'deduction', 'allowance', 'commission'],
        default: 'salary'
    },
    amount: {
        type: Number,
        required: true
    },
    salaryBefore: {
        type: Number,
        required: true,
        default: 0
    },
    salaryAfter: {
        type: Number,
        required: true,
        default: 0
    },
    notes: {
        type: String,
        required: false,
        trim: true
    }
}, { timestamps: true });

// إنشاء index للبحث السريع
salaryTransactionSchema.index({ employeeId: 1, date: -1 });
salaryTransactionSchema.index({ employeeId: 1, type: 1 });

const SalaryTransaction = mongoose.model('SalaryTransaction', salaryTransactionSchema);

module.exports = SalaryTransaction; 