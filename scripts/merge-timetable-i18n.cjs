const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "src", "messages");

const data = {
  en: {
    timetable: {
      title: "Class Timetable",
      description: "Weekly routine, periods, and teacher allocation",
      selectClass: "Select Class",
      selectSection: "Select Section",
      selectYear: "Academic Year",
      allSections: "All Sections",
      addPeriod: "Add Period",
      editPeriod: "Edit Period",
      deletePeriod: "Delete Period",
      dayMonday: "Monday",
      dayTuesday: "Tuesday",
      dayWednesday: "Wednesday",
      dayThursday: "Thursday",
      dayFriday: "Friday",
      daySaturday: "Saturday",
      daySunday: "Sunday",
      period: "Period {number}",
      break: "Break",
      tiffinBreak: "Tiffin Break",
      subject: "Subject",
      teacher: "Teacher",
      room: "Room",
      startTime: "Start Time",
      endTime: "End Time",
      dayOfWeek: "Day",
      periodNumber: "Period No.",
      noEntries: "No periods scheduled",
      noEntriesHint: "Add periods to build the weekly routine for this class",
      clashDetected: "Teacher clash detected",
      clashMessage: "{teacher} is already assigned to {className} on {day} period {period}",
      saveSuccess: "Timetable saved",
      saveFailed: "Failed to save timetable entry",
      deleteSuccess: "Period removed",
      deleteFailed: "Failed to remove period",
      confirmDelete: "Remove this period from the timetable?",
      print: "Print Routine",
      copyToNextYear: "Copy to next year"
    }
  },
  ur: {
    timetable: {
      title: "کلاس ٹائم ٹیبل",
      description: "ہفتہ وار روٹین، پیریڈ اور استاد کی تقسیم",
      selectClass: "جماعت منتخب کریں",
      selectSection: "سیکشن منتخب کریں",
      selectYear: "تعلیمی سال",
      allSections: "تمام سیکشنز",
      addPeriod: "پیریڈ شامل کریں",
      editPeriod: "پیریڈ میں ترمیم",
      deletePeriod: "پیریڈ حذف کریں",
      dayMonday: "پیر",
      dayTuesday: "منگل",
      dayWednesday: "بدھ",
      dayThursday: "جمعرات",
      dayFriday: "جمعہ",
      daySaturday: "ہفتہ",
      daySunday: "اتوار",
      period: "پیریڈ {number}",
      break: "وقفہ",
      tiffinBreak: "ٹفن بریک",
      subject: "مضمون",
      teacher: "استاد",
      room: "کمرہ",
      startTime: "آغاز کا وقت",
      endTime: "اختتام کا وقت",
      dayOfWeek: "دن",
      periodNumber: "پیریڈ نمبر",
      noEntries: "کوئی پیریڈ شیڈول نہیں",
      noEntriesHint: "اس جماعت کے لیے ہفتہ وار روٹین بنانے کے لیے پیریڈ شامل کریں",
      clashDetected: "استاد کا ٹکراؤ",
      clashMessage: "{teacher} پہلے سے {className} میں {day} پیریڈ {period} پر تفویض ہیں",
      saveSuccess: "ٹائم ٹیبل محفوظ ہو گیا",
      saveFailed: "ٹائم ٹیبل محفوظ کرنے میں ناکامی",
      deleteSuccess: "پیریڈ ہٹا دیا گیا",
      deleteFailed: "پیریڈ ہٹانے میں ناکامی",
      confirmDelete: "کیا اس پیریڈ کو ٹائم ٹیبل سے ہٹانا ہے؟",
      print: "روٹین پرنٹ کریں",
      copyToNextYear: "اگلے سال میں کاپی کریں"
    }
  },
  hi: {
    timetable: {
      title: "कक्षा समय सारणी",
      description: "साप्ताहिक रूटीन, पीरियड और शिक्षक आवंटन",
      selectClass: "कक्षा चुनें",
      selectSection: "सेक्शन चुनें",
      selectYear: "शैक्षणिक वर्ष",
      allSections: "सभी सेक्शन",
      addPeriod: "पीरियड जोड़ें",
      editPeriod: "पीरियड संपादित करें",
      deletePeriod: "पीरियड हटाएँ",
      dayMonday: "सोमवार",
      dayTuesday: "मंगलवार",
      dayWednesday: "बुधवार",
      dayThursday: "गुरुवार",
      dayFriday: "शुक्रवार",
      daySaturday: "शनिवार",
      daySunday: "रविवार",
      period: "पीरियड {number}",
      break: "अवकाश",
      tiffinBreak: "टिफिन ब्रेक",
      subject: "विषय",
      teacher: "शिक्षक",
      room: "कमरा",
      startTime: "प्रारंभ समय",
      endTime: "समाप्ति समय",
      dayOfWeek: "दिन",
      periodNumber: "पीरियड संख्या",
      noEntries: "कोई पीरियड निर्धारित नहीं",
      noEntriesHint: "इस कक्षा के लिए साप्ताहिक रूटीन बनाने हेतु पीरियड जोड़ें",
      clashDetected: "शिक्षक टकराव",
      clashMessage: "{teacher} पहले से {className} में {day} पीरियड {period} पर नियुक्त हैं",
      saveSuccess: "समय सारणी सहेजी गई",
      saveFailed: "समय सारणी सहेजने में विफल",
      deleteSuccess: "पीरियड हटा दिया गया",
      deleteFailed: "पीरियड हटाने में विफल",
      confirmDelete: "क्या इस पीरियड को हटाना है?",
      print: "रूटीन प्रिंट करें",
      copyToNextYear: "अगले वर्ष में कॉपी करें"
    }
  },
  bn: {
    timetable: {
      title: "ক্লাস রুটিন",
      description: "সাপ্তাহিক রুটিন, পিরিয়ড ও শিক্ষক বণ্টন",
      selectClass: "ক্লাস নির্বাচন করুন",
      selectSection: "সেকশন নির্বাচন করুন",
      selectYear: "শিক্ষাবর্ষ",
      allSections: "সকল সেকশন",
      addPeriod: "পিরিয়ড যোগ করুন",
      editPeriod: "পিরিয়ড সম্পাদনা",
      deletePeriod: "পিরিয়ড মুছুন",
      dayMonday: "সোমবার",
      dayTuesday: "মঙ্গলবার",
      dayWednesday: "বুধবার",
      dayThursday: "বৃহস্পতিবার",
      dayFriday: "শুক্রবার",
      daySaturday: "শনিবার",
      daySunday: "রবিবার",
      period: "পিরিয়ড {number}",
      break: "বিরতি",
      tiffinBreak: "টিফিন বিরতি",
      subject: "বিষয়",
      teacher: "শিক্ষক",
      room: "রুম",
      startTime: "শুরুর সময়",
      endTime: "শেষের সময়",
      dayOfWeek: "বার",
      periodNumber: "পিরিয়ড নং",
      noEntries: "কোনো পিরিয়ড নির্ধারিত নেই",
      noEntriesHint: "এই ক্লাসের সাপ্তাহিক রুটিন তৈরি করতে পিরিয়ড যোগ করুন",
      clashDetected: "শিক্ষকের সময় সংঘাত",
      clashMessage: "{teacher} ইতিমধ্যে {className}-এ {day} পিরিয়ড {period}-এ নিয়োজিত",
      saveSuccess: "রুটিন সংরক্ষিত হয়েছে",
      saveFailed: "রুটিন সংরক্ষণ ব্যর্থ",
      deleteSuccess: "পিরিয়ড মুছে ফেলা হয়েছে",
      deleteFailed: "পিরিয়ড মুছতে ব্যর্থ",
      confirmDelete: "এই পিরিয়ডটি মুছবেন?",
      print: "রুটিন প্রিন্ট করুন",
      copyToNextYear: "পরের বছরে কপি করুন"
    }
  }
};

function mergeDeep(target, source) {
  for (const k of Object.keys(source)) {
    if (source[k] && typeof source[k] === "object" && !Array.isArray(source[k]) && target[k] && typeof target[k] === "object") mergeDeep(target[k], source[k]);
    else target[k] = source[k];
  }
}
for (const locale of ["en","ur","hi","bn"]) {
  const p = path.join(dir, `${locale}.json`);
  const cur = JSON.parse(fs.readFileSync(p,"utf8"));
  mergeDeep(cur, data[locale]);
  // ensure nav.timetable exists
  if (!cur.nav.timetable) cur.nav.timetable = locale==="en"?"Timetable":locale==="ur"?"ٹائم ٹیبل":locale==="hi"?"समय सारणी":"রুটিন";
  fs.writeFileSync(p, JSON.stringify(cur, null, 2)+"\n","utf8");
  console.log(`Updated ${locale}.json`);
}
