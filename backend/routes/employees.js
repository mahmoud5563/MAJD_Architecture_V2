const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { auth } = require('../middleware/authMiddleware');

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

module.exports = router; 