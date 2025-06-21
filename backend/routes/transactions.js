// backend/routes/transactions.js
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Treasury = require('../models/Treasury'); // لاستيراد موديل الخزينة لتعديل الرصيد
const Project = require('../models/Project'); // لاستيراد موديل المشروع لتعديل إيرادات/مصروفات المشروع
const Category = require('../models/Category'); // لاستيراد موديل التصنيف
const ContractPayment = require('../models/ContractPayment'); // لاستيراد موديل دفعات المقاول
const ContractAgreement = require('../models/ContractAgreement'); // لاستيراد موديل اتفاقيات المقاول

const { auth, authorizeRoles } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

// @route   POST /api/transactions
// @desc    Add a new transaction (deposit, withdrawal, transfer, contractor payment)
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, authorizeRoles('مدير', 'مدير حسابات'), upload.array('attachments', 5), handleUploadError, async (req, res) => {
    const { treasury, project, type, amount, description, date, category, vendor, paymentMethod, targetTreasury } = req.body;

    try {
        // التحقق من وجود الخزينة المصدر
        const sourceTreasury = await Treasury.findById(treasury);
        if (!sourceTreasury) {
            return res.status(404).json({ message: 'الخزينة المصدر غير موجودة.' });
        }

        // إنشاء المعاملة الجديدة
        const newTransaction = new Transaction({
            treasury,
            project: project || undefined, // Project is optional
            type,
            amount: parseFloat(amount),
            description,
            date,
            category: category || undefined, // Category is for 'مصروف'
            vendor: vendor || undefined, // Vendor is for 'مصروف'
            paymentMethod: paymentMethod || undefined, // Payment method for 'إيداع'
            targetTreasury: targetTreasury || undefined, // Target treasury for 'تحويل'
            recordedBy: req.user.id
        });

        // إضافة المرفقات إذا وجدت
        if (req.files && req.files.length > 0) {
            newTransaction.attachments = req.files.map(file => ({
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: file.path
            }));
        }

        // تحديث أرصدة الخزائن والمشاريع بناءً على نوع المعاملة
        if (type === 'إيداع') { // إيراد
            sourceTreasury.currentBalance += newTransaction.amount;
            if (newTransaction.project) {
                const associatedProject = await Project.findById(newTransaction.project);
                if (associatedProject) {
                    associatedProject.totalRevenue += newTransaction.amount;
                    await associatedProject.save();
                }
            }
        } else if (type === 'مصروف') { // مصروف
            if (sourceTreasury.currentBalance < newTransaction.amount) {
                return res.status(400).json({ message: 'الرصيد في الخزينة غير كافٍ لإجراء هذا المصروف.' });
            }
            sourceTreasury.currentBalance -= newTransaction.amount;
            if (newTransaction.project) {
                const associatedProject = await Project.findById(newTransaction.project);
                if (associatedProject) {
                    associatedProject.totalExpenses += newTransaction.amount;
                    await associatedProject.save();
                }
            }
        } else if (type === 'تحويل') {
            if (sourceTreasury.currentBalance < newTransaction.amount) {
                return res.status(400).json({ message: 'الرصيد في الخزينة غير كافٍ لإجراء هذا التحويل.' });
            }
            const destinationTreasury = await Treasury.findById(targetTreasury);
            if (!destinationTreasury) {
                return res.status(404).json({ message: 'الخزينة الهدف غير موجودة.' });
            }
            sourceTreasury.currentBalance -= newTransaction.amount;
            destinationTreasury.currentBalance += newTransaction.amount;
            await destinationTreasury.save();
        } else if (type === 'دفعة مقاول') {
            if (sourceTreasury.currentBalance < newTransaction.amount) {
                return res.status(400).json({ message: 'الرصيد في الخزينة غير كافٍ لإجراء هذه الدفعة.' });
            }
            sourceTreasury.currentBalance -= newTransaction.amount;
            // تحديث إجمالي المدفوع للمقاولين في المشروع
            if (newTransaction.project) {
                const associatedProject = await Project.findById(newTransaction.project);
                if (associatedProject) {
                    associatedProject.totalPaidContractorAmount = (associatedProject.totalPaidContractorAmount || 0) + newTransaction.amount;
                    await associatedProject.save();
                }
            }
        }

        await sourceTreasury.save();
        await newTransaction.save();

        // Populate and return the created transaction
        const populatedTransaction = await Transaction.findById(newTransaction._id)
            .populate('treasury', 'name')
            .populate('project', 'projectName')
            .populate('category', 'name')
            .populate('targetTreasury', 'name')
            .populate('recordedBy', 'username');

        res.status(201).json({
            message: 'تم إضافة المعاملة بنجاح.',
            transaction: populatedTransaction
        });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف غير صالح في بيانات المعاملة.' });
        }
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء إضافة المعاملة.' });
    }
});

