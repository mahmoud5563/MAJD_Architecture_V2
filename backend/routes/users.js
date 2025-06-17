// backend/routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // استيراد موديل المستخدم
const { auth, authorizeRoles } = require('../middleware/authMiddleware'); // استيراد الـ middleware

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Manager, Accountant Manager)
router.get('/', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort({ username: 1 }); // جلب المستخدمين بدون كلمة المرور
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب المستخدمين.');
    }
});

// @route   GET /api/users/engineers
// @desc    Get a list of all users with role 'مهندس'
// @access  Private (Any authenticated user who can view projects/add projects)
//          Note: For engineer list, we'll allow all authenticated users to fetch.
router.get('/engineers', auth, async (req, res) => {
    try {
        // Find users where their role is 'مهندس' and select only their ID and username
        const engineers = await User.find({ role: 'مهندس' }).select('_id username');
        res.json(engineers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب قائمة المهندسين.');
    }
});

// @route   GET /api/users/:id
// @desc    Get a single user by ID
// @access  Private (All authenticated users)
router.get('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => { // تم إضافة هذا المسار المفقود
    try {
        const user = await User.findById(req.params.id).select('-password'); // جلب المستخدم بدون كلمة المرور
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود.' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المستخدم غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب المستخدم.');
    }
});

// @route   POST /api/users
// @desc    Add a new user
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const { username, password, role } = req.body;

    try {
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'اسم المستخدم هذا موجود بالفعل.' });
        }

        // إنشاء مستخدم جديد. الـ hashing يتم بواسطة middleware في موديل User
        user = new User({
            username,
            password,
            role: role || 'مهندس' // تعيين دور افتراضي إذا لم يتم تحديده
        });

        await user.save();
        res.status(201).json({ message: 'تم إضافة المستخدم بنجاح.', user: { _id: user._id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة المستخدم.');
    }
});

// @route   PUT /api/users/:id
// @desc    Update a user's details (username, role, and optional password)
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const { username, password, role } = req.body;

    try {
        let user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود.' });
        }

        // التحقق من تكرار اسم المستخدم (إذا تم تغيير الاسم)
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser && existingUser._id.toString() !== req.params.id) {
                return res.status(400).json({ message: 'اسم المستخدم هذا موجود بالفعل لمستخدم آخر.' });
            }
            user.username = username;
        }

        if (password) {
            user.password = password; // الـ hashing سيتم بواسطة middleware في موديل User
        }

        if (role) {
            user.role = role;
        }

        await user.save();
        res.json({ message: 'تم تحديث المستخدم بنجاح.', user: { _id: user._id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المستخدم غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث المستخدم.');
    }
});

// @route   DELETE /api/users/:id
// @desc    Delete a user
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود.' });
        }

        // منع المستخدم من حذف حسابه الخاص
        if (req.user.id === req.params.id) {
            return res.status(400).json({ message: 'لا يمكنك حذف حسابك الخاص.' });
        }

        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف المستخدم بنجاح.' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المستخدم غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف المستخدم.');
    }
});

module.exports = router;
