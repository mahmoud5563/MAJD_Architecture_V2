// backend/routes/contractAgreements.js
const express = require('express');
const router = express.Router();
const ContractAgreement = require('../models/ContractAgreement');
const Project = require('../models/Project');
const Contractor = require('../models/Contractor');
const ContractPayment = require('../models/ContractPayment'); // تم استيراده للاستخدام في مسار الحذف
const { auth, authorizeRoles } = require('../middleware/authMiddleware');

// @route   POST /api/contract-agreements
// @desc    Add a new contract agreement for a project
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const { project, contractor, agreedAmount, description } = req.body;

    try {
        const existingProject = await Project.findById(project);
        if (!existingProject) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }
        const existingContractor = await Contractor.findById(contractor);
        if (!existingContractor) {
            return res.status(404).json({ message: 'المقاول غير موجود.' });
        }

        // تم إزالة التحقق من التفرد هنا للسماح باتفاقيات متعددة لنفس المقاول في نفس المشروع
        // كما تم التأكيد في الموديل، لا يوجد unique index يفرض ذلك في الكود

        const newAgreement = new ContractAgreement({
            project,
            contractor,
            agreedAmount: parseFloat(agreedAmount),
            description
        });

        await newAgreement.save();

        existingContractor.balance = (existingContractor.balance || 0) + newAgreement.agreedAmount;
        await existingContractor.save();

        existingProject.totalAgreedContractorAmount = (existingProject.totalAgreedContractorAmount || 0) + newAgreement.agreedAmount;
        await existingProject.save();

        res.status(201).json({ message: 'تم إضافة اتفاق المقاول بنجاح.', agreement: newAgreement });

    } catch (err) {
        console.error(err.message);
        // تحسين معالجة الأخطاء لإرسال JSON دائماً
        if (err.code === 11000) { // Duplicate key error
            return res.status(400).json({ message: 'خطأ: توجد بالفعل اتفاقية لهذا المقاول في هذا المشروع. (ملاحظة: هذا يشير إلى وجود فهرس فريد في قاعدة البيانات على حقلي المشروع والمقاول معاً.)' });
        }
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع أو المقاول غير صالح.' });
        }
        // رسالة عامة كـ JSON
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء إضافة اتفاق المقاول.' });
    }
});

// @route   GET /api/contract-agreements/:projectId
// @desc    Get all contract agreements for a specific project
// @access  Private (Manager, Accountant Manager, Engineer (if project-related))
router.get('/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;

        const existingProject = await Project.findById(projectId);
        if (!existingProject) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        if (req.user.role === 'مهندس' && existingProject.engineer && existingProject.engineer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض اتفاقيات هذا المشروع.' });
        }

        const agreements = await ContractAgreement.find({ project: projectId })
                                                    .populate('contractor', 'contractorName balance')
                                                    .sort({ createdAt: -1 });
        res.json(agreements);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع غير صالح.' });
        }
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب اتفاقيات المقاولين.' });
    }
});

// @route   PUT /api/contract-agreements/:id
// @desc    Update a contract agreement
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const { agreedAmount, description } = req.body;

    try {
        let agreement = await ContractAgreement.findById(req.params.id);
        if (!agreement) {
            return res.status(404).json({ message: 'اتفاق المقاول غير موجود.' });
        }

        if (agreedAmount !== undefined && parseFloat(agreedAmount) !== agreement.agreedAmount) {
            const oldAgreedAmount = agreement.agreedAmount;
            const newAgreedAmount = parseFloat(agreedAmount);

            const contractor = await Contractor.findById(agreement.contractor);
            if (contractor) {
                contractor.balance -= oldAgreedAmount;
                contractor.balance += newAgreedAmount;
                await contractor.save();
            }

            const project = await Project.findById(agreement.project);
            if (project) {
                project.totalAgreedContractorAmount = (project.totalAgreedContractorAmount || 0) - oldAgreedAmount + newAgreedAmount;
                await project.save();
            }
            agreement.agreedAmount = newAgreedAmount;
        }

        agreement.description = description !== undefined ? description : agreement.description;

        await agreement.save();
        res.json({ message: 'تم تحديث اتفاق المقاول بنجاح.', agreement });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف اتفاق المقاول غير صالح.' });
        }
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء تحديث اتفاق المقاول.' });
    }
});

// @route   DELETE /api/contract-agreements/:id
// @desc    Delete a contract agreement
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const agreement = await ContractAgreement.findById(req.params.id);
        if (!agreement) {
            return res.status(404).json({ message: 'اتفاق المقاول غير موجود.' });
        }

        const paymentsCount = await ContractPayment.countDocuments({ contractAgreement: req.params.id });
        if (paymentsCount > 0) {
            return res.status(400).json({ message: 'لا يمكن حذف اتفاق المقاول لوجود دفعات مرتبطة به. يرجى حذف الدفعات أولاً.' });
        }

        const contractor = await Contractor.findById(agreement.contractor);
        if (contractor) {
            contractor.balance -= agreement.agreedAmount;
            await contractor.save();
        }

        const project = await Project.findById(agreement.project);
        if (project) {
            project.totalAgreedContractorAmount = (project.totalAgreedContractorAmount || 0) - agreement.agreedAmount;
            await project.save();
        }

        await ContractAgreement.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف اتفاق المقاول بنجاح.' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف اتفاق المقاول غير صالح.' });
        }
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء حذف اتفاق المقاول.' });
    }
})
;


module.exports = router;
