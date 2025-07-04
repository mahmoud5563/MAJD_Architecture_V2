// backend/server.js
require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 3000;

// إعدادات إضافية للتعامل مع CORS
app.use((req, res, next) => {
    // السماح لجميع النطاقات
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // السماح بالطرق المطلوبة
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    
    // السماح بالهيدرز المطلوبة
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-token');
    
    // التعامل مع preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
    console.log('CORS enabled for all origins');
});
