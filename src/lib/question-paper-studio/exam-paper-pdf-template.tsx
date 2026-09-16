import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ExamPaperStudioModel as ExamPaper } from "@/types/exam-studio";
import { getPdfFontFamily, pdfTextSample } from "../pdf-fonts";

interface PdfExamPaperProps {
  paper: ExamPaper;
}

const L = {
  subject: "Subject",
  class: "Class",
  fullMarks: "Full Marks",
  time: "Time",
  set: "Set",
  subjectCode: "Code",
  cutLine: "Cut here",
  studentName: "Student Name",
  rollNo: "Roll No.",
  section: "Section",
};

const styles = StyleSheet.create({
  page: {
    padding: 15,
    backgroundColor: "#FFFFFF",
    fontFamily: "NotoSans",
  },
  header: {
    borderBottom: "3px solid #1E40AF",
    paddingBottom: 12,
    marginBottom: 15,
  },
  instituteName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1E40AF",
  },
  subInstituteText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  examTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E40AF",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 10,
    marginTop: 4,
  },
  metaText: {
    fontSize: 10,
    color: "#4B5563",
  },
  studentInfoBox: {
    border: "1px solid #D1D5DB",
    padding: 10,
    borderRadius: 4,
    backgroundColor: "#F9FAFB",
    margin: "10 0",
  },
  studentInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    margin: "4 0",
  },
  studentLabel: {
    fontSize: 11,
    color: "#4B5563",
  },
  studentValue: {
    fontSize: 11,
    color: "#1F2937",
    borderBottom: "1px solid #D1D5DB",
    paddingBottom: 2,
    width: "48%",
  },
  cutLine: {
    margin: "20 0",
    borderTop: "2px dashed #9CA3AF",
    paddingTop: 4,
  },
  cutLineText: {
    fontSize: 10,
    color: "#6B7280",
    textAlign: "center",
  },
  section: {
    margin: "15 0",
    borderBottom: "1px solid #E5E7EB",
    paddingBottom: 10,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1E40AF",
    marginBottom: 8,
  },
  sectionSubTitle: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  marksInstruction: {
    fontSize: 11,
    color: "#6B7280",
    margin: "4 0",
  },
  question: {
    margin: "4 0",
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  questionQNumber: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1E40AF",
    marginRight: 6,
  },
  questionStimulus: {
    fontSize: 11,
    color: "#6B7280",
    marginRight: 8,
  },
  questionText: {
    fontSize: 12,
    flex: 1,
    marginRight: 6,
  },
  questionMarks: {
    fontSize: 11,
    color: "#6B7280",
  },
  dottedLine: {
    width: "100%",
    borderBottom: "1px dotted #9CA3AF",
    margin: "6 0",
  },
  mcqRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  mcqOption: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  mcqOptionLabel: {
    fontSize: 11,
    fontWeight: "bold",
    marginRight: 4,
  },
  omerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    margin: "10 0",
  },
  omerCircle: {
    width: 16,
    height: 16,
    border: "1px solid #9CA3AF",
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 6,
    fontSize: 8,
    color: "#6B7280",
    textAlign: "center",
  },
  watermark: {
    position: "absolute",
    top: 220,
    left: 0,
    right: 0,
    opacity: 0.08,
  },
  watermarkText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
  },
  instructions: {
    fontSize: 10,
    color: "#6B7280",
    borderLeft: "2px solid #9CA3AF",
    paddingLeft: 8,
    marginTop: 6,
  },
});