// @route   GET /api/transactions
// @desc    Get all transactions (with filters)
// @access  Private (Manager, Accountant Manager, Engineer sees project-related transactions)
router.get('/', auth, async (req, res) => {
    try {
        const { project, treasury, type, category, startDate, endDate } = req.query;
        let query = {};

        // If the user is an 'Engineer', only show transactions related to projects they are responsible for
        if (req.user.role === 'مهندس') {
            const engineerProjects = await Project.find({ engineer: req.user.id }).select('_id');
            const projectIds = engineerProjects.map(p => p._id);
            query.project = { $in: projectIds };

            // Allow engineer to also see transactions related to treasuries they are responsible for (custodies)
            const engineerTreasuries = await Treasury.find({ responsibleUser: req.user.id }).select('_id');
            const treasuryIds = engineerTreasuries.map(t => t._id);

            if (projectIds.length > 0 && treasuryIds.length > 0) {
                query = { $or: [{ project: { $in: projectIds } }, { treasury: { $in: treasuryIds } }] };
            } else if (projectIds.length > 0) {
                query.project = { $in: projectIds };
            } else if (treasuryIds.length > 0) {
                query.treasury = { $in: treasuryIds };
            } else {
                return res.json([]); // Engineer has no associated projects or treasuries
            }

            // If a specific project filter is also applied, combine it
            if (project) {
                if (query.$or) {
                    query = { $and: [ { $or: query.$or }, { project: project } ] };
                } else if (query.project) {
                    query.project = project;
                } else { // This case means engineer has no default project or treasury related
                    return res.status(403).json({ message: 'ليس لديك صلاحية لعرض معاملات هذا المشروع.' });
                }
            }
            // If a specific treasury filter is also applied, combine it
            if (treasury) {
                if (query.$or) {
                    query = { $and: [ { $or: query.$or }, { treasury: treasury } ] };
                } else if (query.treasury) {
                    query.treasury = treasury;
                } else { // This case means engineer has no default project or treasury related
                    return res.status(403).json({ message: 'ليس لديك صلاحية لعرض معاملات هذه الخزينة.' });
                }
            }

        } else { // Manager and Accountant Manager
            if (project) query.project = project;
            if (treasury) query.treasury = treasury;
        }

        if (type) query.type = type;
        if (category) query.category = category;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(query)
                                            .populate('treasury', 'name')
                                            .populate('project', 'projectName')
                                            .populate('category', 'name')
                                            .populate('targetTreasury', 'name')
                                            .sort({ date: -1, createdAt: -1 }); // فرز حسب التاريخ الأحدث ثم تاريخ الإنشاء

        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء جلب المعاملات.'});
    }
});

// @route   GET /api/transactions/:id
// @desc    Get a single transaction by ID
// @access  Private (any authenticated user)
router.get('/:id', auth, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id)
                                                .populate('treasury', 'name')
                                                .populate('project', 'projectName')
                                                .populate('category', 'name')
                                                .populate('targetTreasury', 'name');

        if (!transaction) {
            return res.status(404).json({ message: 'المعاملة غير موجودة.' });
        }
        res.json(transaction);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المعاملة غير صالح.' });
        }
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء جلب المعاملة.'});
    }
});

