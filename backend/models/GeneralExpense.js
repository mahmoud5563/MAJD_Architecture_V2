const mongoose = require('mongoose');

const generalExpenseSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    treasury: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Treasury',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for better query performance
generalExpenseSchema.index({ date: -1 });
generalExpenseSchema.index({ treasury: 1 });

module.exports = mongoose.model('GeneralExpense', generalExpenseSchema); 