export function ExamPaperPDF({ paper }: PdfExamPaperProps) {
  const isRTL = paper.layout.isRTL;
  // fontBengali is a font *preference*, not content — detect from the actual
  // paper text or Bangla questions silently render as tofu under NotoSans.
  const fontFamily = getPdfFontFamily(
    paper.header.instituteName,
    paper.header.subInstituteText,
    paper.header.examName,
    paper.header.subjectName,
    paper.header.specialInstructions,
    paper.layout.watermarkText,
    pdfTextSample(
      paper.sections.flatMap((s) => [
        { title: s.title, subTitle: s.subTitle, marksInstruction: s.marksInstruction },
        ...s.questions.map((q) => ({
          stimulus: q.stimulus,
          text: q.questionText,
          options: (q.mcqOptions || []).join(" "),
        })),
      ])
    )
  );

  return (
    <Document>
      <Page style={[styles.page, { fontFamily, direction: isRTL ? "rtl" : "ltr" }]}>
        {paper.layout.showWatermark && paper.layout.watermarkText && (
          <View
            style={[
              styles.watermark,
              { opacity: paper.layout.watermarkOpacity || 0.08 },
            ]}
          >
            <Text style={styles.watermarkText}>{paper.layout.watermarkText}</Text>
          </View>
        )}

        <View style={styles.header}>
          {paper.header.instituteName && (
            <Text style={styles.instituteName}>{paper.header.instituteName}</Text>
          )}
          {paper.header.subInstituteText && (
            <Text style={styles.subInstituteText}>{paper.header.subInstituteText}</Text>
          )}
          <Text style={styles.examTitle}>
            {paper.header.examName}
            {paper.header.sessionYear ? ` — ${paper.header.sessionYear}` : ""}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {L.subject}: {paper.header.subjectName}
              {paper.header.subjectCode ? ` (${paper.header.subjectCode})` : ""}
            </Text>
            <Text style={styles.metaText}>
              {L.class}: {paper.header.gradeClass}
            </Text>
            <Text style={styles.metaText}>
              {L.fullMarks}: {paper.header.totalMarks}
            </Text>
            <Text style={styles.metaText}>
              {L.time}: {paper.header.timeAllowed}
            </Text>
          </View>
          {paper.header.specialInstructions && (
            <Text style={styles.instructions}>{paper.header.specialInstructions}</Text>
          )}
        </View>

        {paper.layout.studentInfoBox && (
          <View style={styles.studentInfoBox}>
            <View style={styles.studentInfoRow}>
              <Text style={styles.studentLabel}>{L.studentName}:</Text>
              <Text style={styles.studentValue} />
            </View>
            <View style={styles.studentInfoRow}>
              <Text style={styles.studentLabel}>{L.rollNo}:</Text>
              <Text style={styles.studentValue} />
            </View>
            <View style={styles.studentInfoRow}>
              <Text style={styles.studentLabel}>{L.section}:</Text>
              <Text style={styles.studentValue} />
            </View>
          </View>
        )}

        {paper.layout.showHeaderCutLine && (
          <View style={styles.cutLine}>
            <Text style={styles.cutLineText}>{L.cutLine}</Text>
          </View>
        )}

        {paper.sections.map((section) => (
          <View key={section.sectionId} style={styles.section}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            {section.subTitle && (
              <Text style={styles.sectionSubTitle}>{section.subTitle}</Text>
            )}
            {section.marksInstruction && (
              <Text style={styles.marksInstruction}>{section.marksInstruction}</Text>
            )}

            {section.questions.map((question) => (
              <View key={question.id} style={styles.question}>
                <View style={styles.questionRow}>
                  <Text style={styles.questionQNumber}>{question.qNumber}.</Text>
                  {question.stimulus && (
                    <Text style={styles.questionStimulus}>{question.stimulus}</Text>
                  )}
                  <Text style={styles.questionText}>{question.questionText}</Text>
                  {question.marks !== undefined && (
                    <Text style={styles.questionMarks}>{question.marks}</Text>
                  )}
                </View>

                {question.type === "mcq" && question.mcqOptions && (
                  <View style={styles.mcqRow}>
                    {question.mcqOptions.map((opt, optIdx) => (
                      <View key={optIdx} style={styles.mcqOption}>
                        <Text style={styles.mcqOptionLabel}>
                          {["A", "B", "C", "D"][optIdx]}.
                        </Text>
                        <Text style={styles.questionText}>{opt}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {paper.layout.showDottedAnswerLines && question.dottedLinesCount ? (
                  Array.from({ length: question.dottedLinesCount }).map((_, i) => (
                    <View key={i} style={styles.dottedLine} />
                  ))
                ) : null}
              </View>
            ))}

            {paper.layout.showOMRGrid && (
              <View style={styles.omerGrid}>
                {section.questions
                  .filter((q) => q.type === "mcq" || q.type === "mcq-polynomial")
                  .map((q) => (
                    <Text key={q.id} style={styles.omerCircle}>
                      {q.qNumber}
                    </Text>
                  ))}
              </View>
            )}
          </View>
        ))}

        {paper.layout.showOMRGrid && paper.sections.length === 0 && (
          <Text style={styles.cutLineText}>
            No MCQ in this paper — OMR grid will auto-populate when MCQs are added
          </Text>
        )}
      </Page>
    </Document>
  );
}

export default ExamPaperPDF;
