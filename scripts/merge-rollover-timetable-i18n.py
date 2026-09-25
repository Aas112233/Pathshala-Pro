#!/usr/bin/env python3
"""Author the timetable-copy additions to the `rollover.*` namespace.

Adds the three finding codes (and their fixes) the timetable toggle introduces,
the ten timetable column labels, and removes the `notCopied.timetables` entry:
the timetable is copied now, so leaving its exclusion in the published list would
have the wizard claim it does something it does.

Same discipline as `merge-rollover-i18n.py`:

* the round-trip must be byte-identical before anything is written, so a
  serializer change cannot silently reformat 6,000 lines of translations;
* placeholder order is checked against `en` before the write, because the parity
  test compares variable lists in order and verb-final languages reorder them;
* a message that still quotes a placeholder with a straight quote is refused. In
  ICU `'{year}'` is an escape, not interpolation, and it renders the four
  characters `{year}` on screen;
* keys are force-corrected rather than left as first written, so re-running this
  script repairs a bad value instead of preserving it.
"""

import collections
import json
import re
import sys

LOCALES = ["en", "ur", "hi", "bn"]

PLACEHOLDER = re.compile(r"\{([a-zA-Z0-9_]+)\}")
STRAIGHT_QUOTED_PLACEHOLDER = re.compile(r"'\{|\}'")

# New finding codes, by locale.
CODES = {
    "en": {
        "SOURCE_HAS_NO_TIMETABLES": (
            "'{sourceLabel}' has no timetable slots, so there was nothing to carry."
        ),
        "TIMETABLE_ARRIVES_NEEDING_REVIEW": (
            "{count} timetable slot(s) copied into '{targetLabel}' are flagged for "
            "review. A copied grid is a starting point, not an allocation the school made."
        ),
        "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS": (
            "'{sourceLabel}' holds {count} timetable slot(s) sharing a class, section, "
            "day and period with another slot. The copy carried one of them rather than both."
        ),
    },
    "ur": {
        "SOURCE_HAS_NO_TIMETABLES": (
            "'{sourceLabel}' میں کوئی ٹائم ٹیبل سلٹ موجود نہیں، اس لیے کچھ منتقل نہیں ہوا۔"
        ),
        "TIMETABLE_ARRIVES_NEEDING_REVIEW": (
            "{count} ٹائم ٹیبل سلٹ جو '{targetLabel}' میں نقل ہوئی ہیں انہیں نظرثانی کے "
            "لیے نشان زد کیا گیا ہے۔ نقل شدہ گرڈ ایک تجویز ہے، اسکول کی بنائی ہوئی ترتیب نہیں۔"
        ),
        "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS": (
            "'{sourceLabel}' میں {count} ٹائم ٹیبل سلٹ ایسے ہیں جو کلاس، سیکشن، دن اور "
            "پیریڈ کے لحاظ سے دوسری سلٹ سے ملتی ہیں۔ نقل میں ان میں سے ایک شامل کی گئی، دونوں نہیں۔"
        ),
    },
    "hi": {
        "SOURCE_HAS_NO_TIMETABLES": (
            "'{sourceLabel}' में कोई टाइमटेबल स्लॉट नहीं है, इसलिए कुछ भी आगे नहीं बढ़ाया गया।"
        ),
        "TIMETABLE_ARRIVES_NEEDING_REVIEW": (
            "{count} टाइमटेबल स्लॉट '{targetLabel}' में कॉपी किए गए हैं और समीक्षा के लिए "
            "चिह्नित हैं। कॉपी किया गया ग्रिड एक प्रस्ताव है, विद्यालय की बनाई व्यवस्था नहीं।"
        ),
        "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS": (
            "'{sourceLabel}' में {count} टाइमटेबल स्लॉट ऐसे हैं जो कक्षा, सेक्शन, दिन और "
            "पीरियड के लिहाज़ से दूसरे स्लॉट से मेल खाते हैं। कॉपी में इनमें से एक रखा गया, दोनों नहीं।"
        ),
    },
    "bn": {
        "SOURCE_HAS_NO_TIMETABLES": (
            "'{sourceLabel}'-এ কোনো টাইমটেবল স্লট নেই, তাই কিছুই সামনে নেওয়া হয়নি।"
        ),
        "TIMETABLE_ARRIVES_NEEDING_REVIEW": (
            "{count}টি টাইমটেবল স্লট '{targetLabel}'-এ অনুলিপি করা হয়েছে এবং পর্যালোচনার "
            "জন্য চিহ্নিত করা হয়েছে। অনুলিপি করা গ্রিড একটি প্রস্তাব, প্রতিষ্ঠানের তৈরি বিন্যাস নয়।"
        ),
        "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS": (
            "'{sourceLabel}'-এ {count}টি টাইমটেবল স্লট রয়েছে যা শ্রেণি, সেকশন, দিন ও "
            "পিরিয়ড অনুযায়ী অন্য স্লটের সঙ্গে মিলে যায়। অনুলিপিতে এর মধ্যে একটিকে রাখা হয়েছে, দুটিকে নয়।"
        ),
    },
}


