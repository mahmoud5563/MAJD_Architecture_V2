console.log('✅ warehouses.js router loaded!');

const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');
const { auth } = require('../middleware/authMiddleware');

// عرض كل المخازن
router.get('/', auth, async (req, res) => {
  try {
    const warehouses = await Warehouse.find();
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء جلب المخازن', error: err.message });
  }
});

// إضافة مخزن جديد
router.post('/', auth, async (req, res) => {
  try {
    const { name, location } = req.body;
    const warehouse = new Warehouse({ name, location });
    await warehouse.save();
    res.json({ message: 'تم إضافة المخزن بنجاح', warehouse });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء إضافة المخزن', error: err.message });
  }
});

// تعديل مخزن
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, location } = req.body;
    const warehouse = await Warehouse.findByIdAndUpdate(
      req.params.id,
      { name, location },
      { new: true }
    );
    res.json({ message: 'تم تعديل المخزن', warehouse });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل المخزن', error: err.message });
  }
});

// حذف مخزن
router.delete('/:id', auth, async (req, res) => {
  try {
    await Warehouse.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف المخزن' });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء حذف المخزن', error: err.message });
  }
});

module.exports = router; 