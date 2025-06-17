// backend/models/ContractPayment.js
const mongoose = require('mongoose');

const contractPaymentSchema = new mongoose.Schema({
    contractAgreement: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContractAgreement',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    treasury: { // The treasury/account from which the payment was made
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Treasury', // Assuming you have a Treasury model
        required: true
    },
    description: { // Optional description for the payment
        type: String,
        required: false,
        trim: true
    }
}, { timestamps: true });

const ContractPayment = mongoose.model('ContractPayment', contractPaymentSchema);

module.exports = ContractPayment;
