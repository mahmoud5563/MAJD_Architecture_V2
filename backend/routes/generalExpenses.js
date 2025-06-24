const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const GeneralExpense = require('../models/GeneralExpense');
const Treasury = require('../models/Treasury');

// Middleware to check if user is Manager or Accountant Manager
const requireManagerAccess = (req, res, next) => {
    if (req.user.role !== 'مدير' && req.user.role !== 'مدير الحسابات') {
        return res.status(403).json({ message: 'غير مصرح لك بالوصول لهذه الصفحة' });
    }
    next();
};

// GET all general expenses (with filtering options)
router.get('/', auth, requireManagerAccess, async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        
        let query = {};
        
        // Apply date filters
        if (filter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            query.date = {
                $gte: today,
                $lt: tomorrow
            };
        } else if (filter === 'month') {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            
            query.date = {
                $gte: startOfMonth,
                $lte: endOfMonth
            };
        } else if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            query.date = {
                $gte: start,
                $lte: end
            };
        }
        
        const expenses = await GeneralExpense.find(query)
            .populate('treasury', 'name')
            .populate('createdBy', 'username')
            .populate('category', 'name')
            .sort({ date: -1 });
            
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching general expenses:', error);
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

// POST create new general expense with file upload support
router.post('/', auth, requireManagerAccess, upload.array('attachments', 5), handleUploadError, async (req, res) => {
    console.log('=== General Expense POST Request START ===');
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
    
    try {
        const { amount, description, treasury, date, category } = req.body;
        
        // Validate required fields
        if (!amount || !description || !treasury || !category) {
            return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
        }
        
        // Check if treasury exists
        const treasuryDoc = await Treasury.findById(treasury);
        if (!treasuryDoc) {
            return res.status(404).json({ message: 'الخزينة غير موجودة' });
        }
        
        // Check if treasury has sufficient balance
        if (treasuryDoc.currentBalance < amount) {
            return res.status(400).json({ message: 'رصيد الخزينة غير كافي' });
        }
        
        // Create the expense
        const expense = new GeneralExpense({
            amount: parseFloat(amount),
            reason: description,
            treasury,
            category,
            date: date || new Date(),
            createdBy: req.user.id
        });

        // إضافة المرفقات إذا وجدت
        if (req.files && req.files.length > 0) {
            expense.attachments = req.files.map(file => ({
                filename: file.filename,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: file.path
            }));
        }
        
        await expense.save();
        
        // Update treasury balance
        treasuryDoc.currentBalance -= expense.amount;
        await treasuryDoc.save();
        
        // Populate and return the created expense
        const populatedExpense = await GeneralExpense.findById(expense._id)
            .populate('treasury', 'name')
            .populate('createdBy', 'username')
            .populate('category', 'name');
            
        res.status(201).json({
            message: 'تم حفظ المصروف العام بنجاح',
            expense: populatedExpense
        });
    } catch (error) {
        console.error('=== General Expense POST Error ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

// GET total expenses (with filtering)
router.get('/total', auth, requireManagerAccess, async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        
        let query = {};
        
        // Apply date filters
        if (filter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            query.date = {
                $gte: today,
                $lt: tomorrow
            };
        } else if (filter === 'month') {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            
            query.date = {
                $gte: startOfMonth,
                $lte: endOfMonth
            };
        } else if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            query.date = {
                $gte: start,
                $lte: end
            };
        }
        
        const result = await GeneralExpense.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const total = result.length > 0 ? result[0].total : 0;
        res.json({ total });
    } catch (error) {
        console.error('Error calculating total expenses:', error);
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

// GET general expenses for a specific treasury
router.get('/treasury/:treasuryId', auth, requireManagerAccess, async (req, res) => {
    try {
        const { treasuryId } = req.params;
        
        const expenses = await GeneralExpense.find({ treasury: treasuryId })
            .populate('createdBy', 'username')
            .sort({ date: -1 });
            
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching treasury general expenses:', error);
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

// GET general expenses for engineer's treasuries
router.get('/engineer/:engineerId', auth, async (req, res) => {
    try {
        const { engineerId } = req.params;
        
        // Check if user is requesting their own data or is a manager
        if (req.user.role === 'مهندس' && req.user.id !== engineerId) {
            return res.status(403).json({ message: 'غير مصرح لك بالوصول لهذه البيانات' });
        }
        
        // Get treasuries where engineer is responsible (custodies)
        const treasuries = await Treasury.find({ 
            responsibleUser: engineerId,
            type: 'عهدة'
        });
        
        const treasuryIds = treasuries.map(t => t._id);
        
        const expenses = await GeneralExpense.find({ 
            treasury: { $in: treasuryIds } 
        })
            .populate('treasury', 'name')
            .populate('createdBy', 'username')
            .sort({ date: -1 });
            
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching engineer general expenses:', error);
        res.status(500).json({ message: 'خطأ في الخادم' });
    }
});

module.exports = router; 