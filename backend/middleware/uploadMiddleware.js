const multer = require('multer');
const path = require('path');
const fs = require('fs');

// إنشاء مجلد uploads إذا لم يكن موجود
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// إعدادات التخزين
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // إنشاء اسم فريد للملف
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
});

// فلتر الملفات - السماح بالصور و PDF فقط
const fileFilter = (req, file, cb) => {
    // السماح بالصور
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    // السماح بـ PDF
    else if (file.mimetype === 'application/pdf') {
        cb(null, true);
    }
    // رفض باقي أنواع الملفات
    else {
        cb(new Error('نوع الملف غير مسموح به. يسمح فقط بالصور و PDF.'), false);
    }
};

// إعدادات multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB حد أقصى لكل ملف
        files: 5 // حد أقصى 5 ملفات
    }
});

// middleware للتعامل مع أخطاء رفع الملفات
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                message: 'حجم الملف كبير جداً. الحد الأقصى 5MB لكل ملف.' 
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
                message: 'عدد الملفات كبير جداً. الحد الأقصى 5 ملفات.' 
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ 
                message: 'حقل الملف غير متوقع.' 
            });
        }
    }
    
    if (error.message.includes('نوع الملف غير مسموح')) {
        return res.status(400).json({ 
            message: error.message 
        });
    }
    
    next(error);
};

module.exports = {
    upload,
    handleUploadError,
    uploadsDir
};
