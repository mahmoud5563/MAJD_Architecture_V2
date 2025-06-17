// backend/models/Contractor.js
const mongoose = require('mongoose');

const contractorSchema = new mongoose.Schema({
    contractorName: {
        type: String,
        required: true,
        trim: true,
        unique: true // اسم المقاول يجب أن يكون فريداً
    },
    phoneNumber: {
        type: String,
        required: false,
        trim: true
    },
    email: {
        type: String,
        required: false,
        trim: true,
        lowercase: true
    },
    address: {
        type: String,
        required: false,
        trim: true
    },
    // رصيد المقاول (المبلغ المستحق عليه/له)
    balance: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Contractor = mongoose.model('Contractor', contractorSchema);

module.exports = Contractor;
