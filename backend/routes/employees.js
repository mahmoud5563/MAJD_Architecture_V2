const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { auth } = require('../middleware/authMiddleware');
const XLSX = require('xlsx');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const fs = require('fs');
const path = require('path');
const SalaryTransaction = require('../models/SalaryTransaction');
const EmployeeAdvance = require('../models/EmployeeAdvance');
const EmployeeOvertime = require('../models/EmployeeOvertime');

// @route   GET /api/employees
// @desc    Get all employees
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const employees = await Employee.find({}).sort({ name: 1 });
        res.json(employees);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب الموظفين.');
    }
});

// @route   GET /api/employees/export-payroll-sheet?month=5&year=2025
// @desc    Export payroll sheet for all employees for a specific month/year
// @access  Private
router.get('/export-payroll-sheet', auth, async (req, res) => {
    try {
        const month = parseInt(req.query.month);
        const year = parseInt(req.query.year);
        if (!month || !year) {
            return res.status(400).json({ message: 'يجب تحديد الشهر والسنة.' });
        }
        // جلب كل الموظفين
        const employees = await Employee.find({});
        // تجهيز بيانات كل موظف
        const data = [];
        let index = 1;
        for (const emp of employees) {
            // الراتب الأساسي
            const baseSalary = emp.baseSalary || emp.salary || 0;
            // بدل
            let allowance = 0;
            // حوافز (مكافأة)
            let bonus = 0;
            // أوفر تايم
            let overtime = 0;
            // خصومات
            let deduction = 0;
            // سلف
            let advance = 0;
            // جلب كل معاملات الموظف لهذا الشهر والسنة
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);
            const transactions = await SalaryTransaction.find({
                employeeId: emp._id,
                date: { $gte: startDate, $lte: endDate }
            });
            for (const t of transactions) {
                if (t.type === 'allowance') allowance += t.amount;
                if (t.type === 'bonus') bonus += t.amount;
                if (t.type === 'deduction') deduction += Math.abs(t.amount);
                if (t.type === 'overtime') overtime += t.amount;
                if (t.type === 'advance') advance += Math.abs(t.amount);
            }
            // جلب كل السلف لهذا الشهر
            const advances = await EmployeeAdvance.find({
                employee: emp._id,
                month,
                year
            });
            for (const a of advances) advance += Math.abs(a.amount);
            // جلب كل الأوفر تايم لهذا الشهر
            const overtimes = await EmployeeOvertime.find({
                employee: emp._id,
                month,
                year
            });
            for (const o of overtimes) overtime += o.amount;
            // صافي الراتب
            const netSalary = baseSalary + allowance + bonus + overtime - deduction;
            data.push({
                '#': index++,
                'الاسم': emp.name,
                'الاداره': emp.department,
                'الراتب': baseSalary,
                'بدل': allowance,
                'حوافز': bonus,
                'اوفر تايم': overtime,
                'خصومات': deduction,
                'سلف عاملين': advance,
                'صافي الراتب': netSalary
            });
        }
        // إضافة صف الإجمالي
        const totalRow = {
            '#': 'الإجمالي',
            'الاسم': '',
            'الاداره': '',
            'الراتب': data.reduce((a, b) => a + b['الراتب'], 0),
            'بدل': data.reduce((a, b) => a + b['بدل'], 0),
            'حوافز': data.reduce((a, b) => a + b['حوافز'], 0),
            'اوفر تايم': data.reduce((a, b) => a + b['اوفر تايم'], 0),
            'خصومات': data.reduce((a, b) => a + b['خصومات'], 0),
            'سلف عاملين': data.reduce((a, b) => a + b['سلف عاملين'], 0),
            'صافي الراتب': data.reduce((a, b) => a + b['صافي الراتب'], 0)
        };
        data.push(totalRow);
        // إنشاء ملف Excel
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'كشف الرواتب');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename=payroll_sheet_${month}_${year}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير كشف الرواتب المجمع', error: err.message });
    }
});

// @route   GET /api/employees/:id
// @desc    Get a single employee by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'الموظف غير موجود.' });
        }
        res.json(employee);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الموظف غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب الموظف.');
    }
});

