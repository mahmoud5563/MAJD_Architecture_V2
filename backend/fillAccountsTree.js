const mongoose = require('mongoose');
const Account = require('./models/Account');

// قائمة الحسابات الهرمية كما أرسلها المستخدم
const accountsTree = [
  'الأصول',
  '  الأصول المتداولة',
  '    النقدية',
  '    العملاء',
  '    المخزون',
  '    سلف العاملين',
  '    المصروفات المدفوعة مقدماً',
  '    البنوك',
  '    أصول متداولة أخرى',
  '  الأصول الثابتة',
  '    المباني',
  '    اهلاك مباني',
  '    المنشآت',
  '    اهلاك منشآت',
  '    المعدات',
  '    اهلاك معدات',
  '    العدد والأدوات',
  '    اهلاك عدد وأدوات',
  '    الأجهزة',
  '    اهلاك أجهزة',
  '    الأثاث',
  '    اهلاك أثاث',
  '    السيارات',
  '    اهلاك سيارات',
  'الالتزامات',
  '  الالتزامات قصيرة الأجل',
  '    الموردين',
  '    المصروفات المستحقة',
  '    قروض قصيرة الأجل',
  '  الالتزامات طويلة الأجل',
  '    قروض طويلة الأجل',
  '    شركات تمويل',
  '    التزامات أخرى طويلة الأجل',
  'حقوق الملكية',
  '  رأس المال',
  '  المسحوبات',
  '  الأرباح المحتجزة',
  '  جاري الشريك',
  'الإيرادات',
  '  إيرادات النشاط الرئيسي',
  '  إيرادات أخرى',
  '  مرتجعات المبيعات',
  '  الخصم على المبيعات',
  'المصروفات',
  '  مصروفات تشغيلية',
  '    رواتب وأجور',
  '    كهرباء ومياه',
  '    إيجارات',
  '    صيانة وإصلاحات',
  '    مصروفات نقل وتوصيل',
  '    مصروفات استهلاك أصول',
  '  مصروفات إدارية وعمومية',
  '    أدوات مكتبية (قرطاسية)',
  '    اتصالات وإنترنت',
  '    مصروفات قانونية',
  '    رسوم حكومية',
  '    مصروفات بنكية',
  '  مصروفات تسويقية',
  '    إعلانات',
  '    خصومات وعروض',
  '    تصميمات وطباعة بروشورات',
  '    عمولات البيع',
  '    مصروفات شحن للعميل',
  '  مصروفات تمويلية',
  '    فوائد قروض',
  '    مصروفات تمويل',
  '    عمولات تمويل خارجية',
  '  مصروفات استثنائية',
  '    خسائر ناتجة عن تلف أو سرقة',
  '    مصروفات قضايا أو نزاعات',
  '    تسويات محاسبية'
];

// إعداد الاتصال بقاعدة البيانات
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/MAJD_Architecture_DB';

async function fillAccounts() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // حذف كل الحسابات القديمة (اختياري)
  await Account.deleteMany({});

  const stack = [];
  let codeCounter = 1000;

  for (const line of accountsTree) {
    const name = line.trim();
    if (!name) continue;
    const indent = line.match(/^\s*/)[0].length;
    // تحديد نوع الحساب
    const type = indent === 0 ? 'رئيسي' : 'فرعي';
    // تحديد الأب
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack.length ? stack[stack.length - 1].id : null;
    // إنشاء الحساب
    const acc = new Account({
      name,
      code: (codeCounter++).toString(),
      type,
      parent
    });
    await acc.save();
    stack.push({ id: acc._id, indent });
    console.log(`Added: ${name} (${type})`);
  }
  console.log('تمت إضافة جميع الحسابات بنجاح!');
  process.exit();
}

fillAccounts().catch(err => {
  console.error(err);
  process.exit(1);
}); 