// backend/models/Treasury.js
const mongoose = require('mongoose');

const treasurySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true // تأكد من أن اسم الخزينة فريد
    },
    initialBalance: {
        type: Number,
        required: true,
        default: 0
    },
    currentBalance: {
        type: Number,
        required: true,
        default: 0
    },
    description: {
        type: String,
        trim: true
    },
    type: { // نوع الخزينة: "خزينة", "عهدة"
        type: String,
        enum: ['خزينة', 'عهدة'],
        default: 'خزينة'
    },
    date: { // التاريخ المرتبط بإنشاء الخزينة/العهدة
        type: Date,
        required: true // جعل التاريخ مطلوبًا
    },
    reason: { // السبب (خاص بالعهدة أو وصف عام)
        type: String,
        trim: true
    },
    responsibleUser: { // المهندس المسؤول عن العهدة
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // اختياري، مطلوب فقط إذا كان النوع "عهدة"
    },
    project: { // المشروع المرتبط بالعهدة
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: false // اختياري، مطلوب فقط إذا كان النوع "عهدة"
    }
}, { timestamps: true }); // لتتبع تاريخ الإنشاء والتحديث

const Treasury = mongoose.model('Treasury', treasurySchema);

module.exports = Treasury;