// @route   POST /api/employees
// @desc    Add a new employee
// @access  Private
router.post('/', auth, async (req, res) => {
    const {
        name,
        nationalId,
        phone,
        email,
        position,
        department,
        salary,
        baseSalary,
        hireDate,
        status,
        address,
        emergencyContact,
        notes
    } = req.body;

    try {
        // التحقق من عدم تكرار الرقم القومي
        let employee = await Employee.findOne({ nationalId });
        if (employee) {
            return res.status(400).json({ message: 'الرقم القومي هذا مسجل بالفعل.' });
        }

        // إنشاء موظف جديد
        employee = new Employee({
            name,
            nationalId,
            phone,
            email,
            position,
            department,
            salary,
            baseSalary,
            hireDate: hireDate || new Date(),
            status,
            address,
            emergencyContact,
            notes
        });

        await employee.save();
        res.status(201).json({ 
            message: 'تم إضافة الموظف بنجاح.', 
            employee 
        });
    } catch (err) {
        console.error(err.message);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'الرقم القومي هذا مسجل بالفعل.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة الموظف.');
    }
});

// @route   PUT /api/employees/:id
// @desc    Update an employee
// @access  Private
router.put('/:id', auth, async (req, res) => {
    const {
        name,
        nationalId,
        phone,
        email,
        position,
        department,
        salary,
        hireDate,
        status,
        address,
        emergencyContact,
        notes
    } = req.body;

    try {
        let employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'الموظف غير موجود.' });
        }

        // التحقق من عدم تكرار الرقم القومي (إذا تم تغييره)
        if (nationalId && nationalId !== employee.nationalId) {
            const existingEmployee = await Employee.findOne({ nationalId });
            if (existingEmployee && existingEmployee._id.toString() !== req.params.id) {
                return res.status(400).json({ message: 'الرقم القومي هذا مسجل بالفعل لموظف آخر.' });
            }
        }

        // تحديث البيانات
        if (name) employee.name = name;
        if (nationalId) employee.nationalId = nationalId;
        if (phone) employee.phone = phone;
        if (email !== undefined) employee.email = email;
        if (position) employee.position = position;
        if (department) employee.department = department;
        if (salary !== undefined) employee.salary = salary;
        if (hireDate) employee.hireDate = hireDate;
        if (status) employee.status = status;
        if (address !== undefined) employee.address = address;
        if (emergencyContact) employee.emergencyContact = emergencyContact;
        if (notes !== undefined) employee.notes = notes;

        await employee.save();
        res.json({ 
            message: 'تم تحديث الموظف بنجاح.', 
            employee 
        });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الموظف غير صالح.' });
        }
        if (err.code === 11000) {
            return res.status(400).json({ message: 'الرقم القومي هذا مسجل بالفعل لموظف آخر.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث الموظف.');
    }
});

// @route   DELETE /api/employees/:id
// @desc    Delete an employee
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'الموظف غير موجود.' });
        }

        await Employee.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف الموظف بنجاح.' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الموظف غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف الموظف.');
    }
});

// @route   GET /api/employees/search/:query
// @desc    Search employees by name, national ID, or phone
// @access  Private
router.get('/search/:query', auth, async (req, res) => {
    try {
        const query = req.params.query;
        const employees = await Employee.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { nationalId: { $regex: query, $options: 'i' } },
                { phone: { $regex: query, $options: 'i' } }
            ]
        }).sort({ name: 1 });
        
        res.json(employees);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء البحث عن الموظفين.');
    }
});

// @route   GET /api/employees/status/:status
// @desc    Get employees by status
// @access  Private
router.get('/status/:status', auth, async (req, res) => {
    try {
        const status = req.params.status;
        const employees = await Employee.find({ status }).sort({ name: 1 });
        res.json(employees);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب الموظفين.');
    }
});

// @route   GET /api/employees/department/:department
// @desc    Get employees by department
// @access  Private
router.get('/department/:department', auth, async (req, res) => {
    try {
        const department = req.params.department;
        const employees = await Employee.find({ department }).sort({ name: 1 });
        res.json(employees);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب الموظفين.');
    }
});

