// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User'); // استيراد موديل المستخدم
const jwt = require('jsonwebtoken'); // لاستخدام JWT لتوليد التوكنات

// @route   POST /api/register (مسار مؤقت لإضافة المستخدمين للاختبار)
// @desc    Register a new user (for initial setup/testing)
// @access  Public
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    try {
        let user = await User.findOne({ username }); // التحقق إذا كان اسم المستخدم موجودًا بالفعل
        if (user) {
            return res.status(400).json({ message: 'اسم المستخدم هذا موجود بالفعل.' });
        }

        // إنشاء مستخدم جديد باستخدام الموديل
        user = new User({
            username,
            password, // سيتم تشفيرها تلقائيا بواسطة pre('save') hook
            role: role || 'مهندس'  // دور افتراضي إذا لم يتم تحديده
        });

        await user.save(); // حفظ المستخدم في قاعدة البيانات، مما يؤدي إلى تشفير كلمة المرور

        res.status(201).json({ message: 'تم تسجيل المستخدم بنجاح.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء تسجيل المستخدم.');
    }
});

// @route   POST /api/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(400).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
        }

        const payload = {
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ message: 'تم تسجيل الدخول بنجاح.', token });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم.');
    }
});

module.exports = router;
