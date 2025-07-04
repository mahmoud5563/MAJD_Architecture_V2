// backend/routes/clients.js
const express = require('express');
const router = express.Router();
const Client = require('../models/Client'); // استيراد موديل العميل
const { auth } = require('../middleware/authMiddleware'); // استيراد الـ middleware للتحقق من الصلاحيات

// @route   POST /api/clients
// @desc    Add a new client
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, async (req, res) => {
    const { clientName, phoneNumber, email } = req.body;

    try {
        // التحقق مما إذا كان العميل موجودًا بالفعل بنفس الاسم
        let client = await Client.findOne({ clientName });
        if (client) {
            return res.status(400).json({ message: 'عميل بهذا الاسم موجود بالفعل.' });
        }

        const newClient = new Client({
            clientName,
            phoneNumber,
            email
        });

        await newClient.save();
        res.status(201).json({ message: 'تم إضافة العميل بنجاح.', client: newClient });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة العميل.');
    }
});

// @route   GET /api/clients
// @desc    Get all clients
// @access  Private (All authenticated users, but Engineer might have restricted view)
router.get('/', auth, async (req, res) => {
    try {
        // إذا كان المستخدم مهندسًا، فقد نحتاج إلى منطق خاص لجلب العملاء المرتبطين بمشاريعه
        // حالياً، سنقوم بجلب جميع العملاء. لاحقاً يمكننا تطبيق منطق التصفية هنا.
        const clients = await Client.find({}); // جلب جميع العملاء

        res.json(clients);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب العملاء.');
    }
});

// @route   GET /api/clients/:id
// @desc    Get client by ID
// @access  Private (Manager, Accountant Manager, Engineer (if client related to his project))
router.get('/:id', auth, async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }

        // هنا يمكننا إضافة منطق للتحقق إذا كان المستخدم مهندسًا،
        // فهل هذا العميل مرتبط بأحد مشاريعه؟ (تتطلب استعلامات إضافية)

        res.json(client);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب تفاصيل العميل.');
    }
});

// @route   PUT /api/clients/:id
// @desc    Update a client
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, async (req, res) => {
    const { clientName, phoneNumber, email } = req.body;

    try {
        let client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }

        // التحقق من تكرار اسم العميل عند التحديث (إذا لم يكن هو العميل الحالي)
        const existingClient = await Client.findOne({ clientName });
        if (existingClient && existingClient._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'عميل آخر بهذا الاسم موجود بالفعل.' });
        }

        client.clientName = clientName || client.clientName;
        client.phoneNumber = phoneNumber || client.phoneNumber;
        client.email = email || client.email;

        await client.save();
        res.json({ message: 'تم تحديث العميل بنجاح.', client });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث العميل.');
    }
});

// @route   DELETE /api/clients/:id
// @desc    Delete a client
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }

        // ************* ملاحظة هامة *************
        // قبل حذف العميل، يجب التحقق مما إذا كان العميل مرتبطًا بأي مشاريع.
        // إذا كان كذلك، يجب منع الحذف أو التعامل مع المشاريع المرتبطة (مثل إزالة العميل منها).
        // هذا يتطلب إضافة منطق للبحث في موديل Projects.
        // For example:
        // const projectsWithClient = await Project.find({ client: req.params.id });
        // if (projectsWithClient.length > 0) {
        //     return res.status(400).json({ message: 'لا يمكن حذف العميل لأنه مرتبط بمشاريع.' });
        // }
        // *****************************************

        await Client.deleteOne({ _id: req.params.id }); // استخدام deleteOne بدلاً من findByIdAndRemove
        res.json({ message: 'تم حذف العميل بنجاح.' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف العميل.');
    }
});

module.exports = router;
