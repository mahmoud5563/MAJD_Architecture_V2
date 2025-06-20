const express = require('express');
const router = express.Router();
const { auth, authorizeRoles } = require('../middleware/authMiddleware');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const ContractAgreement = require('../models/ContractAgreement');
const ContractPayment = require('../models/ContractPayment');
const Contractor = require('../models/Contractor');
const Category = require('../models/Category');
const Treasury = require('../models/Treasury');
const Client = require('../models/Client');
const GeneralExpense = require('../models/GeneralExpense');

// Export all data as JSON
router.get('/export', auth, authorizeRoles('Manager', 'مدير'), async (req, res) => {
  try {
    const data = {
      projects: await Project.find({}),
      transactions: await Transaction.find({}),
      users: await User.find({}),
      contractAgreements: await ContractAgreement.find({}),
      contractPayments: await ContractPayment.find({}),
      contractors: await Contractor.find({}),
      categories: await Category.find({}),
      treasuries: await Treasury.find({}),
      clients: await Client.find({}),
      generalExpenses: await GeneralExpense.find({}),
    };
    res.setHeader('Content-Disposition', 'attachment; filename=backup.json');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: 'فشل في تصدير النسخة الاحتياطية', error: err.message });
  }
});

// Import all data from JSON (WARNING: this will overwrite existing data)
router.post('/import', auth, authorizeRoles('Manager', 'مدير'), async (req, res) => {
  try {
    const data = req.body;
    if (!data) return res.status(400).json({ message: 'لا يوجد بيانات في الملف المرفوع.' });
    // حذف كل البيانات القديمة (تحذير: هذا يمسح كل شيء)
    await Promise.all([
      Project.deleteMany({}),
      Transaction.deleteMany({}),
      User.deleteMany({}),
      ContractAgreement.deleteMany({}),
      ContractPayment.deleteMany({}),
      Contractor.deleteMany({}),
      Category.deleteMany({}),
      Treasury.deleteMany({}),
      Client.deleteMany({}),
      GeneralExpense.deleteMany({}),
    ]);
    // استيراد البيانات الجديدة
    await Project.insertMany(data.projects || []);
    await Transaction.insertMany(data.transactions || []);
    await User.insertMany(data.users || []);
    await ContractAgreement.insertMany(data.contractAgreements || []);
    await ContractPayment.insertMany(data.contractPayments || []);
    await Contractor.insertMany(data.contractors || []);
    await Category.insertMany(data.categories || []);
    await Treasury.insertMany(data.treasuries || []);
    await Client.insertMany(data.clients || []);
    await GeneralExpense.insertMany(data.generalExpenses || []);
    res.status(200).json({ message: 'تم استيراد النسخة الاحتياطية بنجاح.' });
  } catch (err) {
    res.status(500).json({ message: 'فشل في استيراد النسخة الاحتياطية', error: err.message });
  }
});

module.exports = router; 