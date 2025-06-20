// backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

// استيراد جميع المسارات والميدل وير
const authRoutes = require('./routes/auth');
const projectsRoutes = require('./routes/projects');
const clientsRoutes = require('./routes/clients');
const treasuriesRoutes = require('./routes/treasuries');
const transactionsRoutes = require('./routes/transactions');
const contractorsRoutes = require('./routes/contractors'); // استيراد مسار المقاولين
const contractAgreementsRoutes = require('./routes/contractAgreements'); // استيراد مسار اتفاقيات المقاولين
const contractPaymentsRoutes = require('./routes/contractPayments'); // استيراد مسار دفعات المقاولين
const categoriesRoutes = require('./routes/categories'); // تم إضافة هذا المسار
const usersRoutes = require('./routes/users');         // تم إضافة هذا المسار
const generalExpensesRoutes = require('./routes/generalExpenses'); // استيراد مسار المصروفات العامة

const { auth, authorizeRoles } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // لتمكين الخادم من فهم الـ JSON في الطلبات

// الاتصال بقاعدة البيانات MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB...', err));

// استخدام مسارات الـ API
app.use('/api', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/treasuries', treasuriesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/contractors', contractorsRoutes); // استخدام مسار المقاولين
app.use('/api/contract-agreements', contractAgreementsRoutes); // استخدام مسار اتفاقيات المقاولين
app.use('/api/contract-payments', contractPaymentsRoutes); // استخدام مسار دفعات المقاولين
app.use('/api/categories', categoriesRoutes); // استخدام مسار التصنيفات
app.use('/api/users', usersRoutes);         // استخدام مسار المستخدمين
app.use('/api/general-expenses', generalExpensesRoutes); // استخدام مسار المصروفات العامة
app.use('/api/backup', require('./routes/backup'));

// ******* أمثلة لمسارات API محمية (يمكن إزالتها لاحقًا) *******
app.get('/api/protected', auth, (req, res) => {
    res.json({
        message: `مرحباً ${req.user.username || 'مستخدم'}، لقد وصلت إلى مسار محمي!`,
        userId: req.user.id,
        userRole: req.user.role
    });
});

// تقديم الملفات الثابتة (frontend files)
app.use(express.static(path.join(__dirname, '../public')));

// المسار الرئيسي لتقديم صفحة تسجيل الدخول
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ميدل وير عام للتعامل مع أي خطأ غير متوقع في أي Route
app.use((err, req, res, next) => {
    console.error('🔥 Unhandled Error:', err.stack);
    res.status(500).json({ message: 'حدث خطأ غير متوقع في الخادم.' });
});


// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});
