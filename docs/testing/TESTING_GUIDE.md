# Multilingual Testing Guide

## Quick Start

Your Pathshala Pro application now has **complete multilingual support** with 4 languages:
- 🇬🇧 **English** (en) - Default
- 🇧🇩 **বাংলা / Bengali** (bn)
- 🇮🇳 **हिन्दी / Hindi** (hi)
- 🇵🇰 **اردو / Urdu** (ur) - RTL

## How to Test

### 1. Start the Application
```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

### 2. Login
Use the demo credentials:
- **Email**: `admin@demohighschool.edu`
- **Password**: `password123`

### 3. Switch Languages

Look for the **language selector** in the header (top-right corner). Click on it and select different languages:

1. **English** → Shows English text
2. **বাংলা** → Shows Bengali text
3. **हिन्दी** → Shows Hindi text  
4. **اردو** → Shows Urdu text (RTL layout)

### 4. What to Check

#### ✅ Sidebar Navigation
All menu items should translate properly:

**Overview Section:**
- Dashboard → ড্যাশবোর্ড → डैशबोर्ड → ڈیش بورڈ

**Admissions Section:**
- Admissions → ভর্তি → प्रवेश → داخلے
- Create Admission → ভর্তি তৈরি করুন → प्रवेश बनाएँ → داخلہ بنائیں

**Academic Section:**
- Academic → শিক্ষা → शिक्षा → تعلیمی
- Students → শিক্ষার্থী -শিক্ষার্থী ী → छात्र → طلباء
- Attendance → উপস্থিতি → उपस्थिति → حاضری
- Exams → পরীক্ষা → परीक्षा → امتحانات
- Academic Year → শিক্ষাবর্ষ → शिक्षा वर्ष → تعلیمی سال

**Academic Settings Section:**
- Classes → শ্রেণী → कक्षा → جماعت
- Groups → গ্রুপ → समूह → گروپس
- Sections → শাখা → वर्ग → سیکشنز

**Finance Section:**
- Fee Vouchers → ফি ভাউচার → शुल्क वाउचर → فیس واؤچر
- Fee Collection → ফি সংগ্রহ → शुल्क संग्रह → فیس وصولی
- Transactions → লেনদেন → लेनदेन → لین دین

**HR Section:**
- Staff → কর্মচারী → कर्मचारी → عملہ
- Salary / Payroll → বেতন / বেতনপত্র → वेतन / वेतनपत्र → تنخواہ / پے رول

**Administration Section:**
- Users → ব্যবহারকারী → उपयोगकर्ता → صارفین
- Settings → সেটিংস → सेटिंग्स → ترتیبات

#### ✅ Header Breadcrumbs
Navigate to different pages and check if breadcrumbs translate:
- Home → Dashboard
- Home → Students
- Home → Fees → Fee Vouchers
- etc.

#### ✅ Language Selector Label
The language selector itself should show "Language" in the current language:
- English → "Language"
- Bengali → "ভাষা"
- Hindi → "भाषा"
- Urdu → "زبان"

#### ✅ RTL Support (Urdu Only)
When you select Urdu (اردو):
- Entire layout should flip horizontally (RTL direction)
- Text should align to the right
- Icons should maintain proper positioning
- Sidebar should be on the right side

### 5. Common Issues to Look For

❌ **Missing Translations**
- If you see translation keys like `nav.admissions` instead of translated text
- This means the key is missing from the translation file

❌ **Mixed Languages**
- Some text in English, some in selected language
- Check if all components use `useTranslations()` hook

❌ **Layout Issues (Urdu)**
- RTL not working properly
- Elements overlapping or misaligned

❌ **Console Errors**
- Open browser DevTools (F12)
- Check for i18n-related errors

## Technical Verification

### Check Translation Files
```bash
# Validate all JSON files
node -e "
const en = require('./src/messages/en.json');
const bn = require('./src/messages/bn.json');
const hi = require('./src/messages/hi.json');
const ur = require('./src/messages/ur.json');
console.log('✓ All languages loaded successfully');
console.log('English:', Object.keys(en.nav).length, 'keys');
console.log('Bengali:', Object.keys(bn.nav).length, 'keys');
console.log('Hindi:', Object.keys(hi.nav).length, 'keys');
console.log('Urdu:', Object.keys(ur.nav).length, 'keys');
"
```

Expected output:
```
✓ All languages loaded successfully
English: 23 keys
Bengali: 23 keys
Hindi: 23 keys
Urdu: 23 keys
```

### Browser Console Test
Open browser console and run:
```javascript
// Check current locale
document.documentElement.lang // Should show current locale code
document.documentElement.dir  // Should be 'rtl' for Urdu, 'ltr' for others
```

## Success Criteria

✅ All navigation items translate correctly  
✅ Breadcrumbs update based on selected language  
✅ Language selector works smoothly  
✅ No translation keys visible in UI  
✅ Urdu RTL layout works properly  
✅ No console errors related to i18n  
✅ Application builds without errors  

## Reporting Issues

If you find any issues, note:
1. Which language is affected?
2. Which page/component shows the issue?
3. What is the expected translation?
4. Screenshot if possible

## Additional Testing

### Mobile Responsive
- Test language switching on mobile viewports
- Check if RTL works on mobile for Urdu
- Verify sidebar translations on collapsed state

### Performance
- Language switching should be instant
- No flickering or loading delays
- Translations should cache properly

### Accessibility
- Screen readers should announce in correct language
- ARIA labels should translate
- Focus indicators should work in RTL mode

## Next Steps After Testing

1. ✅ If everything works → Deploy to production
2. ⚠️ If issues found → Fix translation files
3. 💡 Want more features → Add form label translations

---

**Happy Testing! 🎉**

For questions or issues, refer to `../i18n/MULTILINGUAL_UPDATE_SUMMARY.md`
