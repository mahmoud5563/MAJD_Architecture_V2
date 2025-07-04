// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken'); // لاستخدام JWT للتحقق من التوكن
const User = require('../models/User'); // استيراد موديل المستخدم

const auth = async (req, res, next) => {
    // الحصول على التوكن من الهيدر (header) الخاص بالطلب
    // التوكن عادة ما يكون في شكل 'Bearer TOKEN_STRING'
    const token = req.header('x-auth-token');

    // التحقق مما إذا كان هناك توكن
    if (!token) {
        return res.status(401).json({ message: 'لا يوجد توكن، تم رفض الإذن.' });
    }

    try {
        // التحقق من صحة التوكن
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // جلب المستخدم من قاعدة البيانات
        const user = await User.findById(decoded.user.id);
        if (!user) {
            return res.status(401).json({ message: 'المستخدم غير موجود.' });
        }
        if (user.isActive === false) {
            return res.status(403).json({ message: 'تم إيقافك مؤقتًا بواسطة المدير. يرجى التواصل مع الإدارة.' });
        }

        // إضافة بيانات المستخدم (ID والدور) إلى كائن الطلب (req)
        // بحيث يمكن الوصول إليها في المسارات التالية
        req.user = decoded.user;
        next(); // الانتقال إلى الوظيفة الوسيطة أو المسار التالي
    } catch (err) {
        // إذا كان التوكن غير صالح (منتهي الصلاحية، أو تم العبث به)
        res.status(401).json({ message: 'التوكن غير صالح.' });
    }
};

// وظيفة وسيطة للتحقق من الأدوار (صلاحيات المستخدم)
// تأخذ دورًا أو قائمة أدوار مسموح بها كمعامل
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        // التحقق مما إذا كان المستخدم لديه دور مسموح به
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى هذا المورد.' });
        }
        next(); // الانتقال إلى الوظيفة الوسيطة أو المسار التالي
    };
};

module.exports = { auth, authorizeRoles };
