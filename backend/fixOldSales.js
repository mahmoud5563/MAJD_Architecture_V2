const mongoose = require('mongoose');
const Sale = require('./models/Sale');
const Product = require('./models/Product');

// عدل بيانات الاتصال حسب إعدادات مشروعك إذا لزم الأمر
const MONGO_URI = 'mongodb://localhost:27017/MAJD_Architecture_DB';

async function fixSales() {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const sales = await Sale.find({});
    let updatedCount = 0, skippedCount = 0;

    for (const sale of sales) {
        let modified = false;
        for (const item of sale.items) {
            // إذا كان الصنف مرتبط بالفعل بمنتج، تجاهله
            if (item.product) continue;

            // حاول إيجاد المنتج بالباركود (لو موجود في بيانات الصنف)
            if (item.barcode) {
                const product = await Product.findOne({ barcode: item.barcode });
                if (product) {
                    item.product = product._id;
                    modified = true;
                    continue;
                }
            }
            // إذا لم يوجد باركود، لا تربط تلقائيًا (آمن)
            skippedCount++;
        }
        if (modified) {
            await sale.save();
            updatedCount++;
        }
    }

    console.log(`تم تحديث ${updatedCount} فاتورة.`);
    console.log(`تم تخطي ${skippedCount} صنف بدون باركود أو منتج مطابق.`);
    await mongoose.disconnect();
    console.log('Done.');
}

fixSales().catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
});
