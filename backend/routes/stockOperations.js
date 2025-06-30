const express = require('express');
const router = express.Router();
const StockOperation = require('../models/StockOperation');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const { auth } = require('../middleware/authMiddleware');

// إضافة عملية مخزنية
router.post('/', auth, async (req, res) => {
  try {
    const { type, product, quantity, warehouse, transferTo, notes, date } = req.body;
    const op = new StockOperation({ 
      type, 
      product, 
      quantity, 
      warehouse, 
      transferTo, 
      notes, 
      date: date ? new Date(date) : undefined 
    });
    await op.save();
    res.json({ message: 'تم تسجيل العملية بنجاح', operation: op });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء تسجيل العملية', error: err.message });
  }
});

// عرض كل العمليات (مع تفاصيل الصنف والمخزن)
router.get('/', auth, async (req, res) => {
  try {
    const operations = await StockOperation.find()
      .populate('product')
      .populate('warehouse')
      .populate('transferTo')
      .sort({ date: -1 });
    res.json(operations);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء جلب العمليات', error: err.message });
  }
});

// جلب العمليات لمخزن معين
router.get('/warehouse/:id', auth, async (req, res) => {
  try {
    const operations = await StockOperation.find({
      $or: [
        { warehouse: req.params.id },
        { transferTo: req.params.id }
      ]
    })
      .populate('product')
      .populate('warehouse')
      .populate('transferTo')
      .sort({ date: -1 });
    res.json(operations);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء جلب العمليات', error: err.message });
  }
});

// جرد المخزن: حساب الكمية المتوفرة لكل صنف في مخزن معين
router.get('/inventory/:warehouseId', auth, async (req, res) => {
  try {
    const warehouseId = req.params.warehouseId;
    // جلب كل العمليات لهذا المخزن
    const operations = await StockOperation.find({
      $or: [
        { warehouse: warehouseId },
        { transferTo: warehouseId }
      ]
    }).populate('product');
    // حساب الجرد لكل صنف
    const inventory = {};
    operations.forEach(op => {
      const pid = op.product._id.toString();
      if (!inventory[pid]) {
        inventory[pid] = {
          product: op.product,
          quantity: 0
        };
      }
      if (op.type === 'add' && op.warehouse.toString() === warehouseId) {
        inventory[pid].quantity += op.quantity;
      }
      if (op.type === 'issue' && op.warehouse.toString() === warehouseId) {
        inventory[pid].quantity -= op.quantity;
      }
      if (op.type === 'transfer') {
        if (op.warehouse.toString() === warehouseId) {
          inventory[pid].quantity -= op.quantity;
        }
        if (op.transferTo && op.transferTo.toString() === warehouseId) {
          inventory[pid].quantity += op.quantity;
        }
      }
      // عمليات البيع والاسترجاع
      if (op.type === 'بيع' && op.warehouse.toString() === warehouseId) {
        inventory[pid].quantity -= op.quantity;
      }
      if (op.type === 'استرجاع' && op.warehouse.toString() === warehouseId) {
        inventory[pid].quantity += op.quantity;
      }
    });
    res.json(Object.values(inventory));
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء حساب الجرد', error: err.message });
  }
});

// حذف عملية مخزنية
router.delete('/:id', auth, async (req, res) => {
  try {
    const op = await StockOperation.findById(req.params.id);
    if (!op) return res.status(404).json({ message: 'العملية غير موجودة' });

    // حساب الرصيد الحالي للصنف في هذا المخزن (من كل العمليات الحالية)
    const allOps = await StockOperation.find({
      $or: [
        { warehouse: op.warehouse },
        { transferTo: op.warehouse }
      ],
      product: op.product
    }).sort({ date: 1, _id: 1 });

    let currentBalance = 0;
    for (const o of allOps) {
      if (o.type === 'add' && o.warehouse.equals(op.warehouse)) currentBalance += o.quantity;
      if (o.type === 'issue' && o.warehouse.equals(op.warehouse)) currentBalance -= o.quantity;
      if (o.type === 'transfer') {
        if (o.warehouse.equals(op.warehouse)) currentBalance -= o.quantity;
        if (o.transferTo && o.transferTo.equals(op.warehouse)) currentBalance += o.quantity;
      }
    }

    // تحقق من إمكانية الحذف بناءً على الرصيد الحالي
    if (op.type === 'add' && currentBalance < op.quantity) {
      return res.status(400).json({ message: 'لا يمكن حذف هذه العملية لأن الكمية تم صرفها أو تحويلها بالفعل.' });
    }

    // منطق الحذف للعمليات الأخرى كما هو
    if (op.type === 'issue' || op.type === 'transfer') {
      // لا يمكن حذف عملية صرف/تحويل إذا أثرت عليها عمليات لاحقة
      // (أي إذا زاد الرصيد بعد العملية)
      let balance = 0;
      for (const o of allOps) {
        if (o._id.equals(op._id)) break;
        if (o.type === 'add' && o.warehouse.equals(op.warehouse)) balance += o.quantity;
        if (o.type === 'issue' && o.warehouse.equals(op.warehouse)) balance -= o.quantity;
        if (o.type === 'transfer') {
          if (o.warehouse.equals(op.warehouse)) balance -= o.quantity;
          if (o.transferTo && o.transferTo.equals(op.warehouse)) balance += o.quantity;
        }
      }
      let afterBalance = balance;
      for (const o of allOps) {
        if (o._id.equals(op._id)) {
          if (op.type === 'issue' && o.warehouse.equals(op.warehouse)) afterBalance -= op.quantity;
          if (op.type === 'transfer' && o.warehouse.equals(op.warehouse)) afterBalance -= op.quantity;
          if (op.type === 'transfer' && o.transferTo && o.transferTo.equals(op.warehouse)) afterBalance += op.quantity;
          continue;
        }
        if (o.type === 'add' && o.warehouse.equals(op.warehouse)) afterBalance += o.quantity;
        if (o.type === 'issue' && o.warehouse.equals(op.warehouse)) afterBalance -= o.quantity;
        if (o.type === 'transfer') {
          if (o.warehouse.equals(op.warehouse)) afterBalance -= o.quantity;
          if (o.transferTo && o.transferTo.equals(op.warehouse)) afterBalance += o.quantity;
        }
      }
      if (afterBalance < 0) {
        return res.status(400).json({ message: 'لا يمكن حذف هذه العملية لأن هناك عمليات لاحقة تعتمد عليها.' });
      }
    }
    await op.deleteOne();
    res.json({ message: 'تم حذف العملية بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء حذف العملية', error: err.message });
  }
});

