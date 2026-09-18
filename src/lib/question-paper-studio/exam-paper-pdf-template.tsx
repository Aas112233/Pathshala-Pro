import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type {
  ExamPaperStudioModel as ExamPaper,
  QuestionItem,
} from "@/types/exam-studio";
import { getPdfFontFamily, pdfTextSample } from "../pdf-fonts";
import { formatNumeral, getCQPartLabels, getOptionLabel } from "./bengali-numerals";
import {
  stripHtml,
  resolvePdfLabels,
  formatQuestionNumber,
  placeMarks,
  pdfPageSize,
  pdfPagePadding,
  pdfTypeScale,
  pdfLineHeight,
  pdfQuestionColumnWidth,
  type PdfLabels,
} from "./exam-paper-pdf-utils";

interface PdfExamPaperProps {
  paper: ExamPaper;
}

/**
 * Official examination-sheet PDF template.
 *
 * Mirrors the HTML preview (`question-papers/[id]/preview`): centered
 * black/white header, Class/Subject/Time/FullMarks meta grid, student
 * fill-in lines, boxed instructions, section blocks, and per-type question
 * bodies (stimulus, MCQ, polynomial, CQ parts, matching, fill-blanks,
 * sub-questions, OR alternatives, dotted lines). Every visual knob reads
 * from `paper.layout` so the PDF matches the studio settings instead of a
 * hardcoded blue theme.
 */

