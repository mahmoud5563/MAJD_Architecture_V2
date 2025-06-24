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
const Employee = require('../models/Employee');
const SalaryTransaction = require('../models/SalaryTransaction');

// Function to clean data and remove invalid references
const cleanDataForImport = (data) => {
  const cleaned = { ...data };
  
  // Clean general expenses - remove those with invalid category or treasury references
  if (cleaned.generalExpenses) {
    const validCategoryIds = new Set(cleaned.categories?.map(c => c._id?.toString()) || []);
    const validTreasuryIds = new Set(cleaned.treasuries?.map(t => t._id?.toString()) || []);
    const validUserIds = new Set(cleaned.users?.map(u => u._id?.toString()) || []);
    
    cleaned.generalExpenses = cleaned.generalExpenses.filter(expense => {
      const hasValidCategory = expense.category && validCategoryIds.has(expense.category.toString());
      const hasValidTreasury = expense.treasury && validTreasuryIds.has(expense.treasury.toString());
      const hasValidUser = expense.createdBy && validUserIds.has(expense.createdBy.toString());
      
      return hasValidCategory && hasValidTreasury && hasValidUser;
    });
  }
  
  return cleaned;
};

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
      employees: await Employee.find({}),
      salaryTransactions: await SalaryTransaction.find({}),
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
    
    // Clean data before import
    const cleanedData = cleanDataForImport(data);
    
    // Log import statistics
    const originalExpenseCount = data.generalExpenses?.length || 0;
    const cleanedExpenseCount = cleanedData.generalExpenses?.length || 0;
    const removedExpenses = originalExpenseCount - cleanedExpenseCount;
    
    if (removedExpenses > 0) {
      console.log(`Removed ${removedExpenses} general expenses with invalid references`);
    }
    
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
      Employee.deleteMany({}),
      SalaryTransaction.deleteMany({}),
    ]);
    
    // استيراد البيانات الجديدة بالترتيب الصحيح للمراجع
    try {
      const importResults = {};
      
      // 1. استيراد البيانات الأساسية أولاً (بدون مراجع)
      if (cleanedData.users && cleanedData.users.length > 0) {
        const result = await User.insertMany(cleanedData.users);
        importResults.users = result.length;
      }
      if (cleanedData.categories && cleanedData.categories.length > 0) {
        const result = await Category.insertMany(cleanedData.categories);
        importResults.categories = result.length;
      }
      if (cleanedData.treasuries && cleanedData.treasuries.length > 0) {
        const result = await Treasury.insertMany(cleanedData.treasuries);
        importResults.treasuries = result.length;
      }
      if (cleanedData.clients && cleanedData.clients.length > 0) {
        const result = await Client.insertMany(cleanedData.clients);
        importResults.clients = result.length;
      }
      if (cleanedData.contractors && cleanedData.contractors.length > 0) {
        const result = await Contractor.insertMany(cleanedData.contractors);
        importResults.contractors = result.length;
      }
      
      // 2. استيراد البيانات التي تعتمد على البيانات الأساسية
      if (cleanedData.projects && cleanedData.projects.length > 0) {
        const result = await Project.insertMany(cleanedData.projects);
        importResults.projects = result.length;
      }
      if (cleanedData.transactions && cleanedData.transactions.length > 0) {
        const result = await Transaction.insertMany(cleanedData.transactions);
        importResults.transactions = result.length;
      }
      if (cleanedData.contractAgreements && cleanedData.contractAgreements.length > 0) {
        const result = await ContractAgreement.insertMany(cleanedData.contractAgreements);
        importResults.contractAgreements = result.length;
      }
      if (cleanedData.contractPayments && cleanedData.contractPayments.length > 0) {
        const result = await ContractPayment.insertMany(cleanedData.contractPayments);
        importResults.contractPayments = result.length;
      }
      if (cleanedData.generalExpenses && cleanedData.generalExpenses.length > 0) {
        const result = await GeneralExpense.insertMany(cleanedData.generalExpenses);
        importResults.generalExpenses = result.length;
      }
      if (cleanedData.employees && cleanedData.employees.length > 0) {
        const result = await Employee.insertMany(cleanedData.employees);
        importResults.employees = result.length;
      }
      if (cleanedData.salaryTransactions && cleanedData.salaryTransactions.length > 0) {
        const result = await SalaryTransaction.insertMany(cleanedData.salaryTransactions);
        importResults.salaryTransactions = result.length;
      }
      
      console.log('Import completed successfully:', importResults);
      
      let message = 'تم استيراد النسخة الاحتياطية بنجاح.';
      if (removedExpenses > 0) {
        message += ` تم حذف ${removedExpenses} مصروف عام بسبب مراجع غير صحيحة.`;
      }
      
      res.status(200).json({ 
        message: message,
        importResults: importResults,
        removedExpenses: removedExpenses
      });
      
    } catch (insertError) {
      console.error('Error during data insertion:', insertError);
      return res.status(500).json({ 
        message: 'فشل في استيراد النسخة الاحتياطية', 
        error: insertError.message,
        details: 'حدث خطأ أثناء إدراج البيانات. تأكد من أن جميع المراجع صحيحة.',
        stack: process.env.NODE_ENV === 'development' ? insertError.stack : undefined
      });
    }
  } catch (err) {
    console.error('Backup import error:', err);
    res.status(500).json({ 
      message: 'فشل في استيراد النسخة الاحتياطية', 
      error: err.message 
    });
  }
});

module.exports = router; 