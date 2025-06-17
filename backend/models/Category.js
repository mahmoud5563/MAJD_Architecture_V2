// backend/models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // تأكد من أن اسم التصنيف فريد
        trim: true // إزالة المسافات الزائدة
    },
    description: {
        type: String,
        trim: true // إزالة المسافات الزائدة (اختياري)
    }
}, { timestamps: true }); // لتتبع تاريخ الإنشاء والتحديث

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
