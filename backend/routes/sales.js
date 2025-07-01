const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Client = require('../models/Client');
const Transaction = require('../models/Transaction');
const Treasury = require('../models/Treasury');
const SaleReturn = require('../models/SaleReturn');
const Product = require('../models/Product');
const { auth } = require('../middleware/authMiddleware');
const StockOperation = require('../models/StockOperation');

// جلب كل المبيعات
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.client) {
            filter.client = req.query.client;
        }
        const sales = await Sale.find(filter)
            .populate('client', 'clientName')
            .populate('items.product', 'name')
            .sort({ date: -1 });
        res.json(sales);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء جلب المبيعات', error: err.message });
    }
});

// إضافة فاتورة مبيعات جديدة
router.post('/', /*auth,*/ async (req, res) => {
    try {
        const { date, client, clientName, type, items, total, treasury, status, warehouse } = req.body;
        if (!date || !type || !items || !Array.isArray(items) || items.length === 0 || (status !== 'عرض سعر' && !treasury)) {
            return res.status(400).json({ message: 'يرجى تعبئة جميع الحقول المطلوبة وإضافة بند واحد على الأقل.' });
        }
        // جلب كل الفواتير وأخذ أكبر رقم رقمي فقط
        const allSales = await Sale.find({}, { invoiceNumber: 1 });
        let maxNumber = 0;
        allSales.forEach(sale => {
            const match = String(sale.invoiceNumber).match(/^(\d+)$/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNumber) maxNumber = num;
            }
        });
        const invoiceNumber = (maxNumber + 1).toString();
        // تحقق من عدم تكرار رقم الفاتورة
        const exists = await Sale.findOne({ invoiceNumber });
        if (exists) {
            return res.status(400).json({ message: 'رقم الفاتورة مستخدم من قبل.' });
        }
        let treasuryDoc = null;
        if (status !== 'عرض سعر') {
            treasuryDoc = await Treasury.findById(treasury);
            if (!treasuryDoc) {
                return res.status(400).json({ message: 'الخزينة غير موجودة.' });
            }
        }
        const paymentType = req.body.paymentType || 'نقدي';
        const paymentMethod = req.body.paymentMethod || 'كاش';
        let paidAmount = paymentType === 'أجل' ? Number(req.body.paidAmount) : total;
        if (isNaN(paidAmount) || paidAmount < 0) paidAmount = 0;
        const balance = paymentType === 'أجل' ? (total - paidAmount) : 0;
        const sale = new Sale({
            invoiceNumber,
            date,
            client: client || undefined,
            clientName: clientName || undefined,
            type,
            items,
            total,
            status: status || 'مدفوعة',
            createdBy: req.user ? req.user._id : undefined,
            treasury: status !== 'عرض سعر' ? treasury : undefined,
            paymentType,
            paymentMethod,
            paidAmount,
            balance,
            warehouse: warehouse || undefined
        });
        await sale.save();
        if (status !== 'عرض سعر') {
            const transaction = new Transaction({
                recordedBy: req.user ? req.user._id : undefined,
                treasury,
                type: 'إيداع',
                amount: total,
                description: `تحصيل فاتورة مبيعات رقم ${invoiceNumber}`,
                date: date
            });
            await transaction.save();
            treasuryDoc.currentBalance += total;
            await treasuryDoc.save();
        }
        // خصم الكمية من المخزن المختار فقط
        if (warehouse && Array.isArray(items)) {
            for (const item of items) {
                if (item.product && item.product !== 'undefined') {
                    await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
                    // إضافة عملية بيع في جدول العمليات المخزنية
                    await StockOperation.create({
                        type: 'بيع',
                        product: item.product,
                        quantity: item.quantity,
                        warehouse: warehouse,
                        date: new Date(),
                        notes: `بيع بسبب فاتورة مبيعات رقم ${invoiceNumber}`
                    });
                }
            }
        }
        res.json({ message: 'تم حفظ الفاتورة بنجاح', sale });
    } catch (err) {
        console.error('خطأ أثناء حفظ الفاتورة:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء حفظ الفاتورة', error: err.message });
    }
});

// حذف فاتورة مبيعات
router.delete('/:id', async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);
        if (!sale) return res.status(404).json({ message: 'الفاتورة غير موجودة.' });
        // حذف المعاملة المالية المرتبطة إذا كانت ليست عرض سعر
        if (sale.status !== 'عرض سعر') {
            await Transaction.deleteMany({ description: { $regex: sale.invoiceNumber } });
        }
        await Sale.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف الفاتورة بنجاح.' });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء حذف الفاتورة', error: err.message });
    }
});

// تسديد جزء من فاتورة أجل
router.post('/:id/pay', async (req, res) => {
    try {
        const { amount, treasury } = req.body;
        if (!amount || !treasury) {
            return res.status(400).json({ message: 'يرجى تحديد المبلغ والخزنة.' });
        }
        const sale = await Sale.findById(req.params.id);
        if (!sale) return res.status(404).json({ message: 'الفاتورة غير موجودة.' });
        if (sale.paymentType !== 'أجل' || sale.balance <= 0) {
            return res.status(400).json({ message: 'هذه الفاتورة ليست أجل أو لا يوجد رصيد متبقي.' });
        }
        if (amount > sale.balance) {
            return res.status(400).json({ message: 'المبلغ أكبر من الرصيد المتبقي على الفاتورة.' });
        }
        const treasuryDoc = await Treasury.findById(treasury);
        if (!treasuryDoc) return res.status(404).json({ message: 'الخزنة غير موجودة.' });
        if (treasuryDoc.currentBalance < amount) {
            return res.status(400).json({ message: 'الرصيد في الخزنة غير كافٍ.' });
        }
        // تحديث الفاتورة
        sale.paidAmount = (sale.paidAmount || 0) + amount;
        sale.balance = sale.total - sale.paidAmount;
        if (sale.balance <= 0) {
            sale.balance = 0;
            sale.status = 'مدفوع';
        }
        await sale.save();
        // تحديث رصيد الخزنة
        treasuryDoc.currentBalance -= amount;
        await treasuryDoc.save();
        // إضافة معاملة مالية
        const transaction = new Transaction({
            treasury,
            type: 'إيداع',
            amount,
            description: `تسديد جزء من فاتورة مبيعات رقم ${sale.invoiceNumber}`,
            date: new Date(),
            recordedBy: req.user ? req.user._id : undefined
        });
        await transaction.save();
        res.json({ message: 'تم تسديد المبلغ بنجاح.', sale });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء التسديد', error: err.message });
    }
});

// تحديث فاتورة مبيعات
router.put('/:id', async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);
        if (!sale) return res.status(404).json({ message: 'الفاتورة غير موجودة.' });

        // تحديث الحقول
        sale.date = req.body.date || sale.date;
        sale.client = req.body.client || sale.client;
        sale.clientName = req.body.clientName || sale.clientName;
        sale.type = req.body.type || sale.type;
        sale.items = req.body.items || sale.items;
        sale.total = req.body.total || sale.total;
        sale.treasury = req.body.treasury || sale.treasury;
        sale.paymentType = req.body.paymentType || sale.paymentType;
        sale.paymentMethod = req.body.paymentMethod || sale.paymentMethod;
        sale.paidAmount = req.body.paidAmount != null ? req.body.paidAmount : sale.paidAmount;
        sale.balance = req.body.balance != null ? req.body.balance : sale.balance;

        await sale.save();
        res.json({ message: 'تم تحديث الفاتورة بنجاح', sale });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء تحديث الفاتورة', error: err.message });
    }
});

// @route   POST /api/sale-returns
// @desc    إنشاء مرتجع جديد
// @access  Private
router.post('/sale-returns', auth, async (req, res) => {
    try {
        const { sale, client, clientName, items, total, reason, warehouse, treasury } = req.body;
        const saleReturn = new SaleReturn({
            sale,
            client,
            clientName,
            items,
            total,
            reason,
            warehouse,
            treasury,
            createdBy: req.user.id
        });
        await saleReturn.save();
        // تحديث المخزون: أضف الكمية للمخزن المختار فقط
        if (warehouse && Array.isArray(items)) {
            for (const item of items) {
                if (item.product && item.product !== 'undefined') {
                    await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
                    // إضافة عملية استرجاع في جدول العمليات المخزنية
                    await StockOperation.create({
                        type: 'استرجاع',
                        product: item.product,
                        quantity: item.quantity,
                        warehouse: warehouse,
                        date: new Date(),
                        notes: `استرجاع بسبب مرتجع فاتورة مبيعات`
                    });
                }
                // إذا لم يكن هناك product id (خدمة)، لا تفعل شيئًا للمخزون، فقط احفظ بيانات المرتجع
            }
        }
        // خصم قيمة المرتجع من الخزينة المختارة
        if (treasury && total > 0) {
            const treasuryDoc = await Treasury.findById(treasury);
            if (treasuryDoc) {
                treasuryDoc.currentBalance -= total;
                await treasuryDoc.save();
            }
        }
        // تعديل الكمية في الفاتورة الأصلية
        const saleDoc = await Sale.findById(sale);
        if (saleDoc) {
            let total = 0;
            saleDoc.items = saleDoc.items.map(saleItem => {
                const returned = items.find(i => String(i.product) === String(saleItem.product));
                if (returned) {
                    let newQty = saleItem.quantity - returned.quantity;
                    if (newQty < 0) newQty = 0;
                    saleItem.quantity = newQty;
                    saleItem.total = saleItem.unitPrice * newQty;
                }
                total += saleItem.total;
                return saleItem;
            });
            saleDoc.total = total;
            await saleDoc.save();
        }
        res.status(201).json({ message: 'تم إنشاء المرتجع بنجاح.', saleReturn });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء إنشاء المرتجع.' });
    }
});

// @route   GET /api/sale-returns
// @desc    جلب كل المرتجعات
// @access  Private
router.get('/sale-returns', auth, async (req, res) => {
    try {
        const saleReturns = await SaleReturn.find().populate('sale client createdBy').sort({ date: -1 });
        res.json(saleReturns);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب المرتجعات.' });
    }
});

// @route   GET /api/sale-returns/:id
// @desc    جلب تفاصيل مرتجع واحد
// @access  Private
router.get('/sale-returns/:id', auth, async (req, res) => {
    try {
        const saleReturn = await SaleReturn.findById(req.params.id).populate('sale client createdBy items.product');
        if (!saleReturn) return res.status(404).json({ message: 'المرتجع غير موجود.' });
        res.json(saleReturn);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء جلب المرتجع.' });
    }
});

// جلب فاتورة واحدة بالتفصيل
router.get('/:id', async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id)
            .populate('client', 'clientName')
            .populate('items.product', 'name');
        if (!sale) return res.status(404).json({ message: 'الفاتورة غير موجودة.' });
        // تجهيز الأصناف بشكل مناسب للواجهة
        const items = (sale.items || []).map(item => ({
            product: item.product?._id || item.product,
            name: item.product?.name || item.name || '-',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total
        }));
        res.json({
            _id: sale._id,
            invoiceNumber: sale.invoiceNumber,
            clientName: sale.clientName || sale.client?.clientName || '-',
            date: sale.date,
            total: sale.total,
            items
        });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء جلب الفاتورة', error: err.message });
    }
});

module.exports = router; 