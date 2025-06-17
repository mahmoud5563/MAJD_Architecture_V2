// backend/models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    projectName: {
        type: String,
        required: true,
        trim: true,
        unique: true // اسم المشروع يجب أن يكون فريداً
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    engineer: { // المرجع للمهندس المسؤول عن المشروع (موديل User)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    client: { // المرجع للعميل المرتبط بالمشروع (موديل Client)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: false
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: false
    },
    status: {
        type: String,
        enum: ['جاري', 'مكتمل', 'معلق', 'ملغى'],
        default: 'جاري'
    },
    notes: {
        type: String,
        trim: true
    },
    // حقول لتلخيص الإيرادات والمصروفات للمشروع (سيتم تحديثها عبر الـ hook/middleware)
    totalRevenue: {
        type: Number,
        default: 0
    },
    totalExpenses: {
        type: Number,
        default: 0
    },
    // حقول لتلخيص اتفاقيات المقاولين للمشروع
    totalAgreedContractorAmount: {
        type: Number,
        default: 0
    },
    totalPaidContractorAmount: {
        type: Number,
        default: 0
    },
    // هذا هو الحقل الذي تم إضافته لضمان اكتمال تتبع دفعات المقاولين
    totalRemainingContractorAmount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
