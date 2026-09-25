#!/usr/bin/env python3
"""Author the `rollover` message namespace in all four locales.

The rollover wizard (roadmap item 16) is the third surface that renders
server-side findings from a runtime `code` + `params`, so it is the third place
a missing namespace can hide. The namespace is authored here in one pass rather
than left to be filled in per-component, because `i18n-parity-and-interpolation
.test.ts` requires all four locales to hold exactly the keys en holds: a key
added to one file and forgotten in another is a test failure, and a key added to
none of them is invisible.

Three sub-namespaces are keyed by a value the server owns, and each is asserted
against that value by `rollover-i18n.test.ts`:
  * `codes`       — `ROLLOVER_FINDING_CODES` (14)
  * `fixes`       — the same 14
  * `skipReasons` — `ROLLOVER_SKIP_REASONS` (2)
  * `notCopied`   — `NOT_COPIED_KEYS` (9), each with a title and a reason

The module ships an English `reason` for every not-copied entry and an English
`message` for every finding. Neither is for display — the module says so — so
both are translated here, and `rollover-i18n.test.ts` fails if a locale still
carries the module's English text.

## Format

Locale JSON is 2-space indent, CRLF, no BOM, no trailing newline. A round-trip
of the unmodified file is asserted byte for byte before anything is written, and
placeholder order is checked against en (the parity test compares the extracted
lists in order, so a translation that reads naturally in a different word order
is a failure).
"""

import collections
import json
import re
import sys

LOCALES = ["en", "ur", "hi", "bn"]

# ---------------------------------------------------------------------------
# The wizard chrome
# ---------------------------------------------------------------------------