// @route   PUT /api/transactions/:id
// @desc    Update a transaction (complex: requires careful handling of old/new amounts/treasuries)
// @access  Private (any authenticated user)
router.put('/:id', auth, async (req, res) => {
    const { description, date, category, vendor, paymentMethod } = req.body;

    try {
        let transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ message: 'المعاملة غير موجودة.' });
        }

        // السماح بتعديل حقول لا تؤثر على الرصيد مباشرة
        transaction.description = description !== undefined ? description : transaction.description;
        transaction.date = date !== undefined ? date : transaction.date;

        if (transaction.type === 'مصروف') {
            transaction.category = category !== undefined ? category : transaction.category;
            transaction.vendor = vendor !== undefined ? vendor : transaction.vendor;
        } else if (transaction.type === 'إيداع') {
            transaction.paymentMethod = paymentMethod !== undefined ? paymentMethod : transaction.paymentMethod;
        }

        await transaction.save();
        res.json({ message: 'تم تحديث تفاصيل المعاملة بنجاح.', transaction });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المعاملة غير صالح.' });
        }
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء تحديث المعاملة.'});
    }
});

// @route   DELETE /api/transactions/:id
// @desc    Delete a transaction (and reverse its effect on treasury/project balances)
// @access  Private (any authenticated user)
router.delete('/:id', auth, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ message: 'المعاملة غير موجودة.' });
        }

        const sourceTreasury = await Treasury.findById(transaction.treasury);
        if (!sourceTreasury) {
            // Log error but proceed with deletion as treasury might have been deleted manually
            console.error('Source treasury not found for transaction:', transaction._id);
        }

        // عكس تأثير المعاملة على أرصدة الخزائن والمشاريع
        if (transaction.type === 'إيداع') {
            if (sourceTreasury) sourceTreasury.currentBalance -= transaction.amount;
            if (transaction.project) {
                const associatedProject = await Project.findById(transaction.project);
                if (associatedProject) {
                    associatedProject.totalRevenue -= transaction.amount;
                    await associatedProject.save();
                }
            }
        } else if (transaction.type === 'مصروف') {
            if (sourceTreasury) sourceTreasury.currentBalance += transaction.amount;
            if (transaction.project) {
                const associatedProject = await Project.findById(transaction.project);
                if (associatedProject) {
                    associatedProject.totalExpenses -= transaction.amount;
                    await associatedProject.save();
                }
            }
        } else if (transaction.type === 'تحويل') {
            const destinationTreasury = await Treasury.findById(transaction.targetTreasury);
            if (sourceTreasury) sourceTreasury.currentBalance += transaction.amount;
            if (destinationTreasury) destinationTreasury.currentBalance -= transaction.amount;
            if (destinationTreasury) await destinationTreasury.save();
        } else if (transaction.type === 'دفعة مقاول') {
            // إذا كانت المعاملة من نوع "دفعة مقاول"
            // سنحتاج إلى عكس تحديث الدفعة في ContractorAgreement و Contractor
            const contractPayment = await ContractPayment.findById(transaction.contractPayment);
            if (contractPayment) {
                const contractAgreement = await ContractAgreement.findById(contractPayment.contractAgreement);
                if (contractAgreement) {
                    contractAgreement.paidAmount -= contractPayment.amount;
                    await contractAgreement.save();

                    const contractor = await Contractor.findById(contractAgreement.contractor);
                    if (contractor) {
                        contractor.balance -= contractPayment.amount; // عكس التأثير على رصيد المقاول
                        await contractor.save();
                    }
                }
                // حذف دفعة المقاول المرتبطة
                await ContractPayment.deleteOne({ _id: transaction.contractPayment });
            }
            if (sourceTreasury) sourceTreasury.currentBalance += transaction.amount; // إعادة المبلغ للخزينة
        }

        if (sourceTreasury) await sourceTreasury.save();
        await Transaction.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف المعاملة بنجاح وعكس تأثيرها على الأرصدة.' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المعاملة غير صالح.' });
        }
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء حذف المعاملة.'});
    }
});

// إضافة route لتحميل المرفقات
router.get('/:id/attachments/:filename', auth, async (req, res) => {
    // كود تحميل الملف
});

module.exports = router;
