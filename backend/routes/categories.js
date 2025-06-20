// backend/routes/categories.js
const express = require('express');
const router = express.Router();
const Category = require('../models/Category'); // استيراد موديل Category
const { auth } = require('../middleware/authMiddleware');

// @route   POST /api/categories
// @desc    Add a new category with name and optional description
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, async (req, res) => {
    const { name, description } = req.body; // فقط الاسم والوصف

    try {
        let category = await Category.findOne({ name });
        if (category) {
            return res.status(400).json({ message: 'تصنيف بهذا الاسم موجود بالفعل.' });
        }

        const newCategory = new Category({ name, description });
        await newCategory.save();
        res.status(201).json({ message: 'تم إضافة التصنيف بنجاح.', category: newCategory });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء إضافة التصنيف.'});
    }
});

// @route   GET /api/categories
// @desc    Get all categories (no filter by type now)
// @access  Private (All authenticated users can view categories)
router.get('/', auth, async (req, res) => {
    try {
        // لم نعد نحتاج لفلترة بالنوع
        const categories = await Category.find({}).sort({ name: 1 }); // فرز أبجدي
        res.json(categories);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء جلب التصنيفات.'});
    }
});

// @route   GET /api/categories/:id
// @desc    Get a single category by ID
// @access  Private (All authenticated users)
router.get('/:id', auth, async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'التصنيف غير موجود.' });
        }
        res.json(category);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف التصنيف غير صالح.' });
        }
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء جلب التصنيف.'});
    }
});

// @route   PUT /api/categories/:id
// @desc    Update a category (name and optional description)
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, async (req, res) => {
    const { name, description } = req.body; // فقط الاسم والوصف

    try {
        let category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'التصنيف غير موجود.' });
        }

        // التحقق من تكرار الاسم عند التحديث
        const existingCategory = await Category.findOne({ name });
        if (existingCategory && existingCategory._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'تصنيف آخر بهذا الاسم موجود بالفعل.' });
        }

        category.name = name || category.name;
        category.description = description !== undefined ? description : category.description; // السماح بتحديث الوصف ليكون فارغاً
        
        await category.save();
        res.json({ message: 'تم تحديث التصنيف بنجاح.', category });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف التصنيف غير صالح.' });
        }
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء تحديث التصنيف.'});
    }
});

// @route   DELETE /api/categories/:id
// @desc    Delete a category
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'التصنيف غير موجود.' });
        }

        // ***** مهم جداً: التحقق من المعاملات المرتبطة *****
        // قبل حذف أي تصنيف، يجب التحقق مما إذا كان هناك أي معاملات (Transaction)
        // تستخدم هذا التصنيف. إذا كان موجودًا، يجب منع الحذف أو تقديم خيار
        // لإعادة تعيين التصنيفات المرتبطة أو حذف المعاملات.
        // حالياً، سنفترض أنه لا توجد قيود صارمة على الحذف لتسهيل التطوير،
        // لكن في تطبيق حقيقي، هذا ضروري جداً لتجنب فقدان البيانات أو مشاكل التكامل.
        // يمكنك إضافة منطق للتحقق من موديل Transaction هنا.

        await Category.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف التصنيف بنجاح.' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف التصنيف غير صالح.' });
        }
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء حذف التصنيف.'});
    }
});

module.exports = router;