const INK = "#000000";
const GRAY_DARK = "#374151";
const GRAY = "#6B7280";
const GRAY_LIGHT = "#D1D5DB";
const BOX_BG = "#F5F5F5";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    fontFamily: "NotoSans",
  },
  borderWrap: {
    flexGrow: 1,
    padding: 10,
  },
  // -- header ---------------------------------------------------------------
  headerCenter: { alignItems: "center", textAlign: "center" },
  headerLeft: { alignItems: "flex-start", textAlign: "left" },
  headerRule: {
    borderBottomWidth: 2,
    borderBottomColor: INK,
    borderBottomStyle: "solid",
    paddingBottom: 10,
    marginBottom: 12,
    width: "100%",
  },
  bismillah: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: GRAY_LIGHT,
    borderTopStyle: "solid",
  },
  metaCell: { width: "24%" },
  metaLabel: { color: GRAY_DARK },
  metaValue: { color: INK, fontWeight: "bold" },
  gridBoxRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 8,
  },
  gridBox: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: INK,
    borderStyle: "solid",
    padding: 5,
    marginRight: -1,
  },
  dualRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
  },
  fillRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    width: "100%",
    marginTop: 8,
  },
  fillLine: {
    flexGrow: 1,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_DARK,
    borderBottomStyle: "dotted",
    marginLeft: 6,
    minHeight: 12,
  },
  instructionsBox: {
    borderWidth: 1,
    borderColor: GRAY_LIGHT,
    borderStyle: "solid",
    backgroundColor: BOX_BG,
    padding: 8,
    marginTop: 10,
    width: "100%",
  },
  cutLine: {
    marginTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: GRAY,
    borderTopStyle: "dashed",
    paddingTop: 3,
  },
  cutLineText: {
    color: GRAY,
    textAlign: "center",
  },
  // -- sections & questions ---------------------------------------------------
  section: { marginTop: 12 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: GRAY_DARK,
    borderBottomStyle: "solid",
    paddingBottom: 3,
    marginBottom: 6,
  },
  questionFlow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  question: { marginBottom: 8 },
  qLine: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  qNumber: { fontWeight: "bold", marginRight: 6 },
  qText: { flexGrow: 1, flexShrink: 1 },
  qMarks: { fontWeight: "bold", marginLeft: 6 },
  stimulusBox: {
    backgroundColor: BOX_BG,
    borderLeftWidth: 2,
    borderLeftColor: INK,
    borderLeftStyle: "solid",
    padding: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  stimulusLabel: {
    color: GRAY_DARK,
    fontStyle: "normal",
    fontWeight: "bold",
    marginBottom: 2,
  },
  figure: { alignItems: "center", marginVertical: 6 },
  caption: { color: GRAY_DARK, marginTop: 2 },
  mcqGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    paddingLeft: 18,
  },
  mcqOption: {
    flexDirection: "row",
    width: "48%",
    marginBottom: 2,
    paddingRight: 6,
  },
  mcqOptionLabel: { fontWeight: "bold", marginRight: 4 },
  subRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },
  subLabel: { fontWeight: "bold", marginRight: 5 },
  subText: { flexGrow: 1, flexShrink: 1 },
  subMarks: { fontWeight: "bold", marginLeft: 6 },
  matchBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: GRAY_LIGHT,
    borderStyle: "solid",
    marginTop: 4,
    padding: 6,
  },
  matchCol: { flexGrow: 1, paddingHorizontal: 4 },
  matchHead: {
    fontWeight: "bold",
    color: GRAY_DARK,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_LIGHT,
    borderBottomStyle: "solid",
    paddingBottom: 2,
    marginBottom: 3,
  },
  matchRow: { flexDirection: "row", marginTop: 1 },
  blanksBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GRAY_LIGHT,
    borderStyle: "dashed",
    backgroundColor: BOX_BG,
    padding: 6,
    marginTop: 4,
  },
  blankClue: {
    borderWidth: 1,
    borderColor: GRAY_LIGHT,
    borderStyle: "solid",
    backgroundColor: "#FFFFFF",
    paddingVertical: 1,
    paddingHorizontal: 6,
    margin: 2,
  },
  orBlock: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: GRAY,
    borderTopStyle: "dashed",
  },
  orLabel: {
    textAlign: "center",
    fontWeight: "bold",
    color: GRAY_DARK,
    marginBottom: 3,
  },
  dottedLine: {
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: GRAY,
    borderBottomStyle: "dotted",
    marginVertical: 7,
  },
  teacherNote: {
    color: GRAY_DARK,
    marginTop: 3,
  },
  omerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  omerCircle: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: GRAY,
    borderStyle: "solid",
    borderRadius: 9,
    marginRight: 6,
    marginBottom: 6,
    color: GRAY_DARK,
    textAlign: "center",
    paddingTop: 3,
  },
  watermark: {
    position: "absolute",
    top: 240,
    left: 0,
    right: 0,
  },
  watermarkText: {
    fontWeight: "bold",
    color: INK,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: "center",
    color: GRAY,
  },
  endMark: {
    textAlign: "center",
    fontWeight: "bold",
    color: GRAY_DARK,
    borderTopWidth: 1,
    borderTopColor: GRAY_LIGHT,
    borderTopStyle: "solid",
    marginTop: 16,
    paddingTop: 8,
  },
});

interface Ctx {
  L: PdfLabels;
  ns: ExamPaper["layout"]["numeralSystem"];
  marksPosition: ExamPaper["layout"]["marksPosition"];
  numberingStyle: ExamPaper["layout"]["numberingStyle"];
  showTeacherNotes: boolean;
  t: { question: number; small: number; meta: number; section: number; institute: number; exam: number };
  lh: number;
}

function samplePaperText(paper: ExamPaper): string {
  return pdfTextSample(
    paper.sections.flatMap((s) => [
      { title: s.title, subTitle: s.subTitle, marksInstruction: s.marksInstruction },
      ...s.questions.map((q) => ({
        stimulus: q.stimulus,
        text: q.questionText,
        options: (q.mcqOptions || []).join(" "),
        polynomial: (q.polynomialStatements || []).join(" ") + " " + (q.polynomialQuestionText || ""),
        matching:
          (q.matchingColumns ? [...q.matchingColumns.left, ...q.matchingColumns.right].join(" ") : "") +
          " " +
          (q.fillBlanksOptions || []).join(" "),
        subs: (q.subQuestions || []).map((s) => `${s.label} ${s.text}`).join(" "),
        or: q.orAlternative?.questionText || "",
        cq: q.cqParts ? [q.cqParts.ka?.text, q.cqParts.kha?.text, q.cqParts.ga?.text, q.cqParts.gha?.text].join(" ") : "",
      })),
    ])
  );
}