// تعديل عملية مخزنية
router.put('/:id', auth, async (req, res) => {
  try {
    const op = await StockOperation.findById(req.params.id);
    if (!op) return res.status(404).json({ message: 'العملية غير موجودة' });
    const { quantity, date, notes } = req.body;
    // حساب كل العمليات الحالية لهذا الصنف في هذا المخزن
    const allOps = await StockOperation.find({
      $or: [
        { warehouse: op.warehouse },
        { transferTo: op.warehouse }
      ],
      product: op.product
    }).sort({ date: 1, _id: 1 });

    // تحقق من إمكانية التعديل
    if (op.type === 'add') {
      // لا يمكن تقليل الكمية إذا تم صرفها/تحويلها بالفعل (اعتمادًا على الرصيد الحالي)
      let currentBalance = 0;
      for (const o of allOps) {
        if (o.type === 'add' && o.warehouse.equals(op.warehouse)) currentBalance += o.quantity;
        if (o.type === 'issue' && o.warehouse.equals(op.warehouse)) currentBalance -= o.quantity;
        if (o.type === 'transfer') {
          if (o.warehouse.equals(op.warehouse)) currentBalance -= o.quantity;
          if (o.transferTo && o.transferTo.equals(op.warehouse)) currentBalance += o.quantity;
        }
      }
      // إذا الرصيد الحالي أقل من الفرق بين الكمية القديمة والجديدة، امنع التعديل
      if (quantity < op.quantity && currentBalance < (op.quantity - quantity)) {
        return res.status(400).json({ message: 'لا يمكن تقليل الكمية لأن جزءًا منها تم صرفه أو تحويله بالفعل.' });
      }
    }
    if (op.type === 'issue' || op.type === 'transfer') {
      // لا يمكن زيادة الكمية إذا أثرت عليها عمليات لاحقة
      let balance = 0;
      for (const o of allOps) {
        if (o._id.equals(op._id)) break;
        if (o.type === 'add' && o.warehouse.equals(op.warehouse)) balance += o.quantity;
        if (o.type === 'issue' && o.warehouse.equals(op.warehouse)) balance -= o.quantity;
        if (o.type === 'transfer') {
          if (o.warehouse.equals(op.warehouse)) balance -= o.quantity;
          if (o.transferTo && o.transferTo.equals(op.warehouse)) balance += o.quantity;
        }
      }
      let afterBalance = balance;
      for (const o of allOps) {
        if (o._id.equals(op._id)) {
          if (op.type === 'issue' && o.warehouse.equals(op.warehouse)) afterBalance -= quantity;
          if (op.type === 'transfer' && o.warehouse.equals(op.warehouse)) afterBalance -= quantity;
          if (op.type === 'transfer' && o.transferTo && o.transferTo.equals(op.warehouse)) afterBalance += quantity;
          continue;
        }
        if (o.type === 'add' && o.warehouse.equals(op.warehouse)) afterBalance += o.quantity;
        if (o.type === 'issue' && o.warehouse.equals(op.warehouse)) afterBalance -= o.quantity;
        if (o.type === 'transfer') {
          if (o.warehouse.equals(op.warehouse)) afterBalance -= o.quantity;
          if (o.transferTo && o.transferTo.equals(op.warehouse)) afterBalance += o.quantity;
        }
      }
      if (afterBalance < 0) {
        return res.status(400).json({ message: 'لا يمكن تعديل الكمية لأن هناك عمليات لاحقة تعتمد عليها.' });
      }
    }
    op.quantity = quantity;
    op.date = date ? new Date(date) : op.date;
    op.notes = notes;
    await op.save();
    res.json({ message: 'تم تعديل العملية بنجاح', operation: op });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل العملية', error: err.message });
  }
});

module.exports = router; 