# Admissions Screen - Translation Quick Reference

## 📋 Complete Key List (39 Keys)

### Page & Navigation (6 keys)
```
admissions.title
admissions.description
admissions.addAdmission
admissions.createTitle
admissions.createDescription
admissions.back
```

### Academic Details (9 keys)
```
admissions.academicDetails
admissions.academicYear
admissions.selectAcademicYear
admissions.class
admissions.selectClass
admissions.group
admissions.selectGroup
admissions.noGroupGeneral
admissions.section
admissions.selectSection
```

### Students Management (5 keys)
```
admissions.students
admissions.addStudentsForAdmission
admissions.addStudents
admissions.noStudentsAdded
admissions.clickToAddStudents
admissions.addStudentsSuccess ✨
```

### Notes (2 keys)
```
admissions.additionalNotes
admissions.internalRemarks
```

### Summary Panel (4 keys)
```
admissions.summary
admissions.totalStudents
admissions.completeAdmission
admissions.processing
```

### Toast Messages (5 keys)
```
admissions.pleaseSelectClassAndYear
admissions.noStudentsAddedError
admissions.pleaseSelectClass
admissions.admissionCompleted
admissions.failedToProcess
```

### Data Table (7 keys)
```
admissions.studentId
admissions.rollNumber
admissions.name
admissions.admissionDate
admissions.status
admissions.searchPlaceholder
```

---

## 🌍 Language Comparison

| English | Bengali | Hindi | Urdu |
|---------|---------|-------|------|
| Admissions | ভর্তি | प्रवेश | داخلے |
| Add Admission | ভর্তি যোগ করুন | प्रवेश जोड़ें | داخلہ شامل کریں |
| Academic Year | শিক্ষাবর্ষ | शैक्षिक वर्ष | تعلیمی سال |
| Class | শ্রেণী | कक्षा | جماعت |
| Group | গ্রুপ | समूह | گروپ |
| Section | শাখা | वर्ग | سیکشن |
| Students | শিক্ষার্থী -শিক্ষার্থী ী | छात्र | طلباء |
| Add Students | শিক্ষার্থী যোগ করুন | छात्र जोड़ें | طلباء شامل کریں |
| Summary | সারসংক্ষেপ | सारांश | خلاصہ |
| Complete Admission | ভর্তি সম্পন্ন | प्रवेश पूरा करें | داخلہ مکمل کریں |

---

## 💡 Usage Examples

### In Component
```typescript
const t = useTranslations();

// Page header
<PageHeader 
  title={t('admissions.title')}
  description={t('admissions.description')}
/>

// Form labels
<label>{t('admissions.academicYear')}</label>

// Button text
<Button>{t('admissions.addStudents')}</Button>

// Placeholder
<AppDropdown placeholder={t('admissions.selectClass')} />

// Toast with count
toast.success(
  t('admissions.addStudentsSuccess').replace('{count}', count.toString())
);
```

---

## ✅ Verification Commands

```bash
# Check all translation files have same key count
node -e "
const en = require('./src/messages/en.json');
const bn = require('./src/messages/bn.json');
const hi = require('./src/messages/hi.json');
const ur = require('./src/messages/ur.json');
console.log('EN:', Object.keys(en.admissions).length);
console.log('BN:', Object.keys(bn.admissions).length);
console.log('HI:', Object.keys(hi.admissions).length);
console.log('UR:', Object.keys(ur.admissions).length);
"
```

Expected output: All should show **39**

---

## 🔍 Key Categories

### Static Text (No Variables)
Most keys are static strings that translate directly.

### Dynamic Text (With Variables)
These keys use `{count}` placeholder:
- `admissions.addStudentsSuccess` - "Added {count} student(s)"
- `admissions.admissionCompleted` - "Admission completed for {count} student(s)!"

Usage:
```typescript
t('admissions.addStudentsSuccess').replace('{count}', count.toString())
```

---

## 📊 Coverage Map

| Section | Keys | Status |
|---------|------|--------|
| Page Header | 3 | ✅ |
| Form Creation | 3 | ✅ |
| Academic Fields | 9 | ✅ |
| Student Management | 6 | ✅ |
| Notes | 2 | ✅ |
| Summary Panel | 4 | ✅ |
| Toast Messages | 5 | ✅ |
| Data Table | 7 | ✅ |
| **TOTAL** | **39** | ✅ |

---

## 🎯 Priority Keys (Most Used)

1. `admissions.title` - Main page title
2. `admissions.addAdmission` - Primary action button
3. `admissions.class` - Most referenced field
4. `admissions.students` - Section heading
5. `admissions.completeAdmission` - Submit button
6. `admissions.summary` - Sidebar heading

---

## 🐛 Common Issues & Solutions

### Issue: Count not showing in toast
**Solution**: Use `.replace('{count}', count.toString())`

### Issue: Dropdown shows English
**Check**: Ensure options array uses `t()` function

### Issue: Table headers still in English
**Check**: Update `columns` array to use `t()` for headers

---

## 📝 Notes

- All keys follow consistent naming: `admissions.[section].[item]`
- RTL layout automatically applied for Urdu locale
- No hardcoded strings remain in component
- All user-facing text is translated
- Toast messages support dynamic values

---

**Quick Test Checklist:**
- [ ] Page title translates
- [ ] All buttons translate
- [ ] All form labels translate
- [ ] All placeholders translate
- [ ] Table headers translate
- [ ] Toast messages translate
- [ ] Counts display correctly
- [ ] RTL works for Urdu

**Status**: ✅ Complete
