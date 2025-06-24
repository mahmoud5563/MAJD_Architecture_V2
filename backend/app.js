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
const contractorsRoutes = require('./routes/contractors');
const contractAgreementsRoutes = require('./routes/contractAgreements');
const contractPaymentsRoutes = require('./routes/contractPayments');
const categoriesRoutes = require('./routes/categories');
const usersRoutes = require('./routes/users');
const generalExpensesRoutes = require('./routes/generalExpenses');
const filesRoutes = require('./routes/files');
const employeesRoutes = require('./routes/employees');

const { auth, authorizeRoles } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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
app.use('/api/contractors', contractorsRoutes);
app.use('/api/contract-agreements', contractAgreementsRoutes);
app.use('/api/contract-payments', contractPaymentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/general-expenses', generalExpensesRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/backup', require('./routes/backup'));

// تقديم الملفات الثابتة (frontend files)
app.use(express.static(path.join(__dirname, '../public')));

// المسار الرئيسي لتقديم صفحة تسجيل الدخول
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ميدل وير عام للتعامل مع أي خطأ غير متوقع
app.use((err, req, res, next) => {
    console.error('🔥 Unhandled Error:', err.stack);
    res.status(500).json({ message: 'حدث خطأ غير متوقع في الخادم.' });
});

module.exports = app; 