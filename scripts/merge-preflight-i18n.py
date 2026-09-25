#!/usr/bin/env python3
r"""Author the `promotions.preflight.codes` / `.fixes` namespaces and `weekdays`.

## Why this exists

`RolloverPreflightPanel` renders every finding through
`t(`codes.${finding.code}`, finding.params)` — a call site whose key is a
runtime value. The repository-wide literal-key scanner in
`i18n-parity-and-interpolation.test.ts` is structurally unable to see it, so the
namespace could be (and was) entirely absent while nothing complained. use-intl
does not throw on a missing message: it returns the raw key path, which the
panel then swallows into its `catch` and replaces with the server's English
`message`. The result is a P0 gate that speaks English in Urdu, Hindi and
Bengali — and a `fixes` lookup that renders as a blank line under every finding.

`promotions.reasons` has a guard for exactly this (`promotion-reason-i18n.test.ts`).
The preflight vocabulary did not. It does now.

## Why `weekdays` is top-level and shared

Two surfaces report non-working weekdays to an operator: the working-day
declaration endpoint (§18) and the rollover wizard. Both get their names from
`WEEKDAY_NAMES` in `working-days.ts`, which is English and indexed by weekday
number. Translating the list twice would let the two surfaces name the same day
differently, so the vocabulary lives in one namespace both read.

## Format

Locale JSON is 2-space indent, CRLF, no BOM, no trailing newline. The writer
reproduces that byte for byte; a round-trip of an unmodified file is asserted
before anything is written, so a serializer drift cannot silently rewrite
40 000 lines of translations.

Re-running is a no-op: an existing key is left exactly as it is.
"""

import collections
import json
import re
import sys

LOCALES = ["en", "ur", "hi", "bn"]

# ---------------------------------------------------------------------------
# `promotions.preflight.codes` — the operator-facing sentence per finding code.
#
# Params are the module's own, taken from each `finding(...)` call site in
# `rollover-preflight.ts`. A code whose two call sites disagree about a param
# cannot interpolate it (the value would be missing at one of them), which is
# why `DUPLICATE_ENROLLMENT` carries `count` at both — see the module.
# ---------------------------------------------------------------------------

CODES = {
    "en": {
        "SAME_ACADEMIC_YEAR": "'{targetYear}' is the same year as '{sourceYear}'. A promotion must cross a year boundary.",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "'{targetYear}' starts on {targetStartDate}, which is not after '{sourceYear}' ({sourceStartDate}).",
        "YEAR_ALREADY_CLOSED": "'{year}' is closed and read-only.",
        "NO_PROMOTION_RULE": "No active promotion rule is configured for '{className}', so eligibility cannot be evaluated.",
        "NEXT_CLASS_NOT_FOUND": "The promotion rule for '{className}' points at a next class that no longer exists.",
        "CLASS_WITHOUT_NEXT_CLASS": "'{className}' has no next class configured, but '{higherClassName}' exists above it. Every student in '{className}' would be marked as graduated.",
        "EMPTY_COHORT": "No active students are enrolled in '{className}' for '{year}'.",
        "STUDENT_WITHOUT_SESSION": "{studentName} has no enrollment record for '{year}'; their placement is taken from the student profile.",
        "STUDENT_WITHOUT_RESULTS": "{studentName} has no examination results for this year, so their outcome rests on absent data.",
        "MISSING_ROLL_NUMBER": "{studentName} has no roll number. A rollover would carry the blank into the next year.",
        "MISSING_DEMOGRAPHICS": "{studentName} is missing {fields}.",
        "DUPLICATE_ENROLLMENT": "{studentName} already has {count} enrollment record(s) in '{year}'.",
        "DUPLICATE_ROLL_NUMBER": "Roll number '{rollNumber}' is held by {count} students in '{className}'.",
        "UNPROMOTED_STUDENT": "{studentName} is still enrolled in '{year}' with no promotion record.",
        "UNISSUED_EXIT_DOCUMENT": "{studentName} left as {action} without a {expectedDocuments} certificate.",
        "ATTENDANCE_BELOW_REQUIREMENT": "{studentName} attended {actual}% of '{year}', below the {required}% required.",
    },
    "ur": {
        "SAME_ACADEMIC_YEAR": "'{targetYear}' اور '{sourceYear}' ایک ہی سال ہیں۔ ترقی کا عمل سال کی حد عبور کرنا ضروری ہے۔",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "'{targetYear}' {targetStartDate} سے شروع ہوتا ہے، جو '{sourceYear}' ({sourceStartDate}) کے بعد نہیں ہے۔",
        "YEAR_ALREADY_CLOSED": "'{year}' بند اور صرف پڑھنے کے لیے ہے۔",
        "NO_PROMOTION_RULE": "'{className}' کے لیے کوئی فعال ترقی کا قاعدہ ترتیب نہیں دیا گیا، اس لیے اہلیت کا جائزہ نہیں لیا جا سکتا۔",
        "NEXT_CLASS_NOT_FOUND": "'{className}' کے ترقی کے قاعدے میں دی گئی اگلی جماعت موجود نہیں ہے۔",
        "CLASS_WITHOUT_NEXT_CLASS": "'{className}' کے لیے اگلی جماعت مقرر نہیں، حالانکہ '{higherClassName}' اس سے اوپر موجود ہے۔ '{className}' کے تمام طلبہ کو فارغ قرار دیا جائے گا۔",
        "EMPTY_COHORT": "'{className}' کے کوئی فعال طلبہ '{year}' میں داخل نہیں ہیں۔",
        "STUDENT_WITHOUT_SESSION": "{studentName} کا '{year}' کے لیے کوئی داخلہ ریکارڈ نہیں؛ ان کی جماعت طالب علم پروفائل سے لی گئی ہے۔",
        "STUDENT_WITHOUT_RESULTS": "{studentName} کے اس سال کے امتحانی نتائج موجود نہیں، اس لیے ان کا فیصلہ غیر موجود ڈیٹا پر مبنی ہے۔",
        "MISSING_ROLL_NUMBER": "{studentName} کا رول نمبر موجود نہیں۔ رول اوور اس خلا کو اگلے سال میں منتقل کر دے گا۔",
        "MISSING_DEMOGRAPHICS": "{studentName} کے ریکارڈ میں {fields} موجود نہیں۔",
        "DUPLICATE_ENROLLMENT": "{studentName} کے پاس پہلے ہی {count} داخلہ ریکارڈ '{year}' میں موجود ہیں۔",
        "DUPLICATE_ROLL_NUMBER": "رول نمبر '{rollNumber}' {count} طلبہ کے پاس '{className}' میں ہے۔",
        "UNPROMOTED_STUDENT": "{studentName} ابھی بھی '{year}' میں داخل ہیں اور ان کا کوئی ترقی کا ریکارڈ نہیں۔",
        "UNISSUED_EXIT_DOCUMENT": "{studentName} {action} کے طور پر رخصت ہوئے مگر {expectedDocuments} سرٹیفکیٹ جاری نہیں ہوا۔",
        "ATTENDANCE_BELOW_REQUIREMENT": "{studentName} کی حاضری {actual}% رہی '{year}' میں، جو مطلوبہ {required}% سے کم ہے۔",
    },
    "hi": {
        "SAME_ACADEMIC_YEAR": "'{targetYear}' और '{sourceYear}' एक ही वर्ष हैं। पदोन्नति के लिए वर्ष की सीमा पार करना आवश्यक है।",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "'{targetYear}' {targetStartDate} से शुरू होता है, जो '{sourceYear}' ({sourceStartDate}) के बाद नहीं है।",
        "YEAR_ALREADY_CLOSED": "'{year}' बंद और केवल पढ़ने योग्य है।",
        "NO_PROMOTION_RULE": "'{className}' के लिए कोई सक्रिय पदोन्नति नियम कॉन्फ़िगर नहीं है, इसलिए पात्रता का मूल्यांकन नहीं हो सकता।",
        "NEXT_CLASS_NOT_FOUND": "'{className}' के पदोन्नति नियम में बताई गई अगली कक्षा मौजूद नहीं है।",
        "CLASS_WITHOUT_NEXT_CLASS": "'{className}' के लिए अगली कक्षा कॉन्फ़िगर नहीं है, जबकि '{higherClassName}' उससे ऊपर मौजूद है। '{className}' के सभी छात्र उत्तीर्ण चिह्नित हो जाएंगे।",
        "EMPTY_COHORT": "'{className}' के कोई सक्रिय छात्र '{year}' में नामांकित नहीं हैं।",
        "STUDENT_WITHOUT_SESSION": "{studentName} का '{year}' के लिए कोई नामांकन रिकॉर्ड नहीं है; उनकी कक्षा छात्र प्रोफ़ाइल से ली गई है।",
        "STUDENT_WITHOUT_RESULTS": "{studentName} के इस वर्ष के परीक्षा परिणाम नहीं हैं, इसलिए उनका निर्णय अनुपलब्ध डेटा पर आधारित है।",
        "MISSING_ROLL_NUMBER": "{studentName} का रोल नंबर नहीं है। रोलओवर इस रिक्तता को अगले वर्ष में ले जाएगा।",
        "MISSING_DEMOGRAPHICS": "{studentName} के रिकॉर्ड में {fields} नहीं है।",
        "DUPLICATE_ENROLLMENT": "{studentName} का पहले से {count} नामांकन रिकॉर्ड '{year}' में है।",
        "DUPLICATE_ROLL_NUMBER": "रोल नंबर '{rollNumber}' {count} छात्रों के पास '{className}' में है।",
        "UNPROMOTED_STUDENT": "{studentName} अभी भी '{year}' में नामांकित हैं और उनका कोई पदोन्नति रिकॉर्ड नहीं है।",
        "UNISSUED_EXIT_DOCUMENT": "{studentName} {action} के रूप में गए, पर {expectedDocuments} प्रमाणपत्र जारी नहीं हुआ।",
        "ATTENDANCE_BELOW_REQUIREMENT": "{studentName} की उपस्थिति {actual}% रही '{year}' में, जो आवश्यक {required}% से कम है।",
    },
    "bn": {
        "SAME_ACADEMIC_YEAR": "'{targetYear}' এবং '{sourceYear}' একই বছর। পদোন্নতির জন্য বছরের সীমা অতিক্রম করা আবশ্যক।",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "'{targetYear}' {targetStartDate} তারিখে শুরু হয়, যা '{sourceYear}' ({sourceStartDate}) এর পরে নয়।",
        "YEAR_ALREADY_CLOSED": "'{year}' বন্ধ এবং শুধুমাত্র পাঠযোগ্য।",
        "NO_PROMOTION_RULE": "'{className}' এর জন্য কোনো সক্রিয় পদোন্নতি নিয়ম কনফিগার করা নেই, তাই যোগ্যতা যাচাই করা যাবে না।",
        "NEXT_CLASS_NOT_FOUND": "'{className}' এর পদোন্নতি নিয়মে উল্লিখিত পরবর্তী শ্রেণিটি আর নেই।",
        "CLASS_WITHOUT_NEXT_CLASS": "'{className}' এর জন্য পরবর্তী শ্রেণি কনফিগার করা নেই, অথচ '{higherClassName}' তার উপরে রয়েছে। '{className}' এর সব শিক্ষার্থীকে উত্তীর্ণ চিহ্নিত করা হবে।",
        "EMPTY_COHORT": "'{className}' এর কোনো সক্রিয় শিক্ষার্থী '{year}' এ ভর্তি নেই।",
        "STUDENT_WITHOUT_SESSION": "{studentName} এর '{year}' এর জন্য কোনো ভর্তি রেকর্ড নেই; তাদের শ্রেণি শিক্ষার্থী প্রোফাইল থেকে নেওয়া হয়েছে।",
        "STUDENT_WITHOUT_RESULTS": "{studentName} এর এই বছরের পরীক্ষার ফলাফল নেই, তাই তাদের সিদ্ধান্ত অনুপস্থিত তথ্যের উপর নির্ভর করছে।",
        "MISSING_ROLL_NUMBER": "{studentName} এর রোল নম্বর নেই। রোলওভার এই শূন্যস্থান পরের বছরে বহন করবে।",
        "MISSING_DEMOGRAPHICS": "{studentName} এর রেকর্ডে {fields} নেই।",
        "DUPLICATE_ENROLLMENT": "{studentName} এর ইতিমধ্যে {count} টি ভর্তি রেকর্ড '{year}' এ আছে।",
        "DUPLICATE_ROLL_NUMBER": "রোল নম্বর '{rollNumber}' {count} জন শিক্ষার্থীর কাছে '{className}' এ আছে।",
        "UNPROMOTED_STUDENT": "{studentName} এখনও '{year}' এ ভর্তি এবং তাদের কোনো পদোন্নতির রেকর্ড নেই।",
        "UNISSUED_EXIT_DOCUMENT": "{studentName} {action} হিসেবে চলে গেছেন কিন্তু {expectedDocuments} সার্টিফিকেট ইস্যু হয়নি।",
        "ATTENDANCE_BELOW_REQUIREMENT": "{studentName} এর উপস্থিতি {actual}% ছিল '{year}' এ, যা প্রয়োজনীয় {required}% এর কম।",
    },
}

# ---------------------------------------------------------------------------
# `promotions.preflight.fixes` — what to do about it. Short, imperative, and
# separate from the finding so the panel can render the diagnosis and the
# remedy as two lines without the message doing both jobs badly.
# ---------------------------------------------------------------------------

FIXES = {
    "en": {
        "SAME_ACADEMIC_YEAR": "Choose the year that follows this one.",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "Choose a year whose start date is later.",
        "YEAR_ALREADY_CLOSED": "Reopen the year, or choose a year that is still open.",
        "NO_PROMOTION_RULE": "Configure a promotion rule for this class.",
        "NEXT_CLASS_NOT_FOUND": "Repoint the rule at a class that exists.",
        "CLASS_WITHOUT_NEXT_CLASS": "Set the next class, or confirm this is the final class.",
        "EMPTY_COHORT": "Check that the class has active students in this year.",
        "STUDENT_WITHOUT_SESSION": "Enroll the student in this year, or confirm their profile placement.",
        "STUDENT_WITHOUT_RESULTS": "Record the examination results, or decide the outcome manually.",
        "MISSING_ROLL_NUMBER": "Assign a roll number before the year is rolled over.",
        "MISSING_DEMOGRAPHICS": "Complete the student's profile.",
        "DUPLICATE_ENROLLMENT": "Resolve the duplicate enrollment before promoting again.",
        "DUPLICATE_ROLL_NUMBER": "Give each student in the class a distinct roll number.",
        "UNPROMOTED_STUDENT": "Run the year-end promotion before closing.",
        "UNISSUED_EXIT_DOCUMENT": "Issue the certificate, or accept that it is printed after the close.",
        "ATTENDANCE_BELOW_REQUIREMENT": "Review the register before the year is frozen.",
    },
    "ur": {
        "SAME_ACADEMIC_YEAR": "وہ سال منتخب کریں جو اس کے بعد آتا ہے۔",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "ایسا سال منتخب کریں جس کی شروعات کی تاریخ بعد کی ہو۔",
        "YEAR_ALREADY_CLOSED": "سال دوبارہ کھولیں، یا کوئی کھلا ہوا سال منتخب کریں۔",
        "NO_PROMOTION_RULE": "اس جماعت کے لیے ترقی کا قاعدہ ترتیب دیں۔",
        "NEXT_CLASS_NOT_FOUND": "قاعدے کو موجود جماعت کی طرف دوبارہ اشارہ کریں۔",
        "CLASS_WITHOUT_NEXT_CLASS": "اگلی جماعت مقرر کریں، یا تصدیق کریں کہ یہ آخری جماعت ہے۔",
        "EMPTY_COHORT": "جانچیں کہ اس سال میں جماعت کے فعال طلبہ موجود ہیں۔",
        "STUDENT_WITHOUT_SESSION": "طالب علم کو اس سال میں داخل کریں، یا ان کی پروفائل جماعت کی تصدیق کریں۔",
        "STUDENT_WITHOUT_RESULTS": "امتحانی نتائج درج کریں، یا فیصلہ خود کریں۔",
        "MISSING_ROLL_NUMBER": "رول اوور سے پہلے رول نمبر تفویض کریں۔",
        "MISSING_DEMOGRAPHICS": "طالب علم کا پروفائل مکمل کریں۔",
        "DUPLICATE_ENROLLMENT": "دوبارہ ترقی دینے سے پہلے دوہرے داخلے کو حل کریں۔",
        "DUPLICATE_ROLL_NUMBER": "جماعت کے ہر طالب علم کو الگ رول نمبر دیں۔",
        "UNPROMOTED_STUDENT": "بند کرنے سے پہلے سال کے اختتام کی ترقی چلائیں۔",
        "UNISSUED_EXIT_DOCUMENT": "سرٹیفکیٹ جاری کریں، یا یہ قبول کریں کہ یہ بندش کے بعد پرنٹ ہوگا۔",
        "ATTENDANCE_BELOW_REQUIREMENT": "سال منجمد ہونے سے پہلے حاضری رجسٹر کا جائزہ لیں۔",
    },
    "hi": {
        "SAME_ACADEMIC_YEAR": "वह वर्ष चुनें जो इसके बाद आता है।",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "ऐसा वर्ष चुनें जिसकी प्रारंभ तिथि बाद की हो।",
        "YEAR_ALREADY_CLOSED": "वर्ष दोबारा खोलें, या कोई खुला वर्ष चुनें।",
        "NO_PROMOTION_RULE": "इस कक्षा के लिए पदोन्नति नियम कॉन्फ़िगर करें।",
        "NEXT_CLASS_NOT_FOUND": "नियम को किसी मौजूद कक्षा की ओर दोबारा इंगित करें।",
        "CLASS_WITHOUT_NEXT_CLASS": "अगली कक्षा निर्धारित करें, या पुष्टि करें कि यह अंतिम कक्षा है।",
        "EMPTY_COHORT": "जाँचें कि इस वर्ष में कक्षा के सक्रिय छात्र मौजूद हैं।",
        "STUDENT_WITHOUT_SESSION": "छात्र को इस वर्ष में नामांकित करें, या उनकी प्रोफ़ाइल कक्षा की पुष्टि करें।",
        "STUDENT_WITHOUT_RESULTS": "परीक्षा परिणाम दर्ज करें, या निर्णय स्वयं लें।",
        "MISSING_ROLL_NUMBER": "रोलओवर से पहले रोल नंबर दें।",
        "MISSING_DEMOGRAPHICS": "छात्र की प्रोफ़ाइल पूरी करें।",
        "DUPLICATE_ENROLLMENT": "दोबारा पदोन्नति से पहले दोहरे नामांकन को हल करें।",
        "DUPLICATE_ROLL_NUMBER": "कक्षा के प्रत्येक छात्र को अलग रोल नंबर दें।",
        "UNPROMOTED_STUDENT": "बंद करने से पहले वर्ष-अंत पदोन्नति चलाएँ।",
        "UNISSUED_EXIT_DOCUMENT": "प्रमाणपत्र जारी करें, या स्वीकारें कि यह बंद होने के बाद छपेगा।",
        "ATTENDANCE_BELOW_REQUIREMENT": "वर्ष फ़्रीज़ होने से पहले उपस्थिति रजिस्टर की समीक्षा करें।",
    },
    "bn": {
        "SAME_ACADEMIC_YEAR": "যে বছরটি এর পরে আসে সেটি বেছে নিন।",
        "TARGET_YEAR_NOT_AFTER_SOURCE": "এমন বছর বেছে নিন যার শুরুর তারিখ পরে।",
        "YEAR_ALREADY_CLOSED": "বছরটি আবার খুলুন, বা খোলা থাকা কোনো বছর বেছে নিন।",
        "NO_PROMOTION_RULE": "এই শ্রেণির জন্য পদোন্নতি নিয়ম কনফিগার করুন।",
        "NEXT_CLASS_NOT_FOUND": "নিয়মটি বিদ্যমান কোনো শ্রেণির দিকে আবার নির্দেশ করুন।",
        "CLASS_WITHOUT_NEXT_CLASS": "পরবর্তী শ্রেণি নির্ধারণ করুন, বা নিশ্চিত করুন এটি শেষ শ্রেণি।",
        "EMPTY_COHORT": "এই বছরে শ্রেণিটির সক্রিয় শিক্ষার্থী আছে কিনা যাচাই করুন।",
        "STUDENT_WITHOUT_SESSION": "শিক্ষার্থীকে এই বছরে ভর্তি করুন, বা তাদের প্রোফাইল শ্রেণি নিশ্চিত করুন।",
        "STUDENT_WITHOUT_RESULTS": "পরীক্ষার ফলাফল লিখুন, বা নিজে সিদ্ধান্ত নিন।",
        "MISSING_ROLL_NUMBER": "রোলওভারের আগে রোল নম্বর দিন।",
        "MISSING_DEMOGRAPHICS": "শিক্ষার্থীর প্রোফাইল সম্পূর্ণ করুন।",
        "DUPLICATE_ENROLLMENT": "আবার পদোন্নতির আগে দ্বৈত ভর্তি সমাধান করুন।",
        "DUPLICATE_ROLL_NUMBER": "শ্রেণির প্রত্যেক শিক্ষার্থীকে আলাদা রোল নম্বর দিন।",
        "UNPROMOTED_STUDENT": "বন্ধ করার আগে বছর-শেষ পদোন্নতি চালান।",
        "UNISSUED_EXIT_DOCUMENT": "সার্টিফিকেট ইস্যু করুন, বা মেনে নিন এটি বন্ধের পরে ছাপা হবে।",
        "ATTENDANCE_BELOW_REQUIREMENT": "বছর ফ্রিজ হওয়ার আগে উপস্থিতি রেজিস্টার পর্যালোচনা করুন।",
    },
}

# ---------------------------------------------------------------------------
# `weekdays` — indexed by weekday number, so `sunday` is 0. The order here is
# the contract; `working-days.ts` numbers days the same way.
# ---------------------------------------------------------------------------

WEEKDAYS = {
    "en": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "ur": ["اتوار", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ"],
    "hi": ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"],
    "bn": ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
}
WEEKDAY_KEYS = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
]


def load(lang):
    path = f"src/messages/{lang}.json"
    with open(path, "rb") as handle:
        raw = handle.read()
    text = raw.decode("utf-8")
    obj = json.loads(text, object_pairs_hook=collections.OrderedDict)
    return path, raw, obj


def dump(obj):
    """The exact serialisation the locale files use: 2-space, CRLF, no BOM, no
    trailing newline. Asserted against an unmodified file before writing."""
    return json.dumps(obj, ensure_ascii=False, indent=2).replace("\n", "\r\n").encode("utf-8")


def format_safe(value):
    """Make a message safe for ICU MessageFormat.

    In ICU a single quote starts an escaped literal, so `'{year}'` does **not**
    interpolate — it renders the four characters `{year}` on screen. Every
    message here was written with straight quotes around its placeholders for
    readability, which silently broke all of them.

    Curly quotes are not ICU metacharacters, so they render around the
    substituted value and keep the readability the straight quotes were there
    for. Applied centrally rather than by rewriting the tables, so a message
    added later cannot reintroduce the bug.
    """
    return value.replace("'{", "\u201c{").replace("}'", "}\u201d")


