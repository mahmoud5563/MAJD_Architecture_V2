const express = require('express');
const router = express.Router();
const SalaryTransaction = require('../models/SalaryTransaction');
const Employee = require('../models/Employee');
const { auth } = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const Treasury = require('../models/Treasury');
const Category = require('../models/Category');

// @route   GET /api/salary-transactions/employee/:employeeId
// @desc    Get all salary transactions for a specific employee
// @access  Private
router.get('/employee/:employeeId', auth, async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { month, year } = req.query;

        let query = { employeeId };

        // فلترة حسب الشهر والسنة
        if (month && year) {
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        }

        const transactions = await SalaryTransaction.find(query)
            .sort({ date: 1, createdAt: 1 })
            .populate('employeeId', 'name nationalId');

        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب معاملات المرتب.', error: err.message });
    }
});

// @route   POST /api/salary-transactions
// @desc    Add a new salary transaction
// @access  Private
router.post('/', auth, async (req, res) => {
    const {
        employeeId,
        type,
        amount,
        notes,
        treasuryId
    } = req.body;

    try {
        // التحقق من وجود الموظف
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'الموظف غير موجود.' });
        }

        // إذا كان نوع المعاملة صرف راتب شهري ويوجد خزينة
        if (type === 'salary' && treasuryId) {
            const treasury = await Treasury.findById(treasuryId);
            if (!treasury) {
                return res.status(404).json({ message: 'الخزينة غير موجودة.' });
            }
            const absAmount = Math.abs(parseFloat(amount));
            if (treasury.currentBalance < absAmount) {
                return res.status(400).json({ message: 'الرصيد في الخزينة غير كافٍ لصرف المرتب.' });
            }
            // ابحث عن تصنيف "رواتب الموظفين" أو أنشئه إذا لم يوجد
            let salaryCategory = await Category.findOne({ name: 'رواتب الموظفين' });
            if (!salaryCategory) {
                salaryCategory = await Category.create({ name: 'رواتب الموظفين' });
            }
            // خصم المبلغ من الخزينة
            treasury.currentBalance -= absAmount;
            await treasury.save();
            // تسجيل معاملة مالية في جدول المعاملات
            await Transaction.create({
                treasury: treasuryId,
                type: 'مصروف',
                amount: absAmount,
                description: `صرف راتب شهري للموظف ${employee.name} (${employee.nationalId})`,
                date: new Date(),
                recordedBy: req.user.id,
                category: salaryCategory._id
            });
        }

        // الحصول على آخر معاملة للموظف لحساب المرتب الحالي
        const lastTransaction = await SalaryTransaction.findOne({ employeeId })
            .sort({ date: -1, createdAt: -1 });

        let salaryBefore;
        if (lastTransaction) {
            salaryBefore = lastTransaction.salaryAfter;
        } else {
            salaryBefore = employee.salary;
        }
        const salaryAfter = salaryBefore + parseFloat(amount);

        // إنشاء معاملة جديدة
        const transaction = new SalaryTransaction({
            employeeId,
            type,
            amount: parseFloat(amount),
            salaryBefore,
            salaryAfter,
            notes,
            date: req.body.date ? new Date(req.body.date) : undefined
        });

        await transaction.save();

        // تحديث مرتب الموظف في جدول الموظفين
        employee.salary = salaryAfter;
        await employee.save();

        // إرجاع المعاملة مع بيانات الموظف
        const populatedTransaction = await SalaryTransaction.findById(transaction._id)
            .populate('employeeId', 'name nationalId');

        res.status(201).json({ 
            message: 'تم إضافة معاملة المرتب بنجاح.', 
            transaction: populatedTransaction 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء إضافة معاملة المرتب.', error: err.message });
    }
});

// @route   PUT /api/salary-transactions/:id
// @desc    Update a salary transaction
// @access  Private
router.put('/:id', auth, async (req, res) => {
    const {
        type,
        amount,
        notes
    } = req.body;

    try {
        const transaction = await SalaryTransaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ message: 'معاملة المرتب غير موجودة.' });
        }

        // تحديث البيانات
        if (type) transaction.type = type;
        if (amount !== undefined) transaction.amount = parseFloat(amount);
        if (notes !== undefined) transaction.notes = notes;

        // إعادة حساب المرتب بعد التحديث
        const previousTransaction = await SalaryTransaction.findOne({
            employeeId: transaction.employeeId,
            date: { $lt: transaction.date }
        }).sort({ date: -1 });

        const salaryBefore = previousTransaction ? previousTransaction.salaryAfter : 0;
        transaction.salaryBefore = salaryBefore;
        transaction.salaryAfter = salaryBefore + transaction.amount;

        await transaction.save();

        // إعادة حساب جميع المعاملات اللاحقة
        await recalculateSubsequentTransactions(transaction.employeeId, transaction.date);

        // تحديث مرتب الموظف
        const lastTransaction = await SalaryTransaction.findOne({ employeeId: transaction.employeeId })
            .sort({ date: -1 });
        
        const employee = await Employee.findById(transaction.employeeId);
        if (employee && lastTransaction) {
            employee.salary = lastTransaction.salaryAfter;
            await employee.save();
        }

        const populatedTransaction = await SalaryTransaction.findById(transaction._id)
            .populate('employeeId', 'name nationalId');

        res.json({ 
            message: 'تم تحديث معاملة المرتب بنجاح.', 
            transaction: populatedTransaction 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء تحديث معاملة المرتب.', error: err.message });
    }
});

// @route   DELETE /api/salary-transactions/:id
// @desc    Delete a salary transaction
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const transaction = await SalaryTransaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ message: 'معاملة المرتب غير موجودة.' });
        }

        const employeeId = transaction.employeeId;

        // حذف المعاملة
        await SalaryTransaction.deleteOne({ _id: req.params.id });

        // إعادة حساب جميع المعاملات اللاحقة
        await recalculateSubsequentTransactions(employeeId, transaction.date);

        // تحديث مرتب الموظف
        const lastTransaction = await SalaryTransaction.findOne({ employeeId })
            .sort({ date: -1 });
        
        const employee = await Employee.findById(employeeId);
        if (employee) {
            if (lastTransaction) {
                employee.salary = lastTransaction.salaryAfter;
            } else {
                employee.salary = typeof employee.baseSalary === 'number' ? employee.baseSalary : employee.salary;
            }
            await employee.save();
        }

        res.json({ message: 'تم حذف معاملة المرتب بنجاح.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء حذف معاملة المرتب.', error: err.message });
    }
});

// دالة مساعدة لإعادة حساب المعاملات اللاحقة
async function recalculateSubsequentTransactions(employeeId, fromDate) {
    const subsequentTransactions = await SalaryTransaction.find({
        employeeId,
        date: { $gt: fromDate }
    }).sort({ date: 1 });

    let currentSalary = 0;
    
    // الحصول على آخر معاملة قبل التاريخ المحدد
    const previousTransaction = await SalaryTransaction.findOne({
        employeeId,
        date: { $lt: fromDate }
    }).sort({ date: -1 });

    if (previousTransaction) {
        currentSalary = previousTransaction.salaryAfter;
    }

    // إعادة حساب كل معاملة لاحقة
    for (const transaction of subsequentTransactions) {
        transaction.salaryBefore = currentSalary;
        transaction.salaryAfter = currentSalary + transaction.amount;
        currentSalary = transaction.salaryAfter;
        await transaction.save();
    }
}

module.exports = router; 