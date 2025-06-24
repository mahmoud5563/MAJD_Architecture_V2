// backend/routes/contractPayments.js
const express = require('express');
const router = express.Router();
const ContractPayment = require('../models/ContractPayment');
const ContractAgreement = require('../models/ContractAgreement');
const Contractor = require('../models/Contractor');
const Treasury = require('../models/Treasury');
const Project = require('../models/Project'); // لنعديل totalPaidContractorAmount في المشروع
const Transaction = require('../models/Transaction'); // لإنشاء معاملة مرتبطة
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

const { auth, authorizeRoles } = require('../middleware/authMiddleware');

// Middleware للتشخيص - يطبع كل الطلبات الواردة
router.use((req, res, next) => {
    console.log('=== Contract Payments Route Hit ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Path:', req.path);
    console.log('Original URL:', req.originalUrl);
    next();
});

// @route   POST /api/contract-payments
// @desc    Add a new contract payment
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, authorizeRoles('مدير', 'مدير حسابات'), upload.array('attachments', 5), handleUploadError, async (req, res) => {
    console.log('=== Contract Payment POST Request START ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body:', req.body);
    console.log('Files:', req.files);
    console.log('File count:', req.files ? req.files.length : 0);
    
    if (req.files && req.files.length > 0) {
        req.files.forEach((file, index) => {
            console.log(`File ${index}:`, {
                fieldname: file.fieldname,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                filename: file.filename
            });
        });
    }
    
    const { contractAgreementId, amount, date, treasuryId, description } = req.body;

    console.log('=== Contract Payment POST Request ===');
    console.log('Body:', req.body);
    console.log('Files:', req.files);
    console.log('File count:', req.files ? req.files.length : 0);
    console.log('Headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);

    try {
        const agreement = await ContractAgreement.findById(contractAgreementId);
        if (!agreement) {
            return res.status(404).json({ message: 'اتفاق المقاول غير موجود.' });
        }

        const treasury = await Treasury.findById(treasuryId);
        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        if (treasury.currentBalance < amount) {
            return res.status(400).json({ message: 'الرصيد في الخزينة غير كافٍ لإجراء هذه الدفعة.' });
        }

        // التحقق مما إذا كانت الدفعة ستتجاوز المبلغ المتبقي
        const remainingAmount = agreement.agreedAmount - agreement.paidAmount;
        if (amount > remainingAmount) {
             return res.status(400).json({ message: `مبلغ الدفعة يتجاوز المبلغ المتبقي على اتفاقية المقاول. المبلغ المتبقي: ${remainingAmount.toFixed(2)} ج.م` });
        }

        const newPayment = new ContractPayment({
            contractAgreement: contractAgreementId,
            amount: parseFloat(amount),
            date,
            treasury: treasuryId,
            description
        });

        // إضافة المرفقات إذا وجدت
        if (req.files && req.files.length > 0) {
            console.log('Files received:', req.files);
            newPayment.attachments = req.files.map(file => ({
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: file.path
            }));
            console.log('Attachments saved:', newPayment.attachments);
        }

        await newPayment.save();

        // 1. تحديث Paid Amount في اتفاقية المقاول
        agreement.paidAmount += newPayment.amount;
        await agreement.save();

        // 2. تحديث رصيد المقاول (المبلغ الذي له على الشركة ينخفض)
        const contractor = await Contractor.findById(agreement.contractor);
        if (contractor) {
            contractor.balance -= newPayment.amount; // ينخفض المبلغ المستحق للمقاول
            await contractor.save();
        }

        // 3. تحديث رصيد الخزينة (ينخفض)
        treasury.currentBalance -= newPayment.amount;
        await treasury.save();

        // 4. تحديث إجمالي المدفوع للمقاولين في المشروع
        const project = await Project.findById(agreement.project);
        if (project) {
            project.totalPaidContractorAmount = (project.totalPaidContractorAmount || 0) + newPayment.amount;
            await project.save();
        }

        // 5. إنشاء معاملة مالية من نوع 'دفعة مقاول'
        const newTransaction = new Transaction({
            treasury: treasuryId,
            project: agreement.project,
            type: 'دفعة مقاول',
            amount: newPayment.amount,
            description: `دفعة مقاول: ${description || 'بدون وصف'} لاتفاقية ${agreement._id}`,
            date: newPayment.date,
            contractPayment: newPayment._id, // ربط المعاملة بدفعة المقاول
            recordedBy: req.user.id
        });
        await newTransaction.save();

        // Populate and return the created payment
        const populatedPayment = await ContractPayment.findById(newPayment._id)
            .populate('contractAgreement')
            .populate('treasury', 'name');

        res.status(201).json({ message: 'تم إضافة دفعة المقاول بنجاح.', payment: populatedPayment });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف غير صالح في بيانات الدفعة.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة دفعة المقاول.');
    }
});

// @route   GET /api/contract-payments/:projectId
// @desc    Get all contract payments for a specific project
// @access  Private (Manager, Accountant Manager, Engineer (if project-related))
router.get('/:projectId', auth, async (req, res) => {
    try {
        const { projectId } = req.params;

        const existingProject = await Project.findById(projectId);
        if (!existingProject) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // صلاحيات المهندس: يمكنه رؤية الدفعات لمشاريعه فقط
        if (req.user.role === 'مهندس' && existingProject.engineer && existingProject.engineer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض دفعات هذا المشروع.' });
        }

        // نجد أولاً جميع اتفاقيات المقاولين المرتبطة بالمشروع
        const agreements = await ContractAgreement.find({ project: projectId }).select('_id contractor');
        const agreementIds = agreements.map(ag => ag._id);
        const agreementContractorMap = {};
        agreements.forEach(ag => {
            agreementContractorMap[ag._id.toString()] = ag.contractor;
        });

        // ثم نجد جميع الدفعات المرتبطة بهذه الاتفاقيات
        const payments = await ContractPayment.find({ contractAgreement: { $in: agreementIds } })
                                            .populate({
                                                path: 'contractAgreement',
                                                populate: {
                                                    path: 'contractor',
                                                    select: 'contractorName'
                                                },
                                                select: 'agreedAmount paidAmount'
                                            })
                                            .populate('treasury', 'name')
                                            .sort({ date: -1, createdAt: -1 });

        // نعدل هيكل البيانات لتضمين اسم المقاول مباشرة في كل دفعة
        const formattedPayments = payments.map(payment => {
            console.log('=== Payment Details ===');
            console.log('Payment ID:', payment._id);
            console.log('Payment attachments:', payment.attachments);
            console.log('Payment attachments type:', typeof payment.attachments);
            console.log('Payment attachments length:', payment.attachments ? payment.attachments.length : 'undefined');
            
            return {
                _id: payment._id,
                amount: payment.amount,
                date: payment.date,
                description: payment.description,
                treasury: payment.treasury ? payment.treasury.name : 'غير محدد',
                contractorName: payment.contractAgreement && payment.contractAgreement.contractor ? payment.contractAgreement.contractor.contractorName : 'غير محدد',
                agreedAmount: payment.contractAgreement ? payment.contractAgreement.agreedAmount : 0,
                paidAmount: payment.contractAgreement ? payment.contractAgreement.paidAmount : 0,
                remainingAmount: payment.contractAgreement ? (payment.contractAgreement.agreedAmount - payment.contractAgreement.paidAmount) : 0,
                contractAgreementId: payment.contractAgreement._id,
                attachments: payment.attachments || []
            };
        });

        res.json(formattedPayments);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب دفعات المقاولين.');
    }
});

// @route   DELETE /api/contract-payments/:id
// @desc    Delete a contract payment (and reverse its effect)
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const payment = await ContractPayment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ message: 'دفعة المقاول غير موجودة.' });
        }

        const agreement = await ContractAgreement.findById(payment.contractAgreement);
        if (agreement) {
            agreement.paidAmount -= payment.amount;
            await agreement.save();

            const contractor = await Contractor.findById(agreement.contractor);
            if (contractor) {
                contractor.balance += payment.amount; // عكس التأثير على رصيد المقاول
                await contractor.save();
            }

            const project = await Project.findById(agreement.project);
            if (project) {
                project.totalPaidContractorAmount = (project.totalPaidContractorAmount || 0) - payment.amount;
                await project.save();
            }
        }

        const treasury = await Treasury.findById(payment.treasury);
        if (treasury) {
            treasury.currentBalance += payment.amount; // إعادة المبلغ للخزينة
            await treasury.save();
        }
        
        // حذف المعاملة المالية المرتبطة
        await Transaction.deleteOne({ contractPayment: payment._id, type: 'دفعة مقاول' });

        await ContractPayment.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف دفعة المقاول بنجاح وعكس تأثيرها على الأرصدة.' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الدفعة غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف دفعة المقاول.');
    }
});

// @route   GET /api/contract-payments/debug/:paymentId
// @desc    Debug a specific contract payment
// @access  Private (Manager, Accountant Manager)
router.get('/debug/:paymentId', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const payment = await ContractPayment.findById(req.params.paymentId);
        if (!payment) {
            return res.status(404).json({ message: 'دفعة المقاول غير موجودة.' });
        }
        
        console.log('=== Debug Payment ===');
        console.log('Payment ID:', payment._id);
        console.log('Payment data:', payment.toObject());
        console.log('Attachments:', payment.attachments);
        console.log('Attachments type:', typeof payment.attachments);
        console.log('Attachments length:', payment.attachments ? payment.attachments.length : 'undefined');
        
        res.json({
            payment: payment.toObject(),
            attachments: payment.attachments,
            attachmentsCount: payment.attachments ? payment.attachments.length : 0
        });
    } catch (err) {
        console.error('Error debugging payment:', err);
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

module.exports = router;