ROLLOVER = {
    "en": {
        "title": "Roll over the academic year",
        "description": "Open the next academic year and carry forward the configuration that belongs to a year.",
        "sourceYearLabel": "Source year",
        "sourceYearHint": "The year being rolled over. Its promotion rules and fee structures are the ones carried forward.",
        "modeLabel": "Target",
        "modeCreate": "Open a new year",
        "modeCreateHint": "Create the next academic year and write the configuration into it.",
        "modeExisting": "Roll into an existing year",
        "modeExistingHint": "Write the configuration into a year that already exists.",
        "targetYearLabel": "Target year",
        "targetYearHint": "The year the configuration is written into.",
        "copyTitle": "Configuration to carry",
        "copyDescription": "Only configuration that belongs to a year and can be matched to a class is carried.",
        "copyPromotionRules": "Promotion rules",
        "copyPromotionRulesHint": "One rule per class, deciding who is promoted at the end of the year.",
        "copyFeeStructures": "Class fee structures",
        "copyFeeStructuresHint": "The monthly fee breakdown per class.",
        "nothingSelected": "Nothing is selected, so the target year will keep only what it already has.",
        "preview": "Preview",
        "previewing": "Building the preview...",
        "apply": "Open the year",
        "applying": "Opening the year...",
        "recheck": "Refresh preview",
        "cancel": "Cancel",
        "previewTitle": "Preview",
        "previewDescription": "Nothing is written until the year is opened.",
        "blockersLabel": "Blockers",
        "warningsLabel": "Warnings",
        "ready": "Ready to open the year.",
        "blocked": "This rollover cannot proceed.",
        "resolveFirst": "Resolve the blockers below, then refresh the preview.",
        "previewNotice": "This is a preview. No configuration has been written.",
        "createdLabel": "Will be created",
        "updatedLabel": "Will be updated",
        "skippedLabel": "Will be skipped",
        "rowsUnit": "{count} row(s)",
        "changedFields": "Changes: {fields}",
        "notRequested": "Not requested.",
        "classLabel": "Class",
        "reasonLabel": "Reason",
        "emptyCreated": "Nothing new to create.",
        "emptyUpdated": "Nothing to update.",
        "emptySkipped": "Nothing skipped.",
        "notCopiedTitle": "What this rollover does not carry",
        "notCopiedDescription": "Listed here so it is not discovered later.",
        "workingDayPolicyLabel": "Working-day policy",
        "workingDayPolicyCarried": "Carried from the source year: {days}.",
        "workingDayPolicyKept": "The target year keeps its own policy: {days}.",
        "workingDayPolicyUndeclared": "Neither year declares which weekdays are non-working.",
        "successOpened": "Opened '{targetLabel}' from '{sourceLabel}'.",
        "successRolledInto": "Rolled into '{targetLabel}' from '{sourceLabel}'.",
        "createdDetail": "{count} row(s) created",
        "updatedDetail": "{count} row(s) updated",
        "nothingCarried": "No configuration was carried.",
        "forbidden": "Opening the next academic year requires the academic rollover capability.",
        "selectSourceYear": "Select the year being rolled over.",
        "selectTargetYear": "Select the year the configuration is written into.",
        "fillTargetDetails": "Complete the session code, the label and both dates.",
    },
    "ur": {
        "title": "تعلیمی سال کا رول اوور",
        "description": "اگلا تعلیمی سال کھولیں اور وہ ترتیبات منتقل کریں جو کسی سال سے تعلق رکھتی ہیں۔",
        "sourceYearLabel": "ماخذ سال",
        "sourceYearHint": "وہ سال جس کا رول اوور کیا جا رہا ہے۔ اسی کے ترقی کے قواعد اور فیس کا ڈھانچہ منتقل ہوگا۔",
        "modeLabel": "ہدف",
        "modeCreate": "نیا سال کھولیں",
        "modeCreateHint": "اگلا تعلیمی سال بنائیں اور ترتیبات اس میں منتقل کریں۔",
        "modeExisting": "موجودہ سال میں منتقل کریں",
        "modeExistingHint": "ترتیبات ایسے سال میں منتقل کریں جو پہلے سے موجود ہے۔",
        "targetYearLabel": "ہدف سال",
        "targetYearHint": "وہ سال جس میں ترتیبات لکھی جائیں گی۔",
        "copyTitle": "منتقلی کے لیے ترتیبات",
        "copyDescription": "صرف وہ ترتیبات منتقل ہوتی ہیں جو کسی سال سے تعلق رکھتی ہیں اور کسی جماعت سے منسلک کی جا سکتی ہیں۔",
        "copyPromotionRules": "ترقی کے قواعد",
        "copyPromotionRulesHint": "ہر جماعت کے لیے ایک قاعدہ، جو سال کے اختتام پر فیصلہ کرتا ہے کہ کون ترقی پائے گا۔",
        "copyFeeStructures": "جماعت وار فیس کا ڈھانچہ",
        "copyFeeStructuresHint": "ہر جماعت کے لیے ماہانہ فیس کی تفصیل۔",
        "nothingSelected": "کچھ منتخب نہیں، اس لیے ہدف سال صرف وہی رکھے گا جو اس کے پاس پہلے سے موجود ہے۔",
        "preview": "جائزہ",
        "previewing": "جائزہ تیار ہو رہا ہے...",
        "apply": "سال کھولیں",
        "applying": "سال کھولا جا رہا ہے...",
        "recheck": "جائزہ دوبارہ حاصل کریں",
        "cancel": "منسوخ",
        "previewTitle": "جائزہ",
        "previewDescription": "سال کھولنے تک کچھ نہیں لکھا جائے گا۔",
        "blockersLabel": "رکاوٹیں",
        "warningsLabel": "انتباہات",
        "ready": "سال کھولنے کے لیے تیار ہے۔",
        "blocked": "یہ رول اوور آگے نہیں بڑھ سکتا۔",
        "resolveFirst": "نیچے دی گئی رکاوٹیں دور کریں، پھر جائزہ دوبارہ حاصل کریں۔",
        "previewNotice": "یہ صرف جائزہ ہے۔ کوئی ترتیب محفوظ نہیں کی گئی۔",
        "createdLabel": "نئے بنیں گے",
        "updatedLabel": "تبدیل ہوں گے",
        "skippedLabel": "چھوڑ دیے جائیں گے",
        "rowsUnit": "{count} قطاریں",
        "changedFields": "تبدیلیاں: {fields}",
        "notRequested": "درخواست نہیں کی گئی۔",
        "classLabel": "جماعت",
        "reasonLabel": "وجہ",
        "emptyCreated": "بنانے کے لیے کچھ نیا نہیں۔",
        "emptyUpdated": "تبدیل کرنے کے لیے کچھ نہیں۔",
        "emptySkipped": "کچھ چھوڑا نہیں گیا۔",
        "notCopiedTitle": "یہ رول اوور کیا منتقل نہیں کرتا",
        "notCopiedDescription": "یہاں درج ہے تاکہ بعد میں پتہ لگانے کی ضرورت نہ پڑے۔",
        "workingDayPolicyLabel": "کام کے دنوں کی پالیسی",
        "workingDayPolicyCarried": "ماخذ سال سے منتقل: {days}۔",
        "workingDayPolicyKept": "ہدف سال اپنی پالیسی برقرار رکھے گا: {days}۔",
        "workingDayPolicyUndeclared": "کوئی بھی سال یہ واضح نہیں کرتا کہ کون سے دن غیر کاری ہیں۔",
        "successOpened": "'{targetLabel}' کو '{sourceLabel}' سے کھول دیا گیا۔",
        "successRolledInto": "'{targetLabel}' میں '{sourceLabel}' سے ترتیبات منتقل کر دی گئیں۔",
        "createdDetail": "{count} قطاریں بنائی گئیں",
        "updatedDetail": "{count} قطاریں تبدیل کی گئیں",
        "nothingCarried": "کوئی ترتیب منتقل نہیں کی گئی۔",
        "forbidden": "اگلا تعلیمی سال کھولنے کے لیے تعلیمی رول اوور کا اختیار درکار ہے۔",
        "selectSourceYear": "وہ سال منتخب کریں جس کا رول اوور کرنا ہے۔",
        "selectTargetYear": "وہ سال منتخب کریں جس میں ترتیبات منتقل کی جائیں گی۔",
        "fillTargetDetails": "سیشن کوڈ، نام اور دونوں تاریخیں مکمل کریں۔",
    },
    "hi": {
        "title": "शैक्षणिक वर्ष रोलओवर",
        "description": "अगला शैक्षणिक वर्ष खोलें और वह कॉन्फ़िगरेशन आगे ले जाएँ जो किसी वर्ष से संबंधित है।",
        "sourceYearLabel": "स्रोत वर्ष",
        "sourceYearHint": "जिस वर्ष का रोलओवर किया जा रहा है। उसी के पदोन्नति नियम और शुल्क संरचना आगे ले जाई जाएगी।",
        "modeLabel": "लक्ष्य",
        "modeCreate": "नया वर्ष खोलें",
        "modeCreateHint": "अगला शैक्षणिक वर्ष बनाएँ और कॉन्फ़िगरेशन उसमें लिखें।",
        "modeExisting": "मौजूदा वर्ष में ले जाएँ",
        "modeExistingHint": "कॉन्फ़िगरेशन उस वर्ष में लिखें जो पहले से मौजूद है।",
        "targetYearLabel": "लक्ष्य वर्ष",
        "targetYearHint": "जिस वर्ष में कॉन्फ़िगरेशन लिखा जाएगा।",
        "copyTitle": "आगे ले जाने योग्य कॉन्फ़िगरेशन",
        "copyDescription": "केवल वही कॉन्फ़िगरेशन आगे ले जाया जाता है जो किसी वर्ष से संबंधित हो और किसी कक्षा से मिलान किया जा सके।",
        "copyPromotionRules": "पदोन्नति नियम",
        "copyPromotionRulesHint": "प्रत्येक कक्षा के लिए एक नियम, जो वर्ष के अंत में तय करता है कि किसे पदोन्नति मिलेगी।",
        "copyFeeStructures": "कक्षा-वार शुल्क संरचना",
        "copyFeeStructuresHint": "प्रत्येक कक्षा के लिए मासिक शुल्क का विवरण।",
        "nothingSelected": "कुछ भी चयनित नहीं है, इसलिए लक्ष्य वर्ष केवल वही रखेगा जो उसके पास पहले से है।",
        "preview": "पूर्वावलोकन",
        "previewing": "पूर्वावलोकन बन रहा है...",
        "apply": "वर्ष खोलें",
        "applying": "वर्ष खोला जा रहा है...",
        "recheck": "पूर्वावलोकन ताज़ा करें",
        "cancel": "रद्द",
        "previewTitle": "पूर्वावलोकन",
        "previewDescription": "वर्ष खोले जाने तक कुछ नहीं लिखा जाएगा।",
        "blockersLabel": "बाधाएँ",
        "warningsLabel": "चेतावनियाँ",
        "ready": "वर्ष खोलने के लिए तैयार है।",
        "blocked": "यह रोलओवर आगे नहीं बढ़ सकता।",
        "resolveFirst": "नीचे दी गई बाधाएँ दूर करें, फिर पूर्वावलोकन ताज़ा करें।",
        "previewNotice": "यह केवल पूर्वावलोकन है। कोई कॉन्फ़िगरेशन नहीं लिखा गया।",
        "createdLabel": "बनाए जाएँगे",
        "updatedLabel": "अद्यतन होंगे",
        "skippedLabel": "छोड़े जाएँगे",
        "rowsUnit": "{count} पंक्तियाँ",
        "changedFields": "परिवर्तन: {fields}",
        "notRequested": "अनुरोध नहीं किया गया।",
        "classLabel": "कक्षा",
        "reasonLabel": "कारण",
        "emptyCreated": "बनाने के लिए कुछ नया नहीं है।",
        "emptyUpdated": "अद्यतन करने के लिए कुछ नहीं है।",
        "emptySkipped": "कुछ नहीं छोड़ा गया।",
        "notCopiedTitle": "यह रोलओवर क्या आगे नहीं ले जाता",
        "notCopiedDescription": "यहाँ सूचीबद्ध है ताकि बाद में पता लगाने की आवश्यकता न पड़े।",
        "workingDayPolicyLabel": "कार्य दिवस नीति",
        "workingDayPolicyCarried": "स्रोत वर्ष से ले जाया गया: {days}।",
        "workingDayPolicyKept": "लक्ष्य वर्ष अपनी नीति रखेगा: {days}।",
        "workingDayPolicyUndeclared": "कोई भी वर्ष यह स्पष्ट नहीं करता कि कौन से दिन अकार्य दिवस हैं।",
        "successOpened": "'{targetLabel}' को '{sourceLabel}' से खोल दिया गया।",
        "successRolledInto": "'{targetLabel}' में '{sourceLabel}' से कॉन्फ़िगरेशन ले जाया गया।",
        "createdDetail": "{count} पंक्तियाँ बनाई गईं",
        "updatedDetail": "{count} पंक्तियाँ अद्यतन की गईं",
        "nothingCarried": "कोई कॉन्फ़िगरेशन आगे नहीं ले जाया गया।",
        "forbidden": "अगला शैक्षणिक वर्ष खोलने के लिए शैक्षणिक रोलओवर क्षमता आवश्यक है।",
        "selectSourceYear": "जिस वर्ष का रोलओवर करना है उसे चुनें।",
        "selectTargetYear": "जिस वर्ष में कॉन्फ़िगरेशन लिखा जाएगा उसे चुनें।",
        "fillTargetDetails": "सत्र कोड, नाम और दोनों तिथियाँ पूरी करें।",
    },
    "bn": {
        "title": "শিক্ষাবর্ষ রোলওভার",
        "description": "পরবর্তী শিক্ষাবর্ষ খুলুন এবং বছরের সঙ্গে সম্পর্কিত কনফিগারেশন পরের বছরে নিয়ে যান।",
        "sourceYearLabel": "উৎস বছর",
        "sourceYearHint": "যে বছরটি রোলওভার করা হচ্ছে। এর পদোন্নতি নিয়ম ও ফি কাঠামোই পরের বছরে যাবে।",
        "modeLabel": "লক্ষ্য",
        "modeCreate": "নতুন বছর খুলুন",
        "modeCreateHint": "পরবর্তী শিক্ষাবর্ষ তৈরি করুন এবং কনফিগারেশন সেখানে লিখুন।",
        "modeExisting": "বিদ্যমান বছরে নিয়ে যান",
        "modeExistingHint": "কনফিগারেশন এমন বছরে লিখুন যা আগেই আছে।",
        "targetYearLabel": "লক্ষ্য বছর",
        "targetYearHint": "যে বছরে কনফিগারেশন লেখা হবে।",
        "copyTitle": "যে কনফিগারেশন নিয়ে যাওয়া হবে",
        "copyDescription": "কেবল সেই কনফিগারেশন নিয়ে যাওয়া হয় যা বছরের সঙ্গে সম্পর্কিত এবং শ্রেণির সঙ্গে মেলানো যায়।",
        "copyPromotionRules": "পদোন্নতি নিয়ম",
        "copyPromotionRulesHint": "প্রতিটি শ্রেণির জন্য একটি নিয়ম, যা বছরের শেষে ঠিক করে কে পদোন্নতি পাবে।",
        "copyFeeStructures": "শ্রেণিভিত্তিক ফি কাঠামো",
        "copyFeeStructuresHint": "প্রতিটি শ্রেণির মাসিক ফি-র বিবরণ।",
        "nothingSelected": "কিছু নির্বাচন করা হয়নি, তাই লক্ষ্য বছর কেবল যা আগে থেকেই আছে তা রাখবে।",
        "preview": "প্রিভিউ",
        "previewing": "প্রিভিউ তৈরি হচ্ছে...",
        "apply": "বছর খুলুন",
        "applying": "বছর খোলা হচ্ছে...",
        "recheck": "প্রিভিউ রিফ্রেশ করুন",
        "cancel": "বাতিল",
        "previewTitle": "প্রিভিউ",
        "previewDescription": "বছর খোলার আগে কিছুই লেখা হবে না।",
        "blockersLabel": "প্রতিবন্ধকতা",
        "warningsLabel": "সতর্কতা",
        "ready": "বছর খোলার জন্য প্রস্তুত।",
        "blocked": "এই রোলওভার এগোতে পারবে না।",
        "resolveFirst": "নিচের প্রতিবন্ধকতাগুলো দূর করুন, তারপর প্রিভিউ রিফ্রেশ করুন।",
        "previewNotice": "এটি কেবল প্রিভিউ। কোনো কনফিগারেশন লেখা হয়নি।",
        "createdLabel": "তৈরি হবে",
        "updatedLabel": "হালনাগাদ হবে",
        "skippedLabel": "বাদ যাবে",
        "rowsUnit": "{count} টি সারি",
        "changedFields": "পরিবর্তন: {fields}",
        "notRequested": "অনুরোধ করা হয়নি।",
        "classLabel": "শ্রেণি",
        "reasonLabel": "কারণ",
        "emptyCreated": "তৈরি করার মতো নতুন কিছু নেই।",
        "emptyUpdated": "হালনাগাদ করার কিছু নেই।",
        "emptySkipped": "কিছু বাদ যায়নি।",
        "notCopiedTitle": "এই রোলওভার যা নিয়ে যায় না",
        "notCopiedDescription": "এখানে তালিকাভুক্ত, যাতে পরে খুঁজে বের করতে না হয়।",
        "workingDayPolicyLabel": "কর্মদিবস নীতি",
        "workingDayPolicyCarried": "উৎস বছর থেকে নেওয়া: {days}।",
        "workingDayPolicyKept": "লক্ষ্য বছর নিজের নীতি রাখবে: {days}।",
        "workingDayPolicyUndeclared": "কোনো বছরই স্পষ্ট করেনি কোন দিনগুলো কর্মদিবস নয়।",
        "successOpened": "'{targetLabel}' কে '{sourceLabel}' থেকে খোলা হয়েছে।",
        "successRolledInto": "'{targetLabel}' এ '{sourceLabel}' থেকে কনফিগারেশন নিয়ে যাওয়া হয়েছে।",
        "createdDetail": "{count} টি সারি তৈরি হয়েছে",
        "updatedDetail": "{count} টি সারি হালনাগাদ হয়েছে",
        "nothingCarried": "কোনো কনফিগারেশন নিয়ে যাওয়া হয়নি।",
        "forbidden": "পরবর্তী শিক্ষাবর্ষ খুলতে শিক্ষা রোলওভারের অনুমতি প্রয়োজন।",
        "selectSourceYear": "যে বছরটি রোলওভার করতে হবে সেটি বেছে নিন।",
        "selectTargetYear": "যে বছরে কনফিগারেশন লেখা হবে সেটি বেছে নিন।",
        "fillTargetDetails": "সেশন কোড, নাম এবং দুটি তারিখ পূরণ করুন।",
    },
}