CODES["en"]["FEE_BALANCE_WRITTEN_OFF"] = (
    "'{targetLabel}' will not inherit balances from '{sourceLabel}'. {count} student(s) "
    "owe a total of {total}, and that amount will not be carried forward as a balance."
)
CODES["ur"]["FEE_BALANCE_WRITTEN_OFF"] = (
    "'{targetLabel}'، '{sourceLabel}' کے بیلنس کو ورثہ نہیں بنائے گا۔ {count} طلبہ کا "
    "کل {total} بقایا ہے، اور یہ رقم آگے نہیں بڑھائی جائے گی۔"
)
CODES["hi"]["FEE_BALANCE_WRITTEN_OFF"] = (
    "'{targetLabel}'، '{sourceLabel}' के बकाया को आगे नहीं ले जाएगा। {count} विद्यार्थियों का "
    "कुल {total} बकाया है, और वह राशि आगे नहीं बढ़ाई जाएगी।"
)
CODES["bn"]["FEE_BALANCE_WRITTEN_OFF"] = (
    "'{targetLabel}' '{sourceLabel}'-এর বাকিকে উত্তরাধিকার করবে না। {count} জন শিক্ষার্থীর "
    "মোট {total} বাকি আছে, এবং সেই টাকা আগে নেওয়া হবে না।"
)
CODES["en"]["TARGET_FEE_BALANCE_POLICY_KEPT"] = (
    "'{targetLabel}' already states a fee-balance policy of {targetPolicy}, so the policy "
    "chosen here ({requestedPolicy}) was recorded on this run but not applied."
)
CODES["ur"]["TARGET_FEE_BALANCE_POLICY_KEPT"] = (
    "'{targetLabel}' پہلے سے ہی فیس بیلنس پالیسی {targetPolicy} بتاتا ہے، اس لیے یہاں "
    "چنی گئی پالیسی ({requestedPolicy}) اس ریکارڈ پر محفوظ ہوئی، لاگو نہیں ہوئی۔"
)
CODES["hi"]["TARGET_FEE_BALANCE_POLICY_KEPT"] = (
    "'{targetLabel}' पहले से ही फ़ीस बैलेंस नीति {targetPolicy} बताता है, इसलिए यहाँ चुनी "
    "गई नीति ({requestedPolicy}) इस रन पर दर्ज हुई, लागू नहीं हुई।"
)
CODES["bn"]["TARGET_FEE_BALANCE_POLICY_KEPT"] = (
    "'{targetLabel}' ইতিমধ্যে ফি-ব্যালেন্স নীতি {targetPolicy} জানায়, তাই এখানে নির্বাচিত "
    "নীতি ({requestedPolicy}) এই রানে রেকর্ড হয়েছে, প্রয়োগ হয়নি।"
)


FIXES = {
    "en": {
        "SOURCE_HAS_NO_TIMETABLES": (
            "Nothing to do. Build the timetable for '{targetLabel}' once the year is open."
        ),
        "TIMETABLE_ARRIVES_NEEDING_REVIEW": (
            "Open the timetable for '{targetLabel}' and confirm the {count} flagged "
            "slot(s): the staff, the rooms and the periods."
        ),
        "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS": (
            "Remove the duplicated slots from '{sourceLabel}' so the copy is unambiguous."
        ),
    },
    "ur": {
        "SOURCE_HAS_NO_TIMETABLES": (
            "کچھ نہیں کرنا۔ '{targetLabel}' کھلنے کے بعد اس کا ٹائم ٹیبل بنائیں۔"
        ),
        "TIMETABLE_ARRIVES_NEEDING_REVIEW": (
            "'{targetLabel}' کا ٹائم ٹیبل کھولیں اور {count} نشان زد سلٹ کی تصدیق کریں: "
            "اساتذہ، کمرے اور پیریڈ۔"
        ),
        "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS": (
            "'{sourceLabel}' سے ملتی جلتی سلٹیں ہٹا دیں تاکہ نقل واضح ہو۔"
        ),
    },
    "hi": {
        "SOURCE_HAS_NO_TIMETABLES": (
            "कुछ करने की आवश्यकता नहीं। '{targetLabel}' खुलने के बाद उसका टाइमटेबल बनाएँ।"
        ),
        "TIMETABLE_ARRIVES_NEEDING_REVIEW": (
            "'{targetLabel}' का टाइमटेबल खोलें और {count} चिह्नित स्लॉट की पुष्टि करें: "
            "शिक्षक, कक्ष और पीरियड।"
        ),
        "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS": (
            "'{sourceLabel}' से समान स्लॉट हटा दें ताकि कॉपी अस्पष्ट न रहे।"
        ),
    },
    "bn": {
        "SOURCE_HAS_NO_TIMETABLES": (
            "কিছু করার নেই। '{targetLabel}' খোলার পরে তার টাইমটেবল তৈরি করুন।"
        ),
        "TIMETABLE_ARRIVES_NEEDING_REVIEW": (
            "'{targetLabel}'-এর টাইমটেবল খুলুন এবং {count}টি চিহ্নিত স্লট নিশ্চিত করুন: "
            "শিক্ষক, কক্ষ ও পিরিয়ড।"
        ),
        "SOURCE_HAS_DUPLICATE_TIMETABLE_SLOTS": (
            "'{sourceLabel}' থেকে একই রকম স্লট সরিয়ে ফেলুন যাতে অনুলিপি অস্পষ্ট না থাকে।"
        ),
    },
}
FIXES["en"]["TARGET_FEE_BALANCE_POLICY_KEPT"] = (
    "Nothing to do. '{targetLabel}' keeps its own policy; this run's choice is on the rollover record."
)
FIXES["ur"]["FEE_BALANCE_WRITTEN_OFF"] = (
    "بقایا لکھنے کی تصدیق کریں، یا رول اوور سے پہلے کوئی نقل کا آپشن منتخب کریں۔"
)
FIXES["hi"]["FEE_BALANCE_WRITTEN_OFF"] = (
    "बकाया माफ़ी की पुष्टि करें, या रोलओवर से पहले कोई कैरी विकल्प चुनें।"
)
FIXES["bn"]["FEE_BALANCE_WRITTEN_OFF"] = (
    "অবশিষ্ট মকুবের নিশ্চিতকরণ করুন, অথবা রোলওভারের আগে একটি বহন বিকল্প বেছে নিন।"
)
FIXES["ur"]["TARGET_FEE_BALANCE_POLICY_KEPT"] = (
    "کچھ نہیں کرنا۔ '{targetLabel}' اپنی پالیسی رکھتا ہے؛ اس رن کا انتخاب رول اوور ریکارڈ پر ہے۔"
)
FIXES["hi"]["TARGET_FEE_BALANCE_POLICY_KEPT"] = (
    "कुछ करने की आवश्यकता नहीं। '{targetLabel}' अपनी नीति रखता है; इस रन का विकल्प रोलओवर रिकॉर्ड पर है।"
)
FIXES["bn"]["TARGET_FEE_BALANCE_POLICY_KEPT"] = (
    "কিছু করার নেই। '{targetLabel}' নিজের নীতি রাখে; এই রানের পছন্দ রোলওভার রেকর্ডে আছে।"
)
FIXES["en"]["FEE_BALANCE_WRITTEN_OFF"] = (
    "Confirm the write-off, or choose a carry option instead before running the rollover."
)


# The toggle's label and hint, for the wizard and the panel's bucket heading.
CHROME = {
    "en": {
        "copyTimetables": "Timetable grid",
        "copyTimetablesHint": (
            "The weekly slot grid per class. Copied slots are flagged for review, "
            "because last year's staff, rooms and periods are a starting point, not this year's allocation."
        ),
    },
    "ur": {
        "copyTimetables": "ٹائم ٹیبل گرڈ",
        "copyTimetablesHint": (
            "ہر کلاس کا ہفتہ وار سلٹ گرڈ۔ نقل شدہ سلٹ نظرثانی کے لیے نشان زد ہوتے ہیں، "
            "کیونکہ پچھلے سال کے اساتذہ، کمرے اور پیریڈ نقطہ آغاز ہیں، اس سال کی ترتیب نہیں۔"
        ),
    },
    "hi": {
        "copyTimetables": "टाइमटेबल ग्रिड",
        "copyTimetablesHint": (
            "प्रति कक्षा साप्ताहिक स्लॉट ग्रिड। कॉपी किए गए स्लॉट समीक्षा के लिए चिह्नित होते हैं, "
            "क्योंकि पिछले साल के शिक्षक, कक्ष और पीरियड एक आधार हैं, इस साल की व्यवस्था नहीं।"
        ),
    },
    "bn": {
        "copyTimetables": "টাইমটেবল গ্রিড",
        "copyTimetablesHint": (
            "প্রতি শ্রেণিতে সাপ্তাহিক স্লট গ্রিড। অনুলিপি করা স্লট পর্যালোচনার জন্য চিহ্নিত থাকে, "
            "কারণ গত বছরের শিক্ষক, কক্ষ ও পিরিয়ড একটি সূচনা বিন্দু, এই বছরের বিন্যাস নয়।"
        ),
    },
}


CHROME["en"].update({
    "feeBalanceLabel": "Fee balances left over",
    "feeBalanceHint": (
        "What happens to unpaid balances from the year being left behind. The figure "
        "outstanding is shown in the plan before you run it."
    ),
    "feeBalancePlaceholder": "Choose what happens to the balances...",
    "feeBalance": {
        "CARRY_BALANCE": "Carry the balance forward",
        "CARRY_UNPAID": "Carry unpaid dues only",
        "ZERO": "Carry nothing (write the balance off)",
    },
})
CHROME["ur"].update({
    "feeBalanceLabel": "باقی مانده فیس بیلنس",
    "feeBalanceHint": (
        "جس سال کو چھوڑا جا رہا ہے اس کے غیر اداء شدہ بیلنس کا کیا ہوگا۔ بقایا کی رقم "
        "رن سے پہلے منصوبے میں دکھائی جاتی ہے۔"
    ),
    "feeBalancePlaceholder": "بیلنس کا انجام منتخب کریں...",
    "feeBalance": {
        "CARRY_BALANCE": "بیلنس آگے بڑھائیں",
        "CARRY_UNPAID": "صرف غیر اداء شدہ dues آگے بڑھائیں",
        "ZERO": "کچھ بھی آگے نہ بڑھائیں (بقایا لکھ دیں)",
    },
})
CHROME["hi"].update({
    "feeBalanceLabel": "शेष फ़ीस बकाया",
    "feeBalanceHint": (
        "जिस वर्ष को छोड़ा जा रहा है उसके अवैतनिक बकाये का क्या होगा। बकाया राशि रन से "
        "पहले योजना में दिखाई जाती है।"
    ),
    "feeBalancePlaceholder": "बकाये का निर्णय चुनें...",
    "feeBalance": {
        "CARRY_BALANCE": "बकाया आगे ले जाएँ",
        "CARRY_UNPAID": "केवल अवैतनिक बकाया आगे ले जाएँ",
        "ZERO": "कुछ भी आगे न ले जाएँ (बकाया माफ़ करें)",
    },
})
CHROME["bn"].update({
    "feeBalanceLabel": "অবশিষ্ট ফি-ব্যালেন্স",
    "feeBalanceHint": (
        "যে বছর ছেড়ে যাওয়া হচ্ছে তার অপরিশোধিত বাকির কী হবে। বাকির পরিমাণ রানের আগে "
        "পরিকল্পনায় দেখানো হয়।"
    ),
    "feeBalancePlaceholder": "বাকির ভাগ্য বেছে নিন...",
    "feeBalance": {
        "CARRY_BALANCE": "ব্যালেন্স আগে নিয়ে যান",
        "CARRY_UNPAID": "শুধু অপরিশোধিত বাকি আগে নিয়ে যান",
        "ZERO": "কিছুই আগে নিয়ে যাবেন না (বাকি মকুব করুন)",
    },
})

CHROME["en"]["feeBalanceOutstanding"] = "{count} student(s) owe a total of {total}"
CHROME["ur"]["feeBalanceOutstanding"] = "{count} طلبہ کا کل {total} بقایا ہے"
CHROME["hi"]["feeBalanceOutstanding"] = "{count} विद्यार्थियों का कुल {total} बकाया है"
CHROME["bn"]["feeBalanceOutstanding"] = "{count} জন শিক্ষার্থীর মোট {total} বাকি আছে"

# Column labels for the timetable's own fields.
FIELDS = {
    "en": {
        "sectionId": "Section",
        "dayOfWeek": "Day",
        "periodNumber": "Period",
        "startTime": "Starts",
        "endTime": "Ends",
        "subjectId": "Subject",
        "staffProfileId": "Teacher",
        "roomNumber": "Room",
        "isBreak": "Break",
        "breakLabel": "Break label",
    },
    "ur": {
        "sectionId": "سیکشن",
        "dayOfWeek": "دن",
        "periodNumber": "پیریڈ",
        "startTime": "آغاز",
        "endTime": "اختتام",
        "subjectId": "مضمن",
        "staffProfileId": "استاد",
        "roomNumber": "کمرہ",
        "isBreak": "وقفہ",
        "breakLabel": "وقفے کا عنوان",
    },
    "hi": {
        "sectionId": "सेक्शन",
        "dayOfWeek": "दिन",
        "periodNumber": "पीरियड",
        "startTime": "प्रारंभ",
        "endTime": "समाप्ति",
        "subjectId": "विषय",
        "staffProfileId": "शिक्षक",
        "roomNumber": "कक्ष",
        "isBreak": "विराम",
        "breakLabel": "विराम लेबल",
    },
    "bn": {
        "sectionId": "সেকশন",
        "dayOfWeek": "দিন",
        "periodNumber": "পিরিয়ড",
        "startTime": "শুরু",
        "endTime": "শেষ",
        "subjectId": "বিষয়",
        "staffProfileId": "শিক্ষক",
        "roomNumber": "রুম",
        "isBreak": "বিরতি",
        "breakLabel": "বিরতির লেবেল",
    },
}


def format_safe(value):
    """Make a message safe for ICU MessageFormat.

    In ICU a single quote starts an escaped literal, so `'{year}'` does **not**
    interpolate — it renders the four characters `{year}` on screen. Curly
    quotes are not metacharacters, so they render around the substituted value.
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
        # A nested table (the policy option labels) recurses rather than being
        # stringified, so the shape in the locale file mirrors the shape the
        # component reads.
        if isinstance(value, dict):
            apply_keys(target.setdefault(key, collections.OrderedDict()), value,
                       f"{path}.{key}", report)
            continue
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

        check_order(CODES[lang], CODES["en"], lang, "codes", problems)
        check_order(FIXES[lang], FIXES["en"], lang, "fixes", problems)

        for label, table in (("codes", CODES[lang]), ("fixes", FIXES[lang])):
            for key, value in table.items():
                if STRAIGHT_QUOTED_PLACEHOLDER.search(format_safe(value)):
                    problems.append(
                        f"[{lang}] {label}.{key} still quotes a placeholder with a "
                        f"straight quote, which ICU reads as an escape: {value!r}"
                    )

        namespace = obj.setdefault("rollover", collections.OrderedDict())

        apply_keys(namespace.setdefault("codes", collections.OrderedDict()),
                   CODES[lang], "rollover.codes", report)
        apply_keys(namespace.setdefault("fixes", collections.OrderedDict()),
                   FIXES[lang], "rollover.fixes", report)
        apply_keys(namespace.setdefault("fields", collections.OrderedDict()),
                   FIELDS[lang], "rollover.fields", report)
        apply_keys(namespace, CHROME[lang], "rollover", report)

        # The timetable is copied now. An exclusion that says otherwise is a
        # claim the wizard would contradict in the same sentence.
        removed = namespace.get("notCopied", {}).pop("timetables", None)
        if removed is not None:
            report.append(f"  removed  rollover.notCopied.timetables ({lang})")

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
