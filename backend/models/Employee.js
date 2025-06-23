const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    nationalId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: false,
        trim: true,
        lowercase: true
    },
    position: {
        type: String,
        required: true,
        enum: ['مدير', 'مهندس', 'محاسب', 'سكرتير', 'عامل', 'سائق', 'حارس', 'أخرى'],
        default: 'عامل'
    },
    department: {
        type: String,
        required: true,
        enum: ['إدارة', 'هندسة', 'محاسبة', 'أمن', 'صيانة', 'أخرى'],
        default: 'أخرى'
    },
    salary: {
        type: Number,
        required: true,
        min: 0
    },
    baseSalary: {
        type: Number,
        required: true,
        min: 0
    },
    hireDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['نشط', 'إجازة', 'متوقف', 'مستقيل'],
        default: 'نشط'
    },
    address: {
        type: String,
        required: false,
        trim: true
    },
    emergencyContact: {
        name: {
            type: String,
            required: false,
            trim: true
        },
        phone: {
            type: String,
            required: false,
            trim: true
        },
        relationship: {
            type: String,
            required: false,
            trim: true
        }
    },
    notes: {
        type: String,
        required: false,
        trim: true
    }
}, { timestamps: true });

// إنشاء index للبحث السريع
employeeSchema.index({ name: 1, nationalId: 1, phone: 1 });

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee; 