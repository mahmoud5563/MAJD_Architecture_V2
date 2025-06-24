// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // لاستخدام bcrypt لتشفير كلمات المرور

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true, // يجب أن يكون اسم المستخدم فريدًا
        trim: true // إزالة المسافات الزائدة
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['مدير', 'مدير حسابات', 'مهندس'], // الأدوار المسموح بها
        default: 'مهندس' // دور افتراضي
    }
    
    
}, { timestamps: true }); // إضافة حقول createdAt و updatedAt تلقائيًا

// Hash the plain text password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) { // إذا لم يتم تعديل كلمة المرور
        return next();
    }
    const salt = await bcrypt.genSalt(10); // توليد "ملح" (salt) لتشفير كلمة المرور
    this.password = await bcrypt.hash(this.password, salt); // تشفير كلمة المرور
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password); // مقارنة كلمة المرور المدخلة بكلمة المرور المشفرة
};

const User = mongoose.model('User', userSchema);

module.exports = User;
