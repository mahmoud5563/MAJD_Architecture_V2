const express = require('express');
const path = require('path');
const router = express.Router();
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const JournalEntryLine = require('../models/JournalEntryLine');
const multer = require('multer');

// ===================== الحسابات العامة =====================

// عرض كل الحسابات
// router.get('/accounts', ...);

// إضافة حساب جديد
router.post('/add', async (req, res) => {
  try {
    const { name, code, type, parent, notes, active } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'الاسم والكود مطلوبان' });
    const exists = await Account.findOne({ code });
    if (exists) return res.status(400).json({ message: 'كود الحساب مستخدم بالفعل' });
    const acc = new Account({ name, code, type, parent: parent || null, notes, active });
    await acc.save();
    res.json({ message: 'تم إضافة الحساب بنجاح', account: acc });
  } catch (err) {
    res.status(500).json({ message: 'خطأ أثناء إضافة الحساب' });
  }
});

// ===================== القيود اليومية =====================

// عرض كل القيود
// router.get('/journal-entries', ...);

// إضافة قيد جديد
// router.post('/journal-entries', ...);

// ===================== التقارير المالية =====================

// إعداد رفع الملفات للمرفقات
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'attachment-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// API: جلب شجرة الحسابات (قائمة الحسابات)
router.get('/accounts-tree', async (req, res) => {
  try {
    const accounts = await Account.find({ active: true }).select('name code type parent');
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب الحسابات' });
  }
});

// API: إضافة قيد يومي جديد
router.post('/add-journal-entry', upload.single('attachment'), async (req, res) => {
  try {
    const { date, description, lines } = req.body;
    if (!date || !description || !lines) {
      return res.status(400).json({ message: 'يرجى إدخال جميع البيانات المطلوبة' });
    }
    const parsedLines = JSON.parse(lines);
    // تحقق من تساوي المدين والدائن
    let totalDebit = 0, totalCredit = 0;
    parsedLines.forEach(l => {
      totalDebit += Number(l.debit) || 0;
      totalCredit += Number(l.credit) || 0;
    });
    if (totalDebit !== totalCredit || totalDebit === 0) {
      return res.status(400).json({ message: 'يجب أن يكون مجموع المدين مساوياً لمجموع الدائن' });
    }
    // حفظ القيد
    const entry = new JournalEntry({
      date,
      description,
      attachment: req.file ? req.file.filename : undefined
    });
    await entry.save();
    // حفظ البنود
    const linesDocs = [];
    for (const l of parsedLines) {
      const acc = await Account.findById(l.account);
      if (!acc) continue;
      const line = new JournalEntryLine({
        entry: entry._id,
        account: acc._id,
        debit: l.debit,
        credit: l.credit,
        tax: l.tax || 0,
        taxType: l.taxType || 'percent'
      });
      await line.save();
      linesDocs.push(line._id);
    }
    entry.lines = linesDocs;
    await entry.save();
    res.json({ message: 'تم حفظ القيد بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ أثناء حفظ القيد' });
  }
});

// إضافة قيد محاسبي
router.get('/add-journal-entry', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/add-journal-entry.html'));
});

// دفتر الأستاذ
router.get('/ledger', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/ledger.html'));
});

// ميزان المراجعة
router.get('/trial-balance', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/trial-balance.html'));
});

// قائمة الدخل
router.get('/income-statement', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/income-statement.html'));
});

// الميزانية العمومية
router.get('/balance-sheet', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/balance-sheet.html'));
});

// تقرير الأرباح والخسائر
// router.get('/profit-loss', ...);

// تعديل حساب
router.put('/edit/:id', async (req, res) => {
  try {
    const { name, code, type, parent, notes, active } = req.body;
    const acc = await Account.findById(req.params.id);
    if (!acc) return res.status(404).json({ message: 'الحساب غير موجود' });
    if (code && code !== acc.code) {
      const exists = await Account.findOne({ code });
      if (exists) return res.status(400).json({ message: 'كود الحساب مستخدم بالفعل' });
    }
    acc.name = name ?? acc.name;
    acc.code = code ?? acc.code;
    acc.type = type ?? acc.type;
    acc.parent = parent ?? acc.parent;
    acc.notes = notes ?? acc.notes;
    acc.active = active ?? acc.active;
    await acc.save();
    res.json({ message: 'تم تعديل الحساب بنجاح', account: acc });
  } catch (err) {
    res.status(500).json({ message: 'خطأ أثناء تعديل الحساب' });
  }
});

// حذف حساب
router.delete('/delete/:id', async (req, res) => {
  try {
    const acc = await Account.findById(req.params.id);
    if (!acc) return res.status(404).json({ message: 'الحساب غير موجود' });
    // تحقق من عدم وجود بنود مرتبطة بالحساب
    const used = await JournalEntryLine.findOne({ account: acc._id });
    if (used) return res.status(400).json({ message: 'لا يمكن حذف الحساب لارتباطه بقيود محاسبية' });
    await acc.deleteOne();
    res.json({ message: 'تم حذف الحساب بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ أثناء حذف الحساب' });
  }
});

// دفتر الأستاذ (General Ledger)
router.get('/general-ledger', async (req, res) => {
  try {
    const { accountId, from, to } = req.query;
    if (!accountId) return res.status(400).json({ message: 'يرجى اختيار الحساب' });
    const filter = { account: accountId };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    // جلب البنود المرتبطة بالحساب
    const lines = await require('../models/JournalEntryLine').find(filter)
      .populate('entry', 'date description')
      .sort({ 'entry.date': 1, _id: 1 });
    // تجهيز النتائج مع الرصيد التراكمي
    let balance = 0;
    const result = lines.map(line => {
      balance += (line.debit || 0) - (line.credit || 0);
      return {
        date: line.entry?.date,
        description: line.entry?.description,
        debit: line.debit,
        credit: line.credit,
        balance: balance,
        tax: line.tax || 0,
        taxType: line.taxType || 'percent'
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب دفتر الأستاذ' });
  }
});

// ==========================================================

module.exports = router; 