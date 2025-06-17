// backend/routes/treasuries.js
const express = require('express');
const router = express.Router();
const Treasury = require('../models/Treasury'); // استيراد موديل الخزينة
const User = require('../models/User'); // لاستيراد موديل المستخدم
const Project = require('../models/Project'); // لاستيراد موديل المشروع
const Transaction = require('../models/Transaction'); // استيراد موديل المعاملات الجديد
const { auth, authorizeRoles } = require('../middleware/authMiddleware'); // استيراد الـ middleware

// @route   POST /api/treasuries
// @desc    Add a new treasury
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const { name, initialBalance, description, type, date, reason, responsibleUser, project } = req.body;

    try {
        // التحقق من أن اسم الخزينة فريد
        let treasury = await Treasury.findOne({ name });
        if (treasury) {
            return res.status(400).json({ message: 'خزينة بهذا الاسم موجودة بالفعل.' });
        }

        // منطق التحقق الخاص بنوع "عهدة"
        if (type === 'عهدة') {
            if (!responsibleUser) {
                return res.status(400).json({ message: 'يجب تحديد مهندس مسؤول للعهدة.' });
            }
            if (!project) {
                return res.status(400).json({ message: 'يجب تحديد مشروع للعهدة.' });
            }

            // التحقق من وجود المهندس
            const existingEngineer = await User.findById(responsibleUser);
            if (!existingEngineer || existingEngineer.role !== 'مهندس') {
                return res.status(400).json({ message: 'المهندس المسؤول المحدد غير موجود أو ليس لديه دور مهندس.' });
            }
            // التحقق من وجود المشروع
            const existingProject = await Project.findById(project);
            if (!existingProject) {
                return res.status(400).json({ message: 'المشروع المحدد غير موجود.' });
            }
        }

        const newTreasury = new Treasury({
            name,
            initialBalance: initialBalance || 0,
            currentBalance: initialBalance || 0, // الرصيد الحالي يبدأ بالرصيد الأولي
            description,
            type,
            date,
            reason,
            responsibleUser: type === 'عهدة' ? responsibleUser : undefined, // حفظ فقط إذا كان النوع "عهدة"
            project: type === 'عهدة' ? project : undefined // حفظ فقط إذا كان النوع "عهدة"
        });

        await newTreasury.save();
        res.status(201).json({ message: 'تم إضافة الخزينة بنجاح.', treasury: newTreasury });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة الخزينة.');
    }
});

// @route   GET /api/treasuries
// @desc    Get all treasuries
// @access  Private (All authenticated users)
router.get('/', auth, async (req, res) => {
    try {
        // إضافة populate لجلب تفاصيل المهندس والمشروع المرتبطين
        const treasuries = await Treasury.find({})
            .populate('responsibleUser', 'username') // جلب اسم المستخدم للمهندس المسؤول
            .populate('project', 'projectName'); // جلب اسم المشروع المرتبط

        res.json(treasuries);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب الخزائن.');
    }
});

// @route   GET /api/treasuries/:id
// @desc    Get treasury by ID
// @access  Private (All authenticated users)
router.get('/:id', auth, async (req, res) => {
    try {
        const treasury = await Treasury.findById(req.params.id)
            .populate('responsibleUser', 'username')
            .populate('project', 'projectName');

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }
        res.json(treasury);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الخزينة غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب تفاصيل الخزينة.');
    }
});

// @route   GET /api/treasuries/:id/details
// @desc    Get full treasury details including all transactions
// @access  Private (Manager, Accountant Manager)
router.get('/:id/details', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const treasuryId = req.params.id;
        const treasury = await Treasury.findById(treasuryId)
            .populate('responsibleUser', 'username')
            .populate('project', 'projectName');

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        // جلب جميع المعاملات المرتبطة بهذه الخزينة
        const transactions = await Transaction.find({
            $or: [
                { treasury: treasuryId },
                { targetTreasury: treasuryId, type: 'تحويل' } // معاملات التحويل التي كانت هذه الخزينة هي الهدف
            ]
        })
        .populate('treasury', 'name')
        .populate('targetTreasury', 'name')
        .populate('recordedBy', 'username')
        .sort({ date: 1, createdAt: 1 }); // فرز حسب التاريخ ثم تاريخ الإنشاء

        // حساب الملخصات المالية من المعاملات
        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let initialBalanceFromTransactions = treasury.initialBalance; // استخدم الرصيد الأولي المخزن في الموديل

        // ملاحظة: الرصيد الحالي يتم تحديثه في موديل الخزينة مباشرة عند كل معاملة POST.
        // يمكننا إعادة حسابه هنا للتأكد، ولكن يجب أن يكون مطابقاً لـ treasury.currentBalance

        transactions.forEach(trans => {
            if (trans.treasury._id.toString() === treasuryId.toString()) { // إذا كانت الخزينة هي المصدر
                if (trans.type === 'إيداع') {
                    // المبلغ المدفوع (إيداع)
                    totalDeposits += trans.amount;
                } else if (trans.type === 'سحب') {
                    // المبلغ المسحوب (سحب)
                    totalWithdrawals += trans.amount;
                } else if (trans.type === 'تحويل') {
                    // المبلغ المحول منها
                    totalWithdrawals += trans.amount;
                }
            } else if (trans.targetTreasury && trans.targetTreasury._id.toString() === treasuryId.toString() && trans.type === 'تحويل') {
                // المبلغ المحول إليها
                totalDeposits += trans.amount;
            }
        });

        const currentCalculatedBalance = initialBalanceFromTransactions + totalDeposits - totalWithdrawals;


        res.json({
            ...treasury.toObject(), // تحويل مستند Mongoose إلى كائن JavaScript عادي
            transactions,
            totalDeposits,
            totalWithdrawals,
            // currentBalance: currentCalculatedBalance // يمكن إرجاع هذا بدلاً من الموجود في الموديل للمقارنة
        });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الخزينة غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب تفاصيل الخزينة الكاملة.');
    }
});


// @route   PUT /api/treasuries/:id
// @desc    Update a treasury
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const { name, initialBalance, description, type, date, reason, responsibleUser, project } = req.body;

    try {
        let treasury = await Treasury.findById(req.params.id);

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        // التحقق من تكرار اسم الخزينة عند التحديث
        const existingTreasury = await Treasury.findOne({ name });
        if (existingTreasury && existingTreasury._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'خزينة أخرى بهذا الاسم موجودة بالفعل.' });
        }

        // التحقق من تغيير النوع إلى "عهدة" وتوفير الحقول المطلوبة
        if (type === 'عهدة') {
            if (!responsibleUser) {
                return res.status(400).json({ message: 'يجب تحديد مهندس مسؤول للعهدة.' });
            }
            if (!project) {
                return res.status(400).json({ message: 'يجب تحديد مشروع للعهدة.' });
            }
            const existingEngineer = await User.findById(responsibleUser);
            if (!existingEngineer || existingEngineer.role !== 'مهندس') {
                return res.status(400).json({ message: 'المهندس المسؤول المحدد غير موجود أو ليس لديه دور مهندس.' });
            }
            const existingProject = await Project.findById(project);
            if (!existingProject) {
                return res.status(400).json({ message: 'المشروع المحدد غير موجود.' });
            }
        }

        treasury.name = name || treasury.name;
        
        // عند تغيير الرصيد الأولي: يجب إعادة حساب الرصيد الحالي
        if (initialBalance !== undefined && treasury.initialBalance !== initialBalance) {
            const balanceChange = initialBalance - treasury.initialBalance;
            treasury.initialBalance = initialBalance;
            treasury.currentBalance += balanceChange; // adjust current balance based on initial balance change
        }

        treasury.description = description || treasury.description;
        treasury.type = type || treasury.type;
        treasury.date = date || treasury.date;
        treasury.reason = reason || treasury.reason;

        // تحديث responsibleUser و project بناءً على النوع
        if (type === 'عهدة') {
            treasury.responsibleUser = responsibleUser;
            treasury.project = project;
        } else {
            treasury.responsibleUser = undefined;
            treasury.project = undefined;
        }


        await treasury.save();
        res.json({ message: 'تم تحديث الخزينة بنجاح.', treasury });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الخزينة، المهندس، أو المشروع غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث الخزينة.');
    }
});

// @route   DELETE /api/treasuries/:id
// @desc    Delete a treasury
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const treasury = await Treasury.findById(req.params.id);

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        // التحقق مما إذا كانت الخزينة تحتوي على معاملات مالية قبل الحذف
        const associatedTransactions = await Transaction.countDocuments({
            $or: [{ treasury: req.params.id }, { targetTreasury: req.params.id }]
        });

        if (associatedTransactions > 0) {
            return res.status(400).json({ message: 'لا يمكن حذف هذه الخزينة لأنها تحتوي على معاملات مالية مرتبطة. يرجى حذف المعاملات المرتبطة أولاً أو تحويلها.' });
        }
        
        // لا يمكن حذف الخزينة الرئيسية (إذا كان هناك نوع رئيسي في المستقبل)
        // حالياً، لدينا "خزينة" و "عهدة" فقط.
        if (treasury.type === 'رئيسية') { // If we ever re-introduce a 'رئيسية' type
            return res.status(400).json({ message: 'لا يمكن حذف الخزينة الرئيسية.' });
        }


        await Treasury.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف الخزينة بنجاح.' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الخزينة غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف الخزينة.');
    }
});

module.exports = router;
