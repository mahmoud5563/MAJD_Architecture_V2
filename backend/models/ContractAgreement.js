    // backend/models/ContractAgreement.js
    const mongoose = require('mongoose');

    const contractAgreementSchema = new mongoose.Schema({
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true
        },
        contractor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contractor',
            required: true
        },
        agreedAmount: { // المبلغ الإجمالي المتفق عليه مع المقاول لهذه الاتفاقية
            type: Number,
            required: true,
            min: 0
        },
        paidAmount: { // المبلغ الذي تم دفعه حتى الآن من هذه الاتفاقية
            type: Number,
            default: 0
        },
        description: {
            type: String,
            trim: true
        }
    }, { timestamps: true });

    // *** هذه السطور التي قد تسبب المشكلة يجب ألا تكون موجودة وغير موجودة في هذا الكود ***
    // contractAgreementSchema.index({ project: 1, contractor: 1 }, { unique: true });
    // أو
    // project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    // contractor: { type: mongoose.Schema.Types.ObjectId, ref: 'Contractor', required: true, unique: true },

    const ContractAgreement = mongoose.model('ContractAgreement', contractAgreementSchema);

    module.exports = ContractAgreement;
    