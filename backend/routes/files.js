const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/authMiddleware');
const { uploadsDir } = require('../middleware/uploadMiddleware');

// Middleware للتشخيص - يطبع كل الطلبات الواردة
router.use((req, res, next) => {
    console.log('=== Files Route Hit ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Path:', req.path);
    console.log('Headers:', req.headers);
    next();
});

// @route   GET /api/files/:filename
// @desc    تحميل ملف مرفق
// @access  Public (لا يحتاج مصادقة للوصول للملفات)
router.get('/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        
        console.log('=== File Request ===');
        console.log('Filename:', filename);
        console.log('Uploads directory:', uploadsDir);
        
        // التحقق من وجود الملف
        const filePath = path.join(uploadsDir, filename);
        console.log('Full file path:', filePath);
        
        if (!fs.existsSync(filePath)) {
            console.log('File not found!');
            return res.status(404).json({ message: 'الملف غير موجود.' });
        }

        console.log('File exists, serving...');
        
        // الحصول على معلومات الملف
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        const ext = path.extname(filename).toLowerCase();

        // تحديد نوع المحتوى
        let contentType = 'application/octet-stream';
        if (ext === '.pdf') {
            contentType = 'application/pdf';
        } else if (['.jpg', '.jpeg'].includes(ext)) {
            contentType = 'image/jpeg';
        } else if (ext === '.png') {
            contentType = 'image/png';
        } else if (ext === '.gif') {
            contentType = 'image/gif';
        }

        console.log('Content-Type:', contentType);
        console.log('File size:', fileSize);

        // إعداد headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

        // إرسال الملف
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Error serving file:', error);
        res.status(500).json({ message: 'خطأ في الخادم أثناء تحميل الملف.' });
    }
});

// @route   DELETE /api/files/:filename
// @desc    حذف ملف مرفق
// @access  Private (Manager, Accountant Manager)
router.delete('/:filename', auth, async (req, res) => {
    try {
        const { filename } = req.params;
        
        // التحقق من وجود الملف
        const filePath = path.join(uploadsDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'الملف غير موجود.' });
        }

        // حذف الملف
        fs.unlinkSync(filePath);
        
        res.json({ message: 'تم حذف الملف بنجاح.' });

    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ message: 'خطأ في الخادم أثناء حذف الملف.' });
    }
});

module.exports = router;
