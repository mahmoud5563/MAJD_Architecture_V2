// backend/routes/projects.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project'); // استيراد موديل المشروع
const User = require('./../models/User'); // لاستيراد موديل المستخدم (للمهندسين)
const Client = require('./../models/Client'); // لاستيراد موديل العميل
const Transaction = require('./../models/Transaction'); // افتراض وجود هذا الموديل للمصروفات والإيرادات
const ContractAgreement = require('./../models/ContractAgreement'); // افتراض وجود هذا الموديل لاتفاقيات المقاولين
const ContractPayment = require('./../models/ContractPayment'); // افتراض وجود هذا الموديل لدفعات المقاولين

const { auth, authorizeRoles } = require('../middleware/authMiddleware'); // استيراد الـ middleware للتحقق من الصلاحيات

// @route   POST /api/projects
// @desc    Add a new project
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const {
        projectName,
        address,
        description,
        engineer,
        client,
        startDate,
        endDate,
        notes,
        status
    } = req.body;

    try {
        // التحقق من أن المهندس (إن وجد) موجود بالفعل في قاعدة البيانات ودوره 'مهندس'
        if (engineer) {
            const existingEngineer = await User.findById(engineer);
            if (!existingEngineer || existingEngineer.role !== 'مهندس') {
                return res.status(400).json({ message: 'المهندس المحدد غير موجود أو ليس لديه دور مهندس.' });
            }
        }

        // التحقق من أن العميل (إن وجد) موجود بالفعل في قاعدة البيانات
        if (client) {
            const existingClient = await Client.findById(client);
            if (!existingClient) {
                return res.status(400).json({ message: 'العميل المحدد غير موجود.' });
            }
        }

        const newProject = new Project({
            projectName,
            address,
            description,
            engineer,
            client,
            startDate,
            endDate,
            notes,
            status
        });

        const project = await newProject.save();
        res.status(201).json({ message: 'تم إضافة المشروع بنجاح.', project });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المهندس أو العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة المشروع.');
    }
});

// @route   GET /api/projects
// @desc    Get all projects (with optional filters)
// @access  Private (All authenticated users, with role-based filtering)
router.get('/', auth, async (req, res) => {
    try {
        const { name, status } = req.query; // جلب فلاتر البحث من الـ query parameters
        const filter = {};

        if (name) {
            filter.projectName = { $regex: name, $options: 'i' }; // بحث غير حساس لحالة الأحرف
        }
        if (status) {
            filter.status = status;
        }

        // منطق تصفية المشاريع بناءً على دور المستخدم
        if (req.user.role === 'مهندس') {
            filter.engineer = req.user.id; // فلترة المشاريع بناءً على ID المهندس المسجل دخوله
        }

        const projects = await Project.find(filter)
            .populate('engineer', 'username') // جلب اسم المستخدم للمهندس
            .populate('client', 'clientName'); // جلب اسم العميل للعميل

        res.json(projects);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب المشاريع.');
    }
});

// @route   GET /api/projects/engineers
// @desc    Get a list of all engineers (for project assignment dropdown)
// @access  Private (Any authenticated user)
router.get('/engineers', auth, async (req, res) => {
    try {
        const engineers = await User.find({ role: 'مهندس' }).select('username');
        res.json(engineers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب المهندسين.');
    }
});

// @route   GET /api/projects/:id
// @desc    Get a single project by ID (for edit modal, etc.)
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('engineer', 'username')
            .populate('client', 'clientName');

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // إذا كان المستخدم مهندسًا، تأكد من أنه المهندس المسؤول عن المشروع
        if (req.user.role === 'مهندس' && project.engineer && project.engineer._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }

        res.json(project);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب تفاصيل المشروع.');
    }
});

// @route   GET /api/projects/:id/details
// @desc    Get full project details including associated financials
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id/details', auth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId)
            .populate('engineer', 'username')
            .populate('client', 'clientName');

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // إذا كان المستخدم مهندسًا، تأكد من أنه المهندس المسؤول عن المشروع
        if (req.user.role === 'مهندس' && project.engineer && project.engineer._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }

        // جلب المصروفات والإيرادات المرتبطة بالمشروع
        const expenses = await Transaction.find({ project: projectId, type: 'سحب' });
        const revenues = await Transaction.find({ project: projectId, type: 'إيداع' });

        // حساب إجمالي الإيرادات
        const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);

        // جلب اتفاقيات المقاولين للمشروع
        const contractorAgreements = await ContractAgreement.find({ project: projectId });

        // حساب إجمالي المبلغ المتفق عليه من جميع اتفاقيات المقاولين
        const totalAgreedContractorAmount = contractorAgreements.reduce((sum, ag) => sum + ag.agreedAmount, 0);

        // جلب دفعات المقاولين المرتبطة باتفاقيات هذا المشروع
        // أولاً، جمع معرفات الاتفاقيات
        const agreementIds = contractorAgreements.map(ag => ag._id);
        const contractorPayments = await ContractPayment.find({ contractAgreement: { $in: agreementIds } });

        // حساب إجمالي المبلغ المدفوع للمقاولين
        const totalPaidContractorAmount = contractorPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // حساب إجمالي المصروفات (يشمل المصروفات العادية ودفعات المقاولين)
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0) + totalPaidContractorAmount; // <-- تم التعديل هنا

        const netProfitLoss = totalRevenue - totalExpenses;

        res.json({
            ...project.toObject(), // تحويل مستند Mongoose إلى كائن JavaScript عادي
            totalRevenue,
            totalExpenses, // الآن يشمل دفعات المقاولين
            netProfitLoss,
            totalAgreedContractorAmount,
            totalPaidContractorAmount,
            totalRemainingContractorAmount: totalAgreedContractorAmount - totalPaidContractorAmount
        });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب تفاصيل المشروع الكاملة.');
    }
});


// @route   PUT /api/projects/:id
// @desc    Update a project
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const {
        projectName,
        address,
        description,
        engineer,
        client,
        startDate,
        endDate,
        notes,
        status
    } = req.body;

    try {
        let project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // تحديث البيانات
        project.projectName = projectName;
        project.address = address;
        project.description = description;
        project.engineer = engineer;
        project.client = client;
        project.startDate = startDate;
        project.endDate = endDate;
        project.notes = notes;
        project.status = status;

        await project.save();
        res.json({ message: 'تم تحديث المشروع بنجاح.', project });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المهندس أو العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث المشروع.');
    }
});

// @route   DELETE /api/projects/:id
// @desc    Delete a project
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // هنا يمكن إضافة منطق للتحقق مما إذا كان المشروع مرتبطًا بأي عناصر مالية
        // قبل الحذف لمنع فقدان البيانات.

        await Project.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف المشروع بنجاح.' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف المشروع.');
    }
});

module.exports = router;
