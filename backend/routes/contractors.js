// backend/routes/contractors.js
const express = require('express');
const router = express.Router();
const Contractor = require('../models/Contractor');
const { auth } = require('../middleware/authMiddleware');

// @route   POST /api/contractors
// @desc    Add a new contractor
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, async (req, res) => {
    const { contractorName, phoneNumber, email, address } = req.body;

    try {
        let contractor = await Contractor.findOne({ contractorName });
        if (contractor) {
            return res.status(400).json({ message: 'مقاول بهذا الاسم موجود بالفعل.' });
        }

        const newContractor = new Contractor({
            contractorName,
            phoneNumber,
            email,
            address,
            balance: 0 // الرصيد الأولي للمقاول يكون صفر
        });

        await newContractor.save();
        res.status(201).json({ message: 'تم إضافة المقاول بنجاح.', contractor: newContractor });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة المقاول.');
    }
});

// @route   GET /api/contractors
// @desc    Get all contractors
// @access  Private (Manager, Accountant Manager)
router.get('/', auth, async (req, res) => {
    try {
        const contractors = await Contractor.find({}).sort({ contractorName: 1 });
        res.json(contractors);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب المقاولين.');
    }
});

// @route   GET /api/contractors/:id
// @desc    Get a single contractor by ID
// @access  Private (Manager, Accountant Manager)
router.get('/:id', auth, async (req, res) => {
    try {
        const contractor = await Contractor.findById(req.params.id);
        if (!contractor) {
            return res.status(404).json({ message: 'المقاول غير موجود.' });
        }
        res.json(contractor);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المقاول غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب المقاول.');
    }
});

// @route   PUT /api/contractors/:id
// @desc    Update a contractor
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, async (req, res) => {
    const { contractorName, phoneNumber, email, address } = req.body;

    try {
        let contractor = await Contractor.findById(req.params.id);
        if (!contractor) {
            return res.status(404).json({ message: 'المقاول غير موجود.' });
        }

        // التحقق من تكرار الاسم عند التحديث
        if (contractorName && contractorName !== contractor.contractorName) {
            const existingContractor = await Contractor.findOne({ contractorName });
            if (existingContractor && existingContractor._id.toString() !== req.params.id) {
                return res.status(400).json({ message: 'مقاول آخر بهذا الاسم موجود بالفعل.' });
            }
            contractor.contractorName = contractorName;
        }

        contractor.phoneNumber = phoneNumber || contractor.phoneNumber;
        contractor.email = email || contractor.email;
        contractor.address = address || contractor.address;

        await contractor.save();
        res.json({ message: 'تم تحديث المقاول بنجاح.', contractor });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المقاول غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث المقاول.');
    }
});

// @route   DELETE /api/contractors/:id
// @desc    Delete a contractor
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, async (req, res) => {
    try {
        const contractor = await Contractor.findById(req.params.id);
        if (!contractor) {
            return res.status(404).json({ message: 'المقاول غير موجود.' });
        }

        // قبل الحذف، تحقق مما إذا كان هناك أي اتفاقيات أو دفعات مرتبطة بهذا المقاول
        // يمكنك إضافة منطق هنا لمنع الحذف أو حذف التبعيات أيضاً
        // For example:
        // const agreementsCount = await ContractAgreement.countDocuments({ contractor: req.params.id });
        // if (agreementsCount > 0) {
        //     return res.status(400).json({ message: 'لا يمكن حذف المقاول لأنه مرتبط باتفاقيات مقاولين.' });
        // }

        await Contractor.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف المقاول بنجاح.' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المقاول غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف المقاول.');
    }
});

module.exports = router;