# ---------------------------------------------------------------------------
# `rollover.codes` — keyed by ROLLOVER_FINDING_CODES
# ---------------------------------------------------------------------------

CODES = {
    "en": {
        "TARGET_IS_SOURCE": "'{year}' cannot be rolled over into itself.",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "The target year must start after '{sourceLabel}' ({sourceStart}), but '{targetLabel}' starts {targetStart}.",
        "TARGET_YEAR_CLOSED": "'{targetLabel}' is closed and read-only, so nothing can be rolled into it.",
        "TARGET_DATES_INVALID": "'{targetLabel}' ends on {endDate}, before it starts on {startDate}.",
        "DUPLICATE_YEAR_ID": "The session code '{yearId}' is already in use.",
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES": "After this rollover '{targetLabel}' would hold no active promotion rule, so no class could be promoted in it.",
        "SOURCE_YEAR_STILL_OPEN": "'{sourceLabel}' is still open, so its records can still change after this rollover.",
        "TARGET_YEAR_HAS_STUDENTS": "'{targetLabel}' already holds {count} student(s). Configuration carried into it applies to records that already exist.",
        "NOTHING_REQUESTED": "No configuration is being carried, so '{targetLabel}' will keep only what it already has.",
        "WORKING_DAY_POLICY_UNDECLARED": "Neither '{sourceLabel}' nor '{targetLabel}' declares which weekdays are non-working, so no working-day count can be reported until one is set.",
        "TARGET_WORKING_DAY_POLICY_KEPT": "'{targetLabel}' keeps its own working-day policy ({targetPolicy}); '{sourceLabel}' declares ({sourcePolicy}). The source's policy was not applied.",
        "SOURCE_HAS_NO_FEE_STRUCTURES": "'{sourceLabel}' has no class fee structures, so there was nothing to carry.",
        "DANGLING_NEXT_CLASS": "{className}'s promotion rule names a next class that does not exist. The rule was carried as it stands.",
        "ORPHAN_RULE_CLASS": "'{sourceLabel}' holds a promotion rule for a class that no longer exists, so it was not carried.",
    },
    "ur": {
        "TARGET_IS_SOURCE": "'{year}' کا رول اوور اسی سال میں نہیں کیا جا سکتا۔",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "ہدف سال کا آغاز '{sourceLabel}' ({sourceStart}) کے بعد ہونا چاہیے، مگر '{targetLabel}' {targetStart} سے شروع ہوتا ہے۔",
        "TARGET_YEAR_CLOSED": "'{targetLabel}' بند اور صرف پڑھنے کے لیے ہے، اس لیے اس میں کچھ منتقل نہیں کیا جا سکتا۔",
        "TARGET_DATES_INVALID": "'{targetLabel}' {endDate} پر ختم ہوتا ہے، یعنی {startDate} سے شروع ہونے سے پہلے۔",
        "DUPLICATE_YEAR_ID": "سیشن کوڈ '{yearId}' پہلے ہی استعمال میں ہے۔",
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES": "اس رول اوور کے بعد '{targetLabel}' میں کوئی فعال ترقی کا قاعدہ نہیں ہوگا، اس لیے وہاں کسی جماعت کی ترقی نہیں ہو سکے گی۔",
        "SOURCE_YEAR_STILL_OPEN": "'{sourceLabel}' ابھی کھلا ہے، اس لیے اس کے ریکارڈ اس رول اوور کے بعد بھی بدل سکتے ہیں۔",
        "TARGET_YEAR_HAS_STUDENTS": "'{targetLabel}' میں پہلے ہی {count} طلبہ داخل ہیں۔ اس میں منتقل کی گئی ترتیبات ان ریکارڈز پر لاگو ہوں گی جو پہلے سے موجود ہیں۔",
        "NOTHING_REQUESTED": "کوئی ترتیب منتقل نہیں کی جا رہی، اس لیے '{targetLabel}' صرف وہی رکھے گا جو اس کے پاس پہلے سے ہے۔",
        "WORKING_DAY_POLICY_UNDECLARED": "نہ '{sourceLabel}' اور نہ '{targetLabel}' یہ واضح کرتا ہے کہ کون سے دن غیر کاری ہیں، اس لیے پالیسی مقرر ہونے تک کام کے دنوں کی گنتی نہیں دی جا سکتی۔",
        "TARGET_WORKING_DAY_POLICY_KEPT": "'{targetLabel}' اپنی کام کے دنوں کی پالیسی برقرار رکھے گا ({targetPolicy})؛ '{sourceLabel}' یہ بتاتا ہے ({sourcePolicy})۔ ماخذ کی پالیسی لاگو نہیں کی گئی۔",
        "SOURCE_HAS_NO_FEE_STRUCTURES": "'{sourceLabel}' میں جماعت وار فیس کا کوئی ڈھانچہ نہیں، اس لیے منتقل کرنے کے لیے کچھ نہ تھا۔",
        "DANGLING_NEXT_CLASS": "{className} کے ترقی کے قاعدے میں دی گئی اگلی جماعت موجود نہیں ہے۔ قاعدہ جیسا تھا ویسا ہی منتقل کر دیا گیا۔",
        "ORPHAN_RULE_CLASS": "'{sourceLabel}' میں ایسی جماعت کا ترقی کا قاعدہ موجود ہے جو اب نہیں رہی، اس لیے اسے منتقل نہیں کیا گیا۔",
    },
    "hi": {
        "TARGET_IS_SOURCE": "'{year}' का रोलओवर उसी वर्ष में नहीं किया जा सकता।",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "लक्ष्य वर्ष की शुरुआत '{sourceLabel}' ({sourceStart}) के बाद होनी चाहिए, पर '{targetLabel}' {targetStart} से शुरू होता है।",
        "TARGET_YEAR_CLOSED": "'{targetLabel}' बंद और केवल पढ़ने योग्य है, इसलिए उसमें कुछ नहीं ले जाया जा सकता।",
        "TARGET_DATES_INVALID": "'{targetLabel}' {endDate} पर समाप्त होता है, यानी {startDate} से शुरू होने से पहले।",
        "DUPLICATE_YEAR_ID": "सत्र कोड '{yearId}' पहले से उपयोग में है।",
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES": "इस रोलओवर के बाद '{targetLabel}' में कोई सक्रिय पदोन्नति नियम नहीं होगा, इसलिए वहाँ किसी कक्षा की पदोन्नति नहीं हो सकेगी।",
        "SOURCE_YEAR_STILL_OPEN": "'{sourceLabel}' अभी खुला है, इसलिए इस रोलओवर के बाद भी उसके रिकॉर्ड बदल सकते हैं।",
        "TARGET_YEAR_HAS_STUDENTS": "'{targetLabel}' में पहले से {count} छात्र नामांकित हैं। उसमें ले जाया गया कॉन्फ़िगरेशन उन रिकॉर्ड पर लागू होगा जो पहले से मौजूद हैं।",
        "NOTHING_REQUESTED": "कोई कॉन्फ़िगरेशन आगे नहीं ले जाया जा रहा, इसलिए '{targetLabel}' केवल वही रखेगा जो उसके पास पहले से है।",
        "WORKING_DAY_POLICY_UNDECLARED": "न '{sourceLabel}' और न '{targetLabel}' यह स्पष्ट करता है कि कौन से दिन अकार्य दिवस हैं, इसलिए नीति तय होने तक कार्य दिवसों की गणना नहीं दी जा सकती।",
        "TARGET_WORKING_DAY_POLICY_KEPT": "'{targetLabel}' अपनी कार्य दिवस नीति रखेगा ({targetPolicy}); '{sourceLabel}' यह बताता है ({sourcePolicy})। स्रोत की नीति लागू नहीं की गई।",
        "SOURCE_HAS_NO_FEE_STRUCTURES": "'{sourceLabel}' में कक्षा-वार शुल्क संरचना नहीं है, इसलिए आगे ले जाने के लिए कुछ नहीं था।",
        "DANGLING_NEXT_CLASS": "{className} के पदोन्नति नियम में बताई गई अगली कक्षा मौजूद नहीं है। नियम जैसा था वैसा ही ले जाया गया।",
        "ORPHAN_RULE_CLASS": "'{sourceLabel}' में ऐसी कक्षा का पदोन्नति नियम है जो अब मौजूद नहीं है, इसलिए वह आगे नहीं ले जाया गया।",
    },
    "bn": {
        "TARGET_IS_SOURCE": "'{year}' এর রোলওভার একই বছরে করা যায় না।",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "লক্ষ্য বছর শুরু হতে হবে '{sourceLabel}' ({sourceStart}) এর পরে, কিন্তু '{targetLabel}' শুরু হয় {targetStart} এ।",
        "TARGET_YEAR_CLOSED": "'{targetLabel}' বন্ধ এবং শুধুমাত্র পাঠযোগ্য, তাই সেখানে কিছু নিয়ে যাওয়া যায় না।",
        "TARGET_DATES_INVALID": "'{targetLabel}' {endDate} এ শেষ হয়, অর্থাৎ {startDate} এ শুরুর আগেই।",
        "DUPLICATE_YEAR_ID": "সেশন কোড '{yearId}' আগেই ব্যবহৃত হয়েছে।",
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES": "এই রোলওভারের পরে '{targetLabel}' এ কোনো সক্রিয় পদোন্নতি নিয়ম থাকবে না, তাই সেখানে কোনো শ্রেণির পদোন্নতি সম্ভব হবে না।",
        "SOURCE_YEAR_STILL_OPEN": "'{sourceLabel}' এখনও খোলা, তাই এই রোলওভারের পরেও এর রেকর্ড বদলাতে পারে।",
        "TARGET_YEAR_HAS_STUDENTS": "'{targetLabel}' এ ইতিমধ্যে {count} জন শিক্ষার্থী ভর্তি আছে। এতে নিয়ে যাওয়া কনফিগারেশন সেই রেকর্ডগুলোতে প্রযোজ্য হবে যা আগেই আছে।",
        "NOTHING_REQUESTED": "কোনো কনফিগারেশন নিয়ে যাওয়া হচ্ছে না, তাই '{targetLabel}' কেবল যা আগে থেকেই আছে তা রাখবে।",
        "WORKING_DAY_POLICY_UNDECLARED": "'{sourceLabel}' বা '{targetLabel}' কোনোটিই স্পষ্ট করেনি কোন দিনগুলো কর্মদিবস নয়, তাই নীতি নির্ধারিত না হওয়া পর্যন্ত কর্মদিবস গণনা দেওয়া যাবে না।",
        "TARGET_WORKING_DAY_POLICY_KEPT": "'{targetLabel}' নিজের কর্মদিবস নীতি রাখবে ({targetPolicy}); '{sourceLabel}' যা বলে তা হলো ({sourcePolicy})। উৎসের নীতি প্রয়োগ করা হয়নি।",
        "SOURCE_HAS_NO_FEE_STRUCTURES": "'{sourceLabel}' এ শ্রেণিভিত্তিক ফি কাঠামো নেই, তাই নিয়ে যাওয়ার কিছু ছিল না।",
        "DANGLING_NEXT_CLASS": "{className} এর পদোন্নতি নিয়মে উল্লিখিত পরবর্তী শ্রেণিটি আর নেই। নিয়মটি যেমন ছিল তেমনই নিয়ে যাওয়া হয়েছে।",
        "ORPHAN_RULE_CLASS": "'{sourceLabel}' এ এমন শ্রেণির পদোন্নতি নিয়ম আছে যা আর নেই, তাই সেটি নিয়ে যাওয়া হয়নি।",
    },
}

# ---------------------------------------------------------------------------
# `rollover.fixes` — what to do about each finding
# ---------------------------------------------------------------------------

FIXES = {
    "en": {
        "TARGET_IS_SOURCE": "Choose a different target year.",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "Choose a year that starts later than the source.",
        "TARGET_YEAR_CLOSED": "Choose a year that is still open.",
        "TARGET_DATES_INVALID": "Correct the target year's dates.",
        "DUPLICATE_YEAR_ID": "Choose a session code that is not already in use.",
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES": "Carry the source's promotion rules, or configure them in the target year first.",
        "SOURCE_YEAR_STILL_OPEN": "Close the source year first if its results are final.",
        "TARGET_YEAR_HAS_STUDENTS": "Confirm the target year is the one you meant.",
        "NOTHING_REQUESTED": "Select at least one kind of configuration to carry, or open the year as it is.",
        "WORKING_DAY_POLICY_UNDECLARED": "Declare the working-day policy for one of the two years.",
        "TARGET_WORKING_DAY_POLICY_KEPT": "Change the target year's policy if the source's should apply.",
        "SOURCE_HAS_NO_FEE_STRUCTURES": "Configure the source year's fee structures first, if they are missing.",
        "DANGLING_NEXT_CLASS": "Repoint the rule at a class that exists in the source year.",
        "ORPHAN_RULE_CLASS": "Delete the orphaned rule from the source year.",
    },
    "ur": {
        "TARGET_IS_SOURCE": "کوئی دوسرا ہدف سال منتخب کریں۔",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "ایسا سال منتخب کریں جو ماخذ کے بعد شروع ہو۔",
        "TARGET_YEAR_CLOSED": "ایسا سال منتخب کریں جو ابھی کھلا ہو۔",
        "TARGET_DATES_INVALID": "ہدف سال کی تاریخیں درست کریں۔",
        "DUPLICATE_YEAR_ID": "ایسا سیشن کوڈ منتخب کریں جو پہلے سے استعمال میں نہ ہو۔",
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES": "ماخذ کے ترقی کے قواعد منتقل کریں، یا پہلے ہدف سال میں وہ ترتیب دیں۔",
        "SOURCE_YEAR_STILL_OPEN": "اگر ماخذ سال کے نتائج حتمی ہیں تو پہلے اسے بند کریں۔",
        "TARGET_YEAR_HAS_STUDENTS": "تصدیق کریں کہ یہی ہدف سال آپ کا مطلوب تھا۔",
        "NOTHING_REQUESTED": "منتقلی کے لیے کم از کم ایک قسم کی ترتیب منتخب کریں، یا سال کو جیسا ہے ویسا کھولیں۔",
        "WORKING_DAY_POLICY_UNDECLARED": "دونوں میں سے کسی ایک سال کے لیے کام کے دنوں کی پالیسی واضح کریں۔",
        "TARGET_WORKING_DAY_POLICY_KEPT": "اگر ماخذ کی پالیسی لاگو ہونی چاہیے تو ہدف سال کی پالیسی تبدیل کریں۔",
        "SOURCE_HAS_NO_FEE_STRUCTURES": "اگر فیس کا ڈھانچہ غائب ہے تو پہلے ماخذ سال میں اسے ترتیب دیں۔",
        "DANGLING_NEXT_CLASS": "قاعدے کو ماخذ سال میں موجود جماعت کی طرف دوبارہ اشارہ کریں۔",
        "ORPHAN_RULE_CLASS": "بے بنیاد قاعدے کو ماخذ سال سے حذف کریں۔",
    },
    "hi": {
        "TARGET_IS_SOURCE": "कोई दूसरा लक्ष्य वर्ष चुनें।",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "ऐसा वर्ष चुनें जो स्रोत के बाद शुरू हो।",
        "TARGET_YEAR_CLOSED": "ऐसा वर्ष चुनें जो अभी खुला हो।",
        "TARGET_DATES_INVALID": "लक्ष्य वर्ष की तिथियाँ ठीक करें।",
        "DUPLICATE_YEAR_ID": "ऐसा सत्र कोड चुनें जो पहले से उपयोग में न हो।",
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES": "स्रोत के पदोन्नति नियम आगे ले जाएँ, या पहले लक्ष्य वर्ष में उन्हें कॉन्फ़िगर करें।",
        "SOURCE_YEAR_STILL_OPEN": "यदि स्रोत वर्ष के परिणाम अंतिम हैं तो पहले उसे बंद करें।",
        "TARGET_YEAR_HAS_STUDENTS": "पुष्टि करें कि यही लक्ष्य वर्ष आपका अभीष्ट था।",
        "NOTHING_REQUESTED": "आगे ले जाने के लिए कम से कम एक प्रकार का कॉन्फ़िगरेशन चुनें, या वर्ष को जैसा है वैसा खोलें।",
        "WORKING_DAY_POLICY_UNDECLARED": "दोनों में से किसी एक वर्ष के लिए कार्य दिवस नीति स्पष्ट करें।",
        "TARGET_WORKING_DAY_POLICY_KEPT": "यदि स्रोत की नीति लागू होनी चाहिए तो लक्ष्य वर्ष की नीति बदलें।",
        "SOURCE_HAS_NO_FEE_STRUCTURES": "यदि शुल्क संरचना अनुपस्थित है तो पहले स्रोत वर्ष में उसे कॉन्फ़िगर करें।",
        "DANGLING_NEXT_CLASS": "नियम को स्रोत वर्ष में मौजूद कक्षा की ओर दोबारा इंगित करें।",
        "ORPHAN_RULE_CLASS": "अनाथ नियम को स्रोत वर्ष से हटाएँ।",
    },
    "bn": {
        "TARGET_IS_SOURCE": "অন্য কোনো লক্ষ্য বছর বেছে নিন।",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "এমন বছর বেছে নিন যা উৎসের পরে শুরু হয়।",
        "TARGET_YEAR_CLOSED": "এমন বছর বেছে নিন যা এখনও খোলা।",
        "TARGET_DATES_INVALID": "লক্ষ্য বছরের তারিখগুলো ঠিক করুন।",
        "DUPLICATE_YEAR_ID": "এমন সেশন কোড বেছে নিন যা আগে ব্যবহৃত হয়নি।",
        "TARGET_WILL_HAVE_NO_PROMOTION_RULES": "উৎসের পদোন্নতি নিয়ম নিয়ে যান, বা আগে লক্ষ্য বছরে সেগুলো কনফিগার করুন।",
        "SOURCE_YEAR_STILL_OPEN": "উৎস বছরের ফলাফল চূড়ান্ত হলে আগে সেটি বন্ধ করুন।",
        "TARGET_YEAR_HAS_STUDENTS": "নিশ্চিত করুন যে এটিই আপনার কাঙ্ক্ষিত লক্ষ্য বছর।",
        "NOTHING_REQUESTED": "নিয়ে যাওয়ার জন্য অন্তত এক ধরনের কনফিগারেশন বেছে নিন, বা বছরটি যেমন আছে তেমনই খুলুন।",
        "WORKING_DAY_POLICY_UNDECLARED": "দুই বছরের যেকোনো একটির জন্য কর্মদিবস নীতি স্পষ্ট করুন।",
        "TARGET_WORKING_DAY_POLICY_KEPT": "উৎসের নীতি প্রয়োগ করতে হলে লক্ষ্য বছরের নীতি বদলান।",
        "SOURCE_HAS_NO_FEE_STRUCTURES": "ফি কাঠামো অনুপস্থিত থাকলে আগে উৎস বছরে সেটি কনফিগার করুন।",
        "DANGLING_NEXT_CLASS": "নিয়মটি উৎস বছরে বিদ্যমান কোনো শ্রেণির দিকে আবার নির্দেশ করুন।",
        "ORPHAN_RULE_CLASS": "অনাথ নিয়মটি উৎস বছর থেকে মুছে ফেলুন।",
    },
}

# ---------------------------------------------------------------------------
# `rollover.skipReasons` — keyed by ROLLOVER_SKIP_REASONS
# ---------------------------------------------------------------------------

SKIP_REASONS = {
    "en": {
        "CLASS_MISSING": "The class no longer exists in the class ladder.",
        "ALREADY_IDENTICAL": "The target year already holds an identical row.",
    },
    "ur": {
        "CLASS_MISSING": "یہ جماعت اب کلاسوں کی فہرست میں موجود نہیں۔",
        "ALREADY_IDENTICAL": "ہدف سال میں پہلے ہی ایسی ہی قطار موجود ہے۔",
    },
    "hi": {
        "CLASS_MISSING": "यह कक्षा अब कक्षा सूची में मौजूद नहीं है।",
        "ALREADY_IDENTICAL": "लक्ष्य वर्ष में पहले से ही ऐसी ही पंक्ति मौजूद है।",
    },
    "bn": {
        "CLASS_MISSING": "এই শ্রেণিটি এখন শ্রেণিতালিকায় নেই।",
        "ALREADY_IDENTICAL": "লক্ষ্য বছরে ইতিমধ্যে অনুরূপ সারি আছে।",
    },
}

# ---------------------------------------------------------------------------
# `rollover.notCopied` — keyed by NOT_COPIED_KEYS, one title and one reason each
# ---------------------------------------------------------------------------

NOT_COPIED = {
    "en": {
        "terms": {
            "title": "Terms and semesters",
            "reason": "There is no term or semester model. Nothing in the system copies terms because nothing stores them.",
        },
        "holidays": {
            "title": "Holidays",
            "reason": "A holiday's dates belong to the year they fall in. Copying last year's break would place it in the wrong month, so holidays are configured per year after it opens.",
        },
        "students": {
            "title": "Students and enrollments",
            "reason": "Students change year by being promoted, not by being copied. Copying enrollments would place every student in two years at once.",
        },
        "examSessions": {
            "title": "Exams and marks",
            "reason": "A new year has no exams, and last year's exam sessions and marks belong to the year that recorded them.",
        },
        "feeVouchers": {
            "title": "Fee vouchers, invoices and payments",
            "reason": "Vouchers, invoices and payments are financial records of the year that raised them. Carrying them forward would double-count revenue.",
        },
        "timetables": {
            "title": "Timetables",
            "reason": "The timetable has no unique key, so a copy cannot be repeated safely — a second run would duplicate the whole grid rather than update it. It is excluded until a match key exists.",
        },
        "attendance": {
            "title": "Attendance",
            "reason": "Attendance is a record of what happened, one row per student per day. A new year has no days that have happened yet.",
        },
        "certificates": {
            "title": "Certificates",
            "reason": "A certificate is an issued document with its own number. Issuing it again in the new year would create a second document for the same event.",
        },
        "feeBalancePolicy": {
            "title": "Unpaid fee balances",
            "reason": "Whether a student's unpaid balance is carried, partly carried or cleared is a money policy the school must decide, not one this system can infer.",
        },
    },
    "ur": {
        "terms": {
            "title": "ٹرم اور سمسٹر",
            "reason": "نظام میں ٹرم یا سمسٹر کا کوئی ماڈل موجود نہیں۔ ٹرم اس لیے منتقل نہیں ہوتے کہ وہ کہیں محفوظ ہی نہیں ہوتے۔",
        },
        "holidays": {
            "title": "تعطیلات",
            "reason": "تعطیل کی تاریخیں اسی سال سے تعلق رکھتی ہیں جس میں وہ آتی ہیں۔ پچھلے سال کی چھٹیاں منتقل کرنے سے وہ غلط مہینے میں چلی جائیں گی، اس لیے تعطیلات ہر سال کھلنے کے بعد ترتیب دی جاتی ہیں۔",
        },
        "students": {
            "title": "طلبہ اور داخلے",
            "reason": "طلبہ ترقی پا کر سال بدلتے ہیں، نقل ہو کر نہیں۔ داخلے نقل کرنے سے ہر طالب علم ایک ہی وقت میں دو سالوں میں شمار ہوگا۔",
        },
        "examSessions": {
            "title": "امتحانات اور نمبر",
            "reason": "نئے سال میں امتحانات نہیں ہوتے، اور پچھلے سال کے امتحانی سیشنز اور نمبر اسی سال سے تعلق رکھتے ہیں جس نے وہ درج کیے۔",
        },
        "feeVouchers": {
            "title": "فیس واؤچر، رسیدیں اور ادائیگیاں",
            "reason": "واؤچر، رسیدیں اور ادائیگیاں اسی سال کے مالی ریکارڈ ہیں جس میں وہ بنے۔ انہیں آگے منتقل کرنے سے آمدنی دوگنی گنی جائے گی۔",
        },
        "timetables": {
            "title": "ٹائم ٹیبل",
            "reason": "ٹائم ٹیبل کی کوئی منفرد کلید نہیں، اس لیے اس کی نقل محفوظ طریقے سے دہرائی نہیں جا سکتی — دوسری بار چلانے پر پورا ٹائم ٹیبل دہر جائے گا، تبدیل نہیں ہوگا۔ جب تک کلید موجود نہ ہو، یہ خارج ہے۔",
        },
        "attendance": {
            "title": "حاضری",
            "reason": "حاضری اس بات کا ریکارڈ ہے جو واقع ہوا — ہر طالب علم کے لیے ہر دن ایک قطار۔ نئے سال میں ابھی کوئی دن واقع نہیں ہوا۔",
        },
        "certificates": {
            "title": "سرٹیفکیٹ",
            "reason": "سرٹیفکیٹ ایک جاری شدہ دستاویز ہے جس کا اپنا نمبر ہوتا ہے۔ نئے سال میں دوبارہ جاری کرنے سے اسی واقعے کے لیے دوسری دستاویز بن جائے گی۔",
        },
        "feeBalancePolicy": {
            "title": "واجب الادا فیس کا بیلنس",
            "reason": "طالب علم کا غیر ادا شدہ بیلنس منتقل ہوگا، جزوی طور پر منتقل ہوگا یا ختم ہوگا — یہ مالی پالیسی کا فیصلہ ہے جو اسکول کو کرنا ہے، نظام اس کا اندازہ نہیں لگا سکتا۔",
        },
    },
    "hi": {
        "terms": {
            "title": "टर्म और सेमेस्टर",
            "reason": "सिस्टम में टर्म या सेमेस्टर का कोई मॉडल नहीं है। टर्म इसलिए आगे नहीं ले जाए जाते क्योंकि वे कहीं संग्रहित ही नहीं होते।",
        },
        "holidays": {
            "title": "अवकाश",
            "reason": "अवकाश की तिथियाँ उसी वर्ष से संबंधित हैं जिसमें वे पड़ती हैं। पिछले वर्ष का अवकाश आगे ले जाने से वह गलत महीने में चला जाएगा, इसलिए अवकाश हर वर्ष खुलने के बाद कॉन्फ़िगर किए जाते हैं।",
        },
        "students": {
            "title": "छात्र और नामांकन",
            "reason": "छात्र पदोन्नति पाकर वर्ष बदलते हैं, नकल से नहीं। नामांकन आगे ले जाने से प्रत्येक छात्र एक साथ दो वर्षों में गिना जाएगा।",
        },
        "examSessions": {
            "title": "परीक्षाएँ और अंक",
            "reason": "नए वर्ष में परीक्षाएँ नहीं होतीं, और पिछले वर्ष के परीक्षा सत्र और अंक उसी वर्ष से संबंधित हैं जिसने उन्हें दर्ज किया।",
        },
        "feeVouchers": {
            "title": "शुल्क वाउचर, बीजक और भुगतान",
            "reason": "वाउचर, बीजक और भुगतान उसी वर्ष के वित्तीय रिकॉर्ड हैं जिसमें वे बने। उन्हें आगे ले जाने से आय दोगुनी गिनी जाएगी।",
        },
        "timetables": {
            "title": "समय-सारणी",
            "reason": "समय-सारणी की कोई अद्वितीय कुंजी नहीं है, इसलिए इसकी प्रतिलिपि सुरक्षित रूप से दोहराई नहीं जा सकती — दूसरी बार चलाने पर पूरी सारणी दोहरा जाएगी, अद्यतन नहीं होगी। जब तक कुंजी न हो, यह बाहर रहेगी।",
        },
        "attendance": {
            "title": "उपस्थिति",
            "reason": "उपस्थिति इस बात का रिकॉर्ड है जो हुआ — प्रत्येक छात्र के लिए प्रत्येक दिन एक पंक्ति। नए वर्ष में अभी कोई दिन नहीं हुआ है।",
        },
        "certificates": {
            "title": "प्रमाणपत्र",
            "reason": "प्रमाणपत्र एक जारी दस्तावेज़ है जिसका अपना नंबर होता है। नए वर्ष में इसे दोबारा जारी करने से उसी घटना के लिए दूसरा दस्तावेज़ बन जाएगा।",
        },
        "feeBalancePolicy": {
            "title": "बकाया शुल्क",
            "reason": "छात्र का बकाया आगे ले जाया जाए, आंशिक रूप से ले जाया जाए या माफ़ किया जाए — यह धन नीति का निर्णय है जो विद्यालय को लेना है, सिस्टम इसका अनुमान नहीं लगा सकता।",
        },
    },
    "bn": {
        "terms": {
            "title": "টার্ম ও সেমিস্টার",
            "reason": "সিস্টেমে টার্ম বা সেমিস্টারের কোনো মডেল নেই। টার্ম নিয়ে যাওয়া হয় না কারণ সেগুলো কোথাও সংরক্ষিতই থাকে না।",
        },
        "holidays": {
            "title": "ছুটি",
            "reason": "ছুটির তারিখ সেই বছরের সঙ্গে সম্পর্কিত যেখানে সেগুলো পড়ে। গত বছরের ছুটি নিয়ে গেলে তা ভুল মাসে পড়বে, তাই ছুটি প্রতি বছর খোলার পরে কনফিগার করা হয়।",
        },
        "students": {
            "title": "শিক্ষার্থী ও ভর্তি",
            "reason": "শিক্ষার্থীরা পদোন্নতি পেয়ে বছর বদলায়, কপি হয়ে নয়। ভর্তি নিয়ে গেলে প্রত্যেক শিক্ষার্থী একইসঙ্গে দুটি বছরে গণ্য হবে।",
        },
        "examSessions": {
            "title": "পরীক্ষা ও নম্বর",
            "reason": "নতুন বছরে পরীক্ষা থাকে না, আর গত বছরের পরীক্ষা সেশন ও নম্বর সেই বছরেরই যা সেগুলো লিপিবদ্ধ করেছিল।",
        },
        "feeVouchers": {
            "title": "ফি ভাউচার, ইনভয়েস ও পরিশোধ",
            "reason": "ভাউচার, ইনভয়েস ও পরিশোধ সেই বছরের আর্থিক রেকর্ড যেখানে সেগুলো তৈরি হয়েছিল। এগুলো নিয়ে গেলে আয় দ্বিগুণ গণ্য হবে।",
        },
        "timetables": {
            "title": "রুটিন",
            "reason": "রুটিনের কোনো অনন্য কী নেই, তাই এর কপি নিরাপদে পুনরাবৃত্তি করা যায় না — দ্বিতীয়বার চালালে পুরো রুটিন পুনরাবৃত্তি হবে, হালনাগাদ হবে না। কী তৈরি না হওয়া পর্যন্ত এটি বাদ।",
        },
        "attendance": {
            "title": "উপস্থিতি",
            "reason": "উপস্থিতি হলো যা ঘটেছে তার রেকর্ড — প্রত্যেক শিক্ষার্থীর জন্য প্রতিদিন একটি সারি। নতুন বছরে এখনও কোনো দিন ঘটেনি।",
        },
        "certificates": {
            "title": "সার্টিফিকেট",
            "reason": "সার্টিফিকেট একটি ইস্যু করা দলিল যার নিজস্ব নম্বর থাকে। নতুন বছরে আবার ইস্যু করলে একই ঘটনার জন্য দ্বিতীয় দলিল তৈরি হবে।",
        },
        "feeBalancePolicy": {
            "title": "বকেয়া ফি",
            "reason": "শিক্ষার্থীর বকেয়া নিয়ে যাওয়া হবে, আংশিক নিয়ে যাওয়া হবে, নাকি মাফ করা হবে — এটি অর্থনীতির সিদ্ধান্ত যা বিদ্যালয়কে নিতে হবে, সিস্টেম তা অনুমান করতে পারে না।",
        },
    },
}

# ---------------------------------------------------------------------------
# `rollover.fields` — the diff names the fields that changed, and a list of
# column names is not a diff an operator can read. These are the union of the
# columns the two copyable tables carry.
# ---------------------------------------------------------------------------

FIELDS = {
    "en": {
        "minimumAttendance": "Minimum attendance",
        "minimumOverallPercentage": "Minimum overall",
        "minimumPerSubject": "Minimum per subject",
        "maxFailedSubjects": "Maximum failed subjects",
        "allowConditionalPromotion": "Conditional promotion",
        "autoPromote": "Auto promote",
        "nextClassId": "Next class",
        "isActive": "Active",
        "tuitionFee": "Tuition fee",
        "labFee": "Laboratory fee",
        "computerFee": "Computer fee",
        "examFee": "Examination fee",
        "sportsFee": "Sports fee",
        "libraryFee": "Library fee",
        "otherFee": "Other fee",
        "totalMonthlyFee": "Total monthly fee",
        "billingCycle": "Billing cycle",
        "notes": "Notes",
    },
    "ur": {
        "minimumAttendance": "کم از کم حاضری",
        "minimumOverallPercentage": "کم از کم مجموعی فیصد",
        "minimumPerSubject": "فی مضمون کم از کم",
        "maxFailedSubjects": "زیادہ سے زیادہ فیل مضامین",
        "allowConditionalPromotion": "مشروط ترقی",
        "autoPromote": "خودکار ترقی",
        "nextClassId": "اگلی جماعت",
        "isActive": "فعال",
        "tuitionFee": "ٹیوشن فیس",
        "labFee": "لیبارٹری فیس",
        "computerFee": "کمپیوٹر فیس",
        "examFee": "امتحانی فیس",
        "sportsFee": "کھیلوں کی فیس",
        "libraryFee": "لائبریری فیس",
        "otherFee": "دیگر فیس",
        "totalMonthlyFee": "کل ماہانہ فیس",
        "billingCycle": "بلنگ سائیکل",
        "notes": "نوٹس",
    },
    "hi": {
        "minimumAttendance": "न्यूनतम उपस्थिति",
        "minimumOverallPercentage": "न्यूनतम कुल प्रतिशत",
        "minimumPerSubject": "प्रति विषय न्यूनतम",
        "maxFailedSubjects": "अधिकतम अनुत्तीर्ण विषय",
        "allowConditionalPromotion": "सशर्त पदोन्नति",
        "autoPromote": "स्वतः पदोन्नति",
        "nextClassId": "अगली कक्षा",
        "isActive": "सक्रिय",
        "tuitionFee": "शिक्षण शुल्क",
        "labFee": "प्रयोगशाला शुल्क",
        "computerFee": "कंप्यूटर शुल्क",
        "examFee": "परीक्षा शुल्क",
        "sportsFee": "खेल शुल्क",
        "libraryFee": "पुस्तकालय शुल्क",
        "otherFee": "अन्य शुल्क",
        "totalMonthlyFee": "कुल मासिक शुल्क",
        "billingCycle": "बिलिंग चक्र",
        "notes": "टिप्पणियाँ",
    },
    "bn": {
        "minimumAttendance": "সর্বনিম্ন উপস্থিতি",
        "minimumOverallPercentage": "সর্বনিম্ন সামগ্রিক শতাংশ",
        "minimumPerSubject": "প্রতি বিষয়ে সর্বনিম্ন",
        "maxFailedSubjects": "সর্বোচ্চ অনুত্তীর্ণ বিষয়",
        "allowConditionalPromotion": "শর্তসাপেক্ষ পদোন্নতি",
        "autoPromote": "স্বয়ংক্রিয় পদোন্নতি",
        "nextClassId": "পরবর্তী শ্রেণি",
        "isActive": "সক্রিয়",
        "tuitionFee": "টিউশন ফি",
        "labFee": "ল্যাব ফি",
        "computerFee": "কম্পিউটার ফি",
        "examFee": "পরীক্ষার ফি",
        "sportsFee": "খেলাধুলার ফি",
        "libraryFee": "লাইব্রেরি ফি",
        "otherFee": "অন্যান্য ফি",
        "totalMonthlyFee": "মোট মাসিক ফি",
        "billingCycle": "বিলিং চক্র",
        "notes": "মন্তব্য",
    },
}

PLACEHOLDER = re.compile(r"\{([a-zA-Z0-9_]+)\}")
STRAIGHT_QUOTED_PLACEHOLDER = re.compile(r"'\{|\}'")


def format_safe(value):
    """Make a message safe for ICU MessageFormat.

    In ICU a single quote starts an escaped literal, so `'{year}'` does **not**
    interpolate — it renders the four characters `{year}` on screen. Every
    message here was written with straight quotes around its placeholders for
    readability, which silently broke all of them; the plan panel showed
    `{sourceLabel}` to an operator instead of the year.

    Curly quotes are not ICU metacharacters, so they render around the
    substituted value and keep the readability the straight quotes were there
    for. The replacement is applied centrally rather than by rewriting the
    tables, so a message added later cannot reintroduce the bug.
    """
    return value.replace("'{", "\u201c{").replace("}'", "}\u201d")


def load(lang):
    path = f"src/messages/{lang}.json"
    with open(path, "rb") as handle:
        raw = handle.read()
    return path, raw, json.loads(raw.decode("utf-8"), object_pairs_hook=collections.OrderedDict)


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2).replace("\n", "\r\n").encode("utf-8")


def apply_keys(target, additions, path, report):
    for key, value in additions.items():
        value = format_safe(value)
        if key not in target:
            target[key] = value
            report.append(f"  added    {path}.{key}")
        elif target[key] != value:
            target[key] = value
            report.append(f"  updated  {path}.{key}")
        else:
            report.append(f"  kept     {path}.{key}")


def check_order(lang_values, en_values, lang, label, problems):
    for key, en_value in en_values.items():
        expected = PLACEHOLDER.findall(en_value)
        actual = PLACEHOLDER.findall(lang_values.get(key, ""))
        if expected != actual:
            problems.append(
                f"[{lang}] {label}.{key}: en {expected} vs {actual} — the parity test "
                f"compares placeholders in order, so the translation must keep it."
            )


def main():
    report: list[str] = []
    problems: list[str] = []

    for lang in LOCALES:
        path, raw, obj = load(lang)

        if dump(obj) != raw:
            problems.append(f"{path}: round-trip is not byte-identical; refusing to write.")
            continue

        # Placeholder order, checked before the write rather than after a test run.
        check_order(CODES[lang], CODES["en"], lang, "codes", problems)
        check_order(FIXES[lang], FIXES["en"], lang, "fixes", problems)
        check_order(ROLLOVER[lang], ROLLOVER["en"], lang, "rollover", problems)

        # A straight-quoted placeholder survives `format_safe` only if it was
        # written in a shape the replacement does not recognise, and it would
        # then escape the placeholder at render time. Refuse to write.
        for label, table in (
            ("codes", CODES[lang]),
            ("fixes", FIXES[lang]),
            ("rollover", ROLLOVER[lang]),
        ):
            for key, value in table.items():
                if STRAIGHT_QUOTED_PLACEHOLDER.search(format_safe(value)):
                    problems.append(
                        f"[{lang}] {label}.{key} still quotes a placeholder with a "
                        f"straight quote, which ICU reads as an escape: {value!r}"
                    )

        namespace = obj.setdefault("rollover", collections.OrderedDict())
        apply_keys(namespace, ROLLOVER[lang], "rollover", report)

        codes = namespace.setdefault("codes", collections.OrderedDict())
        fixes = namespace.setdefault("fixes", collections.OrderedDict())
        skips = namespace.setdefault("skipReasons", collections.OrderedDict())
        fields = namespace.setdefault("fields", collections.OrderedDict())
        not_copied = namespace.setdefault("notCopied", collections.OrderedDict())

        apply_keys(codes, CODES[lang], "rollover.codes", report)
        apply_keys(fixes, FIXES[lang], "rollover.fixes", report)
        apply_keys(skips, SKIP_REASONS[lang], "rollover.skipReasons", report)
        apply_keys(fields, FIELDS[lang], "rollover.fields", report)

        for key, entry in NOT_COPIED[lang].items():
            bucket = not_copied.setdefault(key, collections.OrderedDict())
            apply_keys(bucket, entry, f"rollover.notCopied.{key}", report)

        with open(path, "wb") as handle:
            handle.write(dump(obj))

    for line in report:
        print(line)
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 1
    print(f"\nOK: {len(LOCALES)} locales updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
