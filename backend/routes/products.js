const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { auth } = require('../middleware/authMiddleware');

// عرض كل الأصناف
router.get('/', auth, async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء جلب الأصناف', error: err.message });
  }
});

// إضافة صنف جديد
router.post('/', auth, async (req, res) => {
  try {
    const { name, unit, notes, purchasePrice, salePrice, barcode } = req.body;
    // تحقق من تكرار الباركود
    const existing = await Product.findOne({ barcode });
    if (existing) {
      return res.status(400).json({ message: 'هذا الباركود مستخدم لصنف آخر بالفعل' });
    }
    const product = new Product({ name, unit, notes, purchasePrice, salePrice, barcode });
    await product.save();
    res.json({ message: 'تم إضافة الصنف بنجاح', product });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء إضافة الصنف', error: err.message });
  }
});

// تعديل صنف
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, unit, notes, purchasePrice, salePrice } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, unit, notes, purchasePrice, salePrice },
      { new: true }
    );
    res.json({ message: 'تم تعديل الصنف', product });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل الصنف', error: err.message });
  }
});

// حذف صنف
router.delete('/:id', auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف الصنف' });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء حذف الصنف', error: err.message });
  }
});

module.exports = router; 