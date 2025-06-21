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
    },
    attachments: [{
        filename: {
            type: String,
            required: true
        },
        originalName: {
            type: String,
            required: true
        },
        mimeType: {
            type: String,
            required: true
        },
        size: {
            type: Number,
            required: true
        },
        path: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

const ContractPayment = mongoose.model('ContractPayment', contractPaymentSchema);

module.exports = ContractPayment;
