// backend/models/Client.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    clientName: {
        type: String,
        required: true,
        trim: true,
        unique: true // اسم العميل يجب أن يكون فريداً
    },
    phoneNumber: {
        type: String,
        required: false, // رقم الهاتف ليس إلزامياً
        trim: true
    },
    email: {
        type: String,
        required: false, // البريد الإلكتروني ليس إلزامياً
        trim: true,
        lowercase: true,
        unique: false // يمكن أن يكون البريد الإلكتروني غير فريد إذا لم يتم إدخاله، أو فريد إذا كان مطلوبًا
                       // في هذه الحالة، سنبقيه غير فريد في البداية ما لم تطلب غير ذلك.
    }
}, { timestamps: true }); // إضافة حقول createdAt و updatedAt تلقائيًا

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