// @route   GET /api/employees/:id/export-salary-sheet
// @desc    Export employee salary sheet as Excel
// @access  Private
router.get('/:id/export-salary-sheet', auth, async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'الموظف غير موجود.' });
        }
        // جلب كل الحركات المرتبطة بالموظف
        const transactions = await SalaryTransaction.find({ employeeId: employee._id }).sort({ date: 1, createdAt: 1 });

        // حماية ضد نقص البيانات
        const baseSalary = (typeof employee.baseSalary === 'number' && !isNaN(employee.baseSalary)) ? employee.baseSalary : 0;
        // تجهيز بيانات الجدول
        const tableRows = transactions.map((t, idx) => ({
            '#': idx + 1,
            'التاريخ': t.date ? t.date.toISOString().slice(0, 10) : '',
            'النوع': t.type,
            'المبلغ': t.amount,
            'قبل العملية': t.salaryBefore,
            'بعد العملية': t.salaryAfter,
            'ملاحظات': t.notes || ''
        }));

        // تجهيز بيانات الشيت
        const sheetData = [];
        // بيانات الموظف الأساسية
        sheetData.push(['اسم الموظف', employee.name || '']);
        sheetData.push(['القسم', employee.department || '']);
        sheetData.push(['الوظيفة', employee.position || '']);
        // الراتب الأساسي أولاً
        sheetData.push(['الراتب الأساسي', baseSalary]);
        sheetData.push([]); // سطر فارغ
        // رأس الجدول
        if (tableRows.length > 0) {
            sheetData.push(Object.keys(tableRows[0]));
            tableRows.forEach(row => sheetData.push(Object.values(row)));
        } else {
            sheetData.push(['لا توجد حركات راتب']);
        }
        sheetData.push([]); // سطر فارغ
        // المتبقي من المرتب (آخر salaryAfter)
        let lastSalary = baseSalary;
        if (transactions.length > 0) {
            const last = transactions[transactions.length - 1];
            lastSalary = (typeof last.salaryAfter === 'number' && !isNaN(last.salaryAfter)) ? last.salaryAfter : baseSalary;
        }
        sheetData.push(['المتبقي من المرتب', lastSalary]);

        // إنشاء ملف Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, 'كشف الراتب');

        // تحويل الملف إلى بافر
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const safeName = String(employee.name || 'employee').replace(/[^a-zA-Z0-9-_]/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename=salary-sheet-${safeName}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير كشف الراتب.' });
    }
});

// @route   POST /api/employees/:id/images
// @desc    Add an image to an employee
// @access  Private
router.post('/:id/images', auth, upload.single('image'), handleUploadError, async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'الموظف غير موجود.' });
        }
        const { imageName } = req.body;
        if (!imageName || !req.file) {
            return res.status(400).json({ message: 'يجب إدخال اسم الصورة واختيار ملف صورة.' });
        }
        const imageObj = {
            name: imageName,
            filename: req.file.filename,
            path: req.file.path.replace(/\\/g, '/')
        };
        employee.images.push(imageObj);
        await employee.save();
        res.status(201).json({ message: 'تمت إضافة الصورة بنجاح.', image: imageObj });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء إضافة الصورة.' });
    }
});

// @route   DELETE /api/employees/:id/images/:filename
// @desc    Delete an image from an employee
// @access  Private
router.delete('/:id/images/:filename', auth, async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'الموظف غير موجود.' });
        const idx = employee.images.findIndex(img => img.filename === req.params.filename);
        if (idx === -1) return res.status(404).json({ message: 'الصورة غير موجودة.' });
        const img = employee.images[idx];
        // حذف الملف من النظام
        const filePath = path.join(__dirname, '../uploads', img.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        // حذف من قاعدة البيانات
        employee.images.splice(idx, 1);
        await employee.save();
        res.json({ message: 'تم حذف الصورة بنجاح.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء حذف الصورة.' });
    }
});

// @route   PUT /api/employees/:id/images/:filename
// @desc    Edit image name for an employee
// @access  Private
router.put('/:id/images/:filename', auth, async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: 'الموظف غير موجود.' });
        const idx = employee.images.findIndex(img => img.filename === req.params.filename);
        if (idx === -1) return res.status(404).json({ message: 'الصورة غير موجودة.' });
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'يجب إدخال اسم جديد.' });
        employee.images[idx].name = name.trim();
        await employee.save();
        res.json({ message: 'تم تعديل اسم الصورة.', image: employee.images[idx] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء تعديل اسم الصورة.' });
    }
});

module.exports = router; 