import ExcelJS from "exceljs";

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("docs/test-datasets/Pathshala_Pro_Test_Dataset_2026-2028.xlsx");

function rows(name) {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Missing sheet: ${name}`);
  const headers = ws.getRow(1).values.slice(1);
  const out = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row.getCell(i + 1).value;
    });
    out.push(obj);
  });
  return out;
}

const problems = [];
const vouchers = rows("Fee_Vouchers");
const sessions = rows("Student_Sessions");
const attendance = rows("Attendance");
const students = rows("Students");
const rules = rows("Promotion_Rules");
const exams = rows("Exams");
const results = rows("Exam_Results");

// 1. voucher arithmetic holds
let bad = 0;
for (const v of vouchers) {
  const expected = Number(v.totalDue) - Number(v.amountPaid);
  if (Math.abs(expected - Number(v.balance)) > 0.01) bad++;
}
if (bad) problems.push(`${bad} vouchers where balance != totalDue - amountPaid`);

// 2. status agrees with the balance
bad = 0;
for (const v of vouchers) {
  const b = Number(v.balance);
  const ok =
    (b === 0 && v.status === "PAID") ||
    (b > 0 && (v.status === "PARTIAL" || v.status === "OVERDUE"));
  if (!ok) bad++;
}
if (bad) problems.push(`${bad} vouchers where status disagrees with the balance`);

// 3. attendance never lands on a declared non-working day (Fri=5, Sat=6)
bad = attendance.filter((a) => [5, 6].includes(new Date(a.date).getDay())).length;
if (bad) problems.push(`${bad} attendance rows on Friday or Saturday`);

// 4. attendance statuses are from the app's own vocabulary
const allowed = new Set(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED", "HOLIDAY", "LEAVE"]);
bad = attendance.filter((a) => !allowed.has(a.status)).length;
if (bad) problems.push(`${bad} attendance rows with an unknown status`);

// 5. a year-2 session sits in the next class up from year 1
const nextOf = {};
for (let n = 1; n <= 10; n++) {
  nextOf[`cls-${String(n).padStart(2, "0")}`] = n < 10 ? `cls-${String(n + 1).padStart(2, "0")}` : null;
}
bad = 0;
for (const s2 of sessions.filter((x) => x.academicYearId === "ay-2027-28")) {
  const s1 = sessions.find(
    (x) => x.academicYearId === "ay-2026-27" && x.studentProfileId === s2.studentProfileId
  );
  if (!s1 || nextOf[s1.classId] !== s2.classId) bad++;
}
if (bad) problems.push(`${bad} year-2 sessions not in the next class up from year 1`);

// 6. class-10 students graduated, with an exit date, and hold no year-2 session
const graduates = students.filter((s) => s.status === "GRADUATED");
const graduatedIds = new Set(graduates.map((s) => s.id));
const stillEnrolled = sessions.filter(
  (x) => x.academicYearId === "ay-2027-28" && graduatedIds.has(x.studentProfileId)
).length;
if (stillEnrolled) problems.push(`${stillEnrolled} graduated students still hold a year-2 session`);
const noExitDate = graduates.filter((s) => !s.exitDate).length;
if (noExitDate) problems.push(`${noExitDate} graduated students have no exitDate`);

// 7. the promotion chain survives
bad = 0;
for (const r of rules.filter((x) => x.academicYearId === "ay-2026-27")) {
  if (nextOf[r.classId] !== (r.nextClassId || null)) bad++;
}
if (bad) problems.push(`${bad} promotion rules that break the class chain`);

// 8. results only reference exams from the same year
const examYear = new Map(exams.map((e) => [e.id, e.academicYearId]));
bad = results.filter((r) => examYear.get(r.examId) !== r.academicYearId).length;
if (bad) problems.push(`${bad} exam results referencing an exam from another year`);

console.log(`sheets     : ${wb.worksheets.length}`);
console.log(`students   : ${students.length}`);
console.log(`vouchers   : ${vouchers.length}`);
console.log(`sessions   : ${sessions.length}`);
console.log(`graduated  : ${graduates.length}`);
console.log(`results    : ${results.length}`);
console.log(`attendance : ${attendance.length}`);

if (problems.length) {
  console.log("\nPROBLEMS:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("\nAll consistency checks passed.");
