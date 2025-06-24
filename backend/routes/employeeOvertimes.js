const express = require('express');
const router = express.Router();
const EmployeeOvertime = require('../models/EmployeeOvertime');
const { auth } = require('../middleware/authMiddleware');

// جلب كل الأوفر تايم لموظف معين
router.get('/employee/:employeeId', auth, async (req, res) => {
    try {
        const overtimes = await EmployeeOvertime.find({ employee: req.params.employeeId }).sort({ createdAt: -1 });
        res.json(overtimes);
    } catch (err) {
        res.status(500).json({ message: 'خطأ أثناء جلب الأوفر تايم', error: err.message });
    }
});

// إضافة أوفر تايم جديد
router.post('/', auth, async (req, res) => {
    try {
        const { employee, amount, month, year, notes } = req.body;
        const overtime = new EmployeeOvertime({ employee, amount, month, year, notes });
        await overtime.save();
        res.status(201).json({ message: 'تمت إضافة الأوفر تايم بنجاح', overtime });
    } catch (err) {
        res.status(500).json({ message: 'خطأ أثناء إضافة الأوفر تايم', error: err.message });
    }
});

// تعديل أوفر تايم
router.put('/:id', auth, async (req, res) => {
    try {
        const { amount, month, year, notes } = req.body;
        const overtime = await EmployeeOvertime.findByIdAndUpdate(
            req.params.id,
            { amount, month, year, notes },
            { new: true }
        );
        if (!overtime) return res.status(404).json({ message: 'الأوفر تايم غير موجود' });
        res.json({ message: 'تم تعديل الأوفر تايم بنجاح', overtime });
    } catch (err) {
        res.status(500).json({ message: 'خطأ أثناء تعديل الأوفر تايم', error: err.message });
    }
});

// حذف أوفر تايم
router.delete('/:id', auth, async (req, res) => {
    try {
        const overtime = await EmployeeOvertime.findByIdAndDelete(req.params.id);
        if (!overtime) return res.status(404).json({ message: 'الأوفر تايم غير موجود' });
        res.json({ message: 'تم حذف الأوفر تايم بنجاح' });
    } catch (err) {
        res.status(500).json({ message: 'خطأ أثناء حذف الأوفر تايم', error: err.message });
    }
});

module.exports = router; 