def apply_keys(target, additions, path, report):
    """Set each key. These namespaces are authored here, so re-running this
    script is how a correction is applied — keeping a stale value because it
    already existed would make the file un-fixable by the script that made it."""
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


PLACEHOLDER = re.compile(r"\{([a-zA-Z0-9_]+)\}")
STRAIGHT_QUOTED_PLACEHOLDER = re.compile(r"'\{|\}'")


def check_placeholder_order(namespace, en_values, lang_values, lang, label, problems):
    """Every locale must interpolate the same variables in the same order.

    `i18n-parity-and-interpolation.test.ts` compares the extracted lists with
    `join(",")`, so a translation that reads naturally in a different word order
    is a test failure. Catching it here means the failure cannot be committed —
    which matters, because reordering a placeholder is the single most likely
    thing to happen when translating a sentence into a verb-final language.
    """
    for key, en_value in en_values.items():
        expected = PLACEHOLDER.findall(en_value)
        actual = PLACEHOLDER.findall(lang_values.get(key, ""))
        if expected != actual:
            problems.append(
                f"[{lang}] {label}.{key}: en {expected} vs {actual} — reorder the "
                f"placeholders in the translation, or the sentence will not read."
            )


def main():
    report = []
    problems = []

    for lang in LOCALES:
        path, raw, obj = load(lang)

        # A serializer that cannot reproduce the file byte for byte must not be
        # allowed to rewrite it: it would silently reformat 40 000 lines of
        # translations that nobody asked to touch.
        if dump(obj) != raw:
            problems.append(f"{path}: round-trip is not byte-identical; refusing to write.")
            continue

        check_placeholder_order(
            "promotions.preflight", CODES["en"], CODES[lang], lang, "codes", problems
        )
        check_placeholder_order(
            "promotions.preflight", FIXES["en"], FIXES[lang], lang, "fixes", problems
        )

        # A straight-quoted placeholder survives `format_safe` only if it was
        # written in a shape the replacement does not recognise, and it would
        # then escape the placeholder at render time. Refuse to write.
        for label, table in (("codes", CODES[lang]), ("fixes", FIXES[lang])):
            for key, value in table.items():
                if STRAIGHT_QUOTED_PLACEHOLDER.search(format_safe(value)):
                    problems.append(
                        f"[{lang}] {label}.{key} still quotes a placeholder with a "
                        f"straight quote, which ICU reads as an escape: {value!r}"
                    )

        preflight = obj["promotions"]["preflight"]
        # `setdefault` rather than `apply_keys`: a container is created only when
        # it is absent. Setting it unconditionally would wipe the namespace it is
        # about to be filled with.
        preflight.setdefault("codes", collections.OrderedDict())
        preflight.setdefault("fixes", collections.OrderedDict())
        apply_keys(preflight["codes"], CODES[lang], "promotions.preflight.codes", report)
        apply_keys(preflight["fixes"], FIXES[lang], "promotions.preflight.fixes", report)

        if "weekdays" not in obj:
            obj["weekdays"] = collections.OrderedDict()
            report.append("  added    weekdays")
        apply_keys(
            obj["weekdays"],
            collections.OrderedDict(zip(WEEKDAY_KEYS, WEEKDAYS[lang])),
            "weekdays",
            report,
        )

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
