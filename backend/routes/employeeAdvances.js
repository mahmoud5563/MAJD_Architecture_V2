const express = require('express');
const router = express.Router();
const EmployeeAdvance = require('../models/EmployeeAdvance');
const { auth } = require('../middleware/authMiddleware');

// جلب كل السلف لموظف معين
router.get('/employee/:employeeId', auth, async (req, res) => {
    try {
        const advances = await EmployeeAdvance.find({ employee: req.params.employeeId }).sort({ createdAt: -1 });
        res.json(advances);
    } catch (err) {
        res.status(500).json({ message: 'خطأ أثناء جلب السلف', error: err.message });
    }
});

// إضافة سلفة جديدة
router.post('/', auth, async (req, res) => {
    try {
        const { employee, amount, month, year, notes } = req.body;
        const advance = new EmployeeAdvance({ employee, amount, month, year, notes });
        await advance.save();
        res.status(201).json({ message: 'تمت إضافة السلفة بنجاح', advance });
    } catch (err) {
        res.status(500).json({ message: 'خطأ أثناء إضافة السلفة', error: err.message });
    }
});

// تعديل سلفة
router.put('/:id', auth, async (req, res) => {
    try {
        const { amount, month, year, notes } = req.body;
        const advance = await EmployeeAdvance.findByIdAndUpdate(
            req.params.id,
            { amount, month, year, notes },
            { new: true }
        );
        if (!advance) return res.status(404).json({ message: 'السلفة غير موجودة' });
        res.json({ message: 'تم تعديل السلفة بنجاح', advance });
    } catch (err) {
        res.status(500).json({ message: 'خطأ أثناء تعديل السلفة', error: err.message });
    }
});

// حذف سلفة
router.delete('/:id', auth, async (req, res) => {
    try {
        const advance = await EmployeeAdvance.findByIdAndDelete(req.params.id);
        if (!advance) return res.status(404).json({ message: 'السلفة غير موجودة' });
        res.json({ message: 'تم حذف السلفة بنجاح' });
    } catch (err) {
        res.status(500).json({ message: 'خطأ أثناء حذف السلفة', error: err.message });
    }
});

module.exports = router; 