function borderFor(style: ExamPaper["layout"]["borderStyle"]): {
  borderWidth: number;
  borderColor: string;
  borderStyle: "solid" | "dashed" | "dotted";
} {
  switch (style) {
    case "double":
    case "ornamental":
      // react-pdf has no double rule — a thicker solid reads the same at print sizes
      return { borderWidth: 3, borderColor: INK, borderStyle: "solid" };
    case "dashed":
      return { borderWidth: 1.5, borderColor: INK, borderStyle: "dashed" };
    case "dotted":
      return { borderWidth: 1.5, borderColor: INK, borderStyle: "dotted" };
    case "none":
      return { borderWidth: 0, borderColor: INK, borderStyle: "solid" };
    case "solid":
    default:
      return { borderWidth: 1.5, borderColor: INK, borderStyle: "solid" };
  }
}

function MetaCells({ paper, ctx }: { paper: ExamPaper; ctx: Ctx }) {
  const { L, ns, t } = ctx;
  const h = paper.header;
  const cells: Array<[string, string]> = [
    [`${L.class}:`, h.gradeClass],
    [`${L.subject}:`, h.subjectCode ? `${h.subjectName} (${h.subjectCode})` : h.subjectName],
    [`${L.time}:`, h.timeAllowed],
    [`${L.fullMarks}:`, formatNumeral(h.totalMarks, ns)],
  ];
  return (
    <>
      {cells.map(([label, value], i) => (
        <View key={i} style={styles.metaCell}>
          <Text style={[styles.metaLabel, { fontSize: t.meta, lineHeight: ctx.lh }]}>
            {label}{" "}
            <Text style={[styles.metaValue, { fontSize: t.meta }]}>{stripHtml(value) || "—"}</Text>
          </Text>
        </View>
      ))}
    </>
  );
}

function HeaderBlock({ paper, ctx }: { paper: ExamPaper; ctx: Ctx }) {
  const { L, t } = ctx;
  const h = paper.header;
  const layout = paper.layout;
  const setLine = [h.examSet ? `${L.set}: ${h.examSet}` : "", h.subjectCode ? `${L.code}: ${h.subjectCode}` : ""]
    .filter(Boolean)
    .join("   ");

  const institute = (
    <>
      {h.instituteName ? (
        <Text style={[styles.qNumber, { fontSize: t.institute, textTransform: "uppercase" }]}>{stripHtml(h.instituteName)}</Text>
      ) : null}
      {h.subInstituteText ? (
        <Text style={{ fontSize: t.meta, color: GRAY_DARK, marginTop: 2 }}>{stripHtml(h.subInstituteText)}</Text>
      ) : null}
    </>
  );

  const examTitle = (
    <>
      <Text style={{ fontSize: t.exam, fontWeight: "bold", textTransform: "uppercase", marginTop: 6 }}>
        {stripHtml(h.examName)}
        {h.sessionYear ? ` — ${stripHtml(h.sessionYear)}` : ""}
      </Text>
      {setLine ? <Text style={{ fontSize: t.meta, color: GRAY_DARK, marginTop: 2 }}>{setLine}</Text> : null}
    </>
  );

  return (
    <View>
      {layout.headerArabicBismillah && h.bismillahArabicText ? (
        <Text style={styles.bismillah}>{h.bismillahArabicText}</Text>
      ) : null}
      {layout.headerStyle === "minimal-left" ? (
        <View style={styles.headerLeft}>
          {institute}
          {examTitle}
        </View>
      ) : layout.headerStyle === "modern-dual" ? (
        <View style={styles.dualRow}>
          <View style={[styles.headerLeft, { flexGrow: 1, paddingRight: 10 }]}>
            {institute}
          </View>
          <View style={{ alignItems: "flex-end", textAlign: "right" }}>{examTitle}</View>
        </View>
      ) : (
        <View style={styles.headerCenter}>
          {institute}
          <Text style={{ fontSize: t.exam, fontWeight: "bold", textTransform: "uppercase", textDecoration: "underline", marginTop: 6 }}>
            {stripHtml(h.examName)}
            {h.sessionYear ? ` — ${stripHtml(h.sessionYear)}` : ""}
          </Text>
          {setLine ? <Text style={{ fontSize: t.meta, color: GRAY_DARK, marginTop: 2 }}>{setLine}</Text> : null}
        </View>
      )}

      {layout.headerStyle === "cambridge-grid" ? (
        <View>
          <View style={styles.gridBoxRow}>
            <View style={styles.gridBox}>
              <Text style={{ fontSize: t.meta }}>{L.class}: <Text style={{ fontWeight: "bold" }}>{stripHtml(h.gradeClass) || "—"}</Text></Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={{ fontSize: t.meta }}>{L.subject}: <Text style={{ fontWeight: "bold" }}>{stripHtml(h.subjectName) || "—"}</Text></Text>
            </View>
          </View>
          <View style={styles.gridBoxRow}>
            <View style={styles.gridBox}>
              <Text style={{ fontSize: t.meta }}>{L.time}: <Text style={{ fontWeight: "bold" }}>{stripHtml(h.timeAllowed) || "—"}</Text></Text>
            </View>
            <View style={[styles.gridBox, { marginRight: 0 }]}>
              <Text style={{ fontSize: t.meta }}>{L.fullMarks}: <Text style={{ fontWeight: "bold" }}>{formatNumeral(h.totalMarks, ctx.ns) || "—"}</Text></Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.metaRow}>
          <MetaCells paper={paper} ctx={ctx} />
        </View>
      )}

      {layout.studentInfoBox ? (
        <View style={{ width: "100%", marginTop: 6 }}>
          <View style={styles.fillRow}>
            <Text style={{ fontSize: t.meta }}>{L.studentName}:</Text>
            <View style={styles.fillLine} />
          </View>
          <View style={[styles.fillRow, { marginTop: 6 }]}>
            <Text style={{ fontSize: t.meta }}>{L.rollNo}:</Text>
            <View style={[styles.fillLine, { marginRight: 12 }]} />
            <Text style={{ fontSize: t.meta }}>{L.section}:</Text>
            <View style={styles.fillLine} />
          </View>
        </View>
      ) : null}

      {h.specialInstructions ? (
        <View style={styles.instructionsBox}>
          <Text style={{ fontSize: t.meta, fontWeight: "bold", textTransform: "uppercase", marginBottom: 3 }}>
            {L.instructions}
          </Text>
          <Text style={{ fontSize: t.small, color: GRAY_DARK, lineHeight: ctx.lh }}>
            {stripHtml(h.specialInstructions)}
          </Text>
        </View>
      ) : null}

      {layout.showHeaderCutLine ? (
        <View style={styles.cutLine}>
          <Text style={[styles.cutLineText, { fontSize: t.small }]}>{L.cutLine}</Text>
        </View>
      ) : null}
    </View>
  );
}

function McqOptions({ options, ctx }: { options: string[]; ctx: Ctx }) {
  return (
    <View style={styles.mcqGrid}>
      {options.map((opt, i) => (
        <View key={i} style={styles.mcqOption}>
          <Text style={[styles.mcqOptionLabel, { fontSize: ctx.t.small }]}>{getOptionLabel(i, ctx.ns)}</Text>
          <Text style={{ fontSize: ctx.t.small, lineHeight: ctx.lh }}>{stripHtml(opt)}</Text>
        </View>
      ))}
    </View>
  );
}

function CqParts({ question, ctx }: { question: QuestionItem; ctx: Ctx }) {
  const labels = getCQPartLabels(ctx.ns);
  const parts = [
    { key: "ka" as const, part: question.cqParts?.ka },
    { key: "kha" as const, part: question.cqParts?.kha },
    { key: "ga" as const, part: question.cqParts?.ga },
    { key: "gha" as const, part: question.cqParts?.gha },
  ].filter((p) => p.part?.text);
  if (parts.length === 0) return null;
  return (
    <View style={{ marginTop: 3, paddingLeft: 18 }}>
      {parts.map(({ key, part }) => {
        const m = placeMarks(part!.marks, ctx.marksPosition, ctx.ns);
        return (
          <View key={key} style={styles.subRow}>
            <Text style={[styles.subLabel, { fontSize: ctx.t.small }]}>({labels[key]})</Text>
            <Text style={[styles.subText, { fontSize: ctx.t.small, lineHeight: ctx.lh }]}>
              {stripHtml(part!.text)}
              {m.suffix ? <Text style={{ fontWeight: "bold" }}>{m.suffix}</Text> : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function QuestionBody({ question, qIndex, ctx }: { question: QuestionItem; qIndex: number; ctx: Ctx }) {
  const num = formatQuestionNumber(question.qNumber, qIndex, ctx.numberingStyle, ctx.ns);
  const marks = question.type === "cq" && question.cqParts ? { prefix: "", suffix: "" } : placeMarks(question.marks, ctx.marksPosition, ctx.ns);

  return (
    <View>
      {question.stimulus ? (
        <View style={styles.stimulusBox}>
          <Text style={[styles.stimulusLabel, { fontSize: ctx.t.small }]}>{ctx.L.context}</Text>
          <Text style={{ fontSize: ctx.t.small, lineHeight: ctx.lh }}>{stripHtml(question.stimulus)}</Text>
        </View>
      ) : null}

      {question.stimulusImage?.url ? (
        <View style={styles.figure}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image
            src={question.stimulusImage.url}
            style={{ width: `${question.stimulusImage.widthPercent || 50}%`, maxHeight: 220, objectFit: "contain" }}
          />
          {question.stimulusImage.caption ? (
            <Text style={[styles.caption, { fontSize: ctx.t.small }]}>{stripHtml(question.stimulusImage.caption)}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.qLine}>
        {marks.prefix ? (
          <Text style={[styles.qMarks, { fontSize: ctx.t.small, marginLeft: 0, marginRight: 6 }]}>{marks.prefix}</Text>
        ) : null}
        <Text style={[styles.qNumber, { fontSize: ctx.t.question }]}>
          {ctx.numberingStyle === "q-prefix" || num.startsWith("(") ? num : `${num}.`}
        </Text>
        <Text style={[styles.qText, { fontSize: ctx.t.question, lineHeight: ctx.lh }]}>
          {stripHtml(question.questionText)}
          {marks.suffix ? <Text style={{ fontWeight: "bold" }}>{marks.suffix}</Text> : null}
        </Text>
      </View>

      {Array.isArray(question.mcqOptions) && question.mcqOptions.length > 0 ? (
        <McqOptions options={question.mcqOptions} ctx={ctx} />
      ) : null}

      {Array.isArray(question.polynomialStatements) && question.polynomialStatements.length > 0 ? (
        <View style={{ marginTop: 2, paddingLeft: 18 }}>
          {question.polynomialStatements.map((stmt, i) => (
            <View key={i} style={[styles.subRow, { marginTop: 1 }]}>
              <Text style={[styles.subLabel, { fontSize: ctx.t.small, fontWeight: "normal" }]}>
                {["i.", "ii.", "iii."][i] || `${i + 1}.`}
              </Text>
              <Text style={[styles.subText, { fontSize: ctx.t.small, lineHeight: ctx.lh }]}>{stripHtml(stmt)}</Text>
            </View>
          ))}
          {question.polynomialQuestionText ? (
            <Text style={{ fontSize: ctx.t.small, marginTop: 2 }}>{stripHtml(question.polynomialQuestionText)}</Text>
          ) : null}
        </View>
      ) : null}

      {question.cqParts ? <CqParts question={question} ctx={ctx} /> : null}

      {question.type === "matching" && question.matchingColumns ? (
        <View style={styles.matchBox}>
          <View style={styles.matchCol}>
            <Text style={[styles.matchHead, { fontSize: ctx.t.small }]}>{ctx.L.columnA}</Text>
            {question.matchingColumns.left.map((item, i) => (
              <View key={i} style={styles.matchRow}>
                <Text style={{ fontSize: ctx.t.small, fontWeight: "bold", marginRight: 3 }}>({i + 1})</Text>
                <Text style={{ fontSize: ctx.t.small, lineHeight: ctx.lh }}>{stripHtml(item)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.matchCol}>
            <Text style={[styles.matchHead, { fontSize: ctx.t.small }]}>{ctx.L.columnB}</Text>
            {question.matchingColumns.right.map((item, i) => (
              <View key={i} style={styles.matchRow}>
                <Text style={{ fontSize: ctx.t.small, fontWeight: "bold", marginRight: 3 }}>({formatNumeral(i + 1, ctx.ns)})</Text>
                <Text style={{ fontSize: ctx.t.small, lineHeight: ctx.lh }}>{stripHtml(item)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {question.type === "fill-blanks" && question.fillBlanksOptions && question.fillBlanksOptions.length > 0 ? (
        <View style={styles.blanksBox}>
          {question.fillBlanksOptions.map((clue, i) => (
            <Text key={i} style={[styles.blankClue, { fontSize: ctx.t.small }]}>{stripHtml(clue)}</Text>
          ))}
        </View>
      ) : null}

      {Array.isArray(question.subQuestions) && question.subQuestions.length > 0 ? (
        <View style={{ marginTop: 2, paddingLeft: 18 }}>
          {question.subQuestions.map((sub, i) => {
            const m = placeMarks(sub.marks, ctx.marksPosition, ctx.ns);
            return (
              <View key={sub.id || i} style={styles.subRow}>
                <Text style={[styles.subLabel, { fontSize: ctx.t.small }]}>{stripHtml(sub.label) || `${i + 1}.`}</Text>
                <Text style={[styles.subText, { fontSize: ctx.t.small, lineHeight: ctx.lh }]}>
                  {stripHtml(sub.text)}
                  {m.suffix ? <Text style={{ fontWeight: "bold" }}>{m.suffix}</Text> : null}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {question.orAlternative ? (
        <View style={styles.orBlock}>
          <Text style={[styles.orLabel, { fontSize: ctx.t.small }]}>{ctx.L.or}</Text>
          <Text style={{ fontSize: ctx.t.question, lineHeight: ctx.lh }}>{stripHtml(question.orAlternative.questionText)}</Text>
          {question.orAlternative.cqParts ? (
            <CqParts question={{ ...question, cqParts: question.orAlternative.cqParts }} ctx={ctx} />
          ) : null}
          {Array.isArray(question.orAlternative.subQuestions) && question.orAlternative.subQuestions.length > 0 ? (
            <View style={{ marginTop: 2, paddingLeft: 18 }}>
              {question.orAlternative.subQuestions.map((sub, i) => {
                const m = placeMarks(sub.marks, ctx.marksPosition, ctx.ns);
                return (
                  <View key={sub.id || i} style={styles.subRow}>
                    <Text style={[styles.subLabel, { fontSize: ctx.t.small }]}>{stripHtml(sub.label) || `${i + 1}.`}</Text>
                    <Text style={[styles.subText, { fontSize: ctx.t.small, lineHeight: ctx.lh }]}>
                      {stripHtml(sub.text)}
                      {m.suffix ? <Text style={{ fontWeight: "bold" }}>{m.suffix}</Text> : null}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {question.dottedLinesCount ? (
        <View>
          {Array.from({ length: question.dottedLinesCount }).map((_, i) => (
            <View key={i} style={styles.dottedLine} />
          ))}
        </View>
      ) : null}

      {ctx.showTeacherNotes && question.notesForExaminer ? (
        <Text style={[styles.teacherNote, { fontSize: ctx.t.small }]}>
          {stripHtml(question.notesForExaminer)}
        </Text>
      ) : null}
    </View>
  );
}

export function ExamPaperPDF({ paper }: PdfExamPaperProps) {
  const layout = paper.layout;
  const isRTL = layout.isRTL;
  const ns = layout.numeralSystem;
  const L = resolvePdfLabels(ns);
  const t = pdfTypeScale(layout.fontSize);
  const lh = pdfLineHeight(layout.lineSpacing);
  const ctx: Ctx = {
    L,
    ns,
    marksPosition: layout.marksPosition,
    numberingStyle: layout.numberingStyle,
    showTeacherNotes: layout.showTeacherNotes,
    t,
    lh,
  };

  const fontFamily = getPdfFontFamily(
    paper.header.instituteName,
    paper.header.subInstituteText,
    paper.header.examName,
    paper.header.subjectName,
    paper.header.specialInstructions,
    paper.layout.watermarkText,
    samplePaperText(paper)
  );

  const showBorder = layout.showBorder && layout.borderStyle !== "none";
  const border = borderFor(layout.borderStyle);
  const columns =
    layout.columnLayout === "three-column" ? 3 : layout.columnLayout === "two-column" ? 2 : 1;
  const questionWidth = pdfQuestionColumnWidth(columns);
  const pageNumbers = layout.pageNumberingFormat !== "none";

  const body = (
    <>
      {layout.showWatermark && layout.watermarkText ? (
        <View style={[styles.watermark, { opacity: layout.watermarkOpacity || 0.04 }]}>
          <Text style={[styles.watermarkText, { fontSize: 44 }]}>{layout.watermarkText}</Text>
        </View>
      ) : null}

      <View style={styles.headerRule}>
        <HeaderBlock paper={paper} ctx={ctx} />
      </View>

      {paper.sections.map((section) => (
        <View key={section.sectionId} style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={{ flexGrow: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: t.section, fontWeight: "bold", textTransform: "uppercase" }}>
                {stripHtml(section.title)}
              </Text>
              {section.subTitle ? (
                <Text style={{ fontSize: t.small, color: GRAY_DARK, marginTop: 1 }}>
                  {stripHtml(section.subTitle)}
                </Text>
              ) : null}
            </View>
            {section.marksInstruction ? (
              <Text style={{ fontSize: t.meta, fontWeight: "bold" }}>{stripHtml(section.marksInstruction)}</Text>
            ) : null}
          </View>

          <View style={columns > 1 ? styles.questionFlow : undefined}>
            {section.questions.map((question, qIdx) => (
              <View
                key={question.id || qIdx}
                wrap={false}
                style={[styles.question, columns > 1 ? ({ width: questionWidth } as any) : {}]}
              >
                <QuestionBody question={question} qIndex={qIdx} ctx={ctx} />
              </View>
            ))}
          </View>

          {layout.showOMRGrid ? (
            <View style={styles.omerGrid}>
              {section.questions
                .filter((q) => q.type === "mcq" || q.type === "mcq-polynomial")
                .map((q) => (
                  <Text key={q.id} style={[styles.omerCircle, { fontSize: t.small }]}>
                    {formatQuestionNumber(q.qNumber, 0, layout.numberingStyle, ns)}
                  </Text>
                ))}
            </View>
          ) : null}
        </View>
      ))}

      <Text style={[styles.endMark, { fontSize: t.meta }]}>— {L.endOfPaper} —</Text>
    </>
  );

  return (
    <Document>
      <Page
        size={pdfPageSize(layout.pageFormat)}
        style={[styles.page, { padding: pdfPagePadding(layout.marginSize), fontFamily, direction: isRTL ? "rtl" : "ltr" }]}
      >
        {showBorder ? (
          <View style={[styles.borderWrap, border as any]}>{body}</View>
        ) : (
          body
        )}
        {pageNumbers ? (
          <Text
            fixed
            render={({ pageNumber, totalPages }) =>
              `${formatNumeral(pageNumber, layout.pageNumberingFormat === "bengali" ? "bengali" : "english")} / ${formatNumeral(totalPages, layout.pageNumberingFormat === "bengali" ? "bengali" : "english")}`
            }
            style={[styles.footer, { fontSize: t.small }]}
          />
        ) : null}
      </Page>
    </Document>
  );
}

export default ExamPaperPDF;
