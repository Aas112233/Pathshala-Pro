/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface TimetableEntry {
  dayOfWeek: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectName?: string;
  subjectCode?: string;
  staffName?: string;
  roomNumber?: string;
  isBreak?: boolean;
  breakLabel?: string;
}

export interface TimetableReportData {
  className: string;
  sectionName?: string;
  academicYear?: string;
  entries: TimetableEntry[];
  periods: { periodNumber: number; startTime: string; endTime: string; isBreak?: boolean; breakLabel?: string }[];
}

export interface TimetableReportProps {
  school: PdfSchoolInfo;
  data: TimetableReportData;
  generatedAt?: string;
  labels?: Partial<typeof defaultLabels>;
}

const defaultLabels = {
  title: "Class Timetable",
  subtitle: "Weekly Period Schedule",
  class: "Class",
  section: "Section",
  academicYear: "Academic Year",
  day: "Day",
  period: "Period",
  break: "Break",
  room: "Room",
  teacher: "Teacher",
  generatedOn: "Generated on",
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const styles = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 18, paddingHorizontal: 16, backgroundColor: "#FFFFFF", color: "#0F172A", fontSize: 7.5, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1D4ED8", paddingBottom: 8, marginBottom: 8 },
  schoolBlock: { flexDirection: "row", flex: 1, alignItems: "center" },
  logo: { width: 36, height: 36, borderRadius: 6, objectFit: "cover", marginRight: 8 },
  logoPlaceholder: { width: 36, height: 36, borderRadius: 6, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: 8 },
  schoolName: { fontSize: 13, fontWeight: 700, color: "#1D4ED8" },
  schoolMeta: { fontSize: 7, color: "#475569", marginTop: 1 },
  titleBlock: { alignItems: "flex-end", maxWidth: 220 },
  title: { fontSize: 14, fontWeight: 700, color: "#0F172A", textTransform: "uppercase" },
  subtitle: { fontSize: 7.5, color: "#64748B", marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 8, justifyContent: "center" },
  metaChip: { backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 4, paddingVertical: 3, paddingHorizontal: 8 },
  metaText: { fontSize: 7, color: "#1E3A8A", fontWeight: 700 },
  table: { border: "1px solid #CBD5E1", borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1D4ED8" },
  headerCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, alignItems: "center", borderRight: "1px solid #1E3A8A" },
  headerText: { color: "#FFFFFF", fontSize: 6.5, fontWeight: 700, textAlign: "center", textTransform: "uppercase" },
  headerTextDay: { color: "#FFFFFF", fontSize: 6.5, fontWeight: 700, textAlign: "center" },
  row: { flexDirection: "row", borderTop: "1px solid #E2E8F0", minHeight: 32 },
  rowAlt: { backgroundColor: "#F8FAFC" },
  dayCell: { width: 62, paddingVertical: 6, paddingHorizontal: 4, backgroundColor: "#F1F5F9", borderRight: "1px solid #E2E8F0", justifyContent: "center", alignItems: "center" },
  dayText: { fontSize: 7, fontWeight: 700, color: "#1E293B", textAlign: "center" },
  cell: { flex: 1, paddingVertical: 4, paddingHorizontal: 3, borderRight: "1px solid #F1F5F9", justifyContent: "center", alignItems: "center" },
  subjectText: { fontSize: 7, fontWeight: 700, color: "#0F172A", textAlign: "center" },
  codeText: { fontSize: 5.5, color: "#64748B", textAlign: "center" },
  teacherText: { fontSize: 5.5, color: "#1D4ED8", textAlign: "center", marginTop: 1 },
  breakCell: { flex: 1, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", paddingVertical: 8, borderRight: "1px solid #FDE68A" },
  breakText: { fontSize: 7, fontWeight: 700, color: "#92400E", textTransform: "uppercase" },
  footer: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #E2E8F0", flexDirection: "row", justifyContent: "space-between", color: "#64748B", fontSize: 6.5 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  sigBlock: { width: 120, alignItems: "center" },
  sigLine: { width: "100%", borderTop: "1px solid #0F172A", marginBottom: 4 },
  sigTitle: { fontSize: 7, color: "#475569", fontWeight: 700 },
});

export function TimetableReportTemplate({ school, data, generatedAt, labels: l }: TimetableReportProps) {
  const L = { ...defaultLabels, ...l };
  const periods = data.periods.length > 0 ? data.periods : Array.from(new Set(data.entries.map((e) => e.periodNumber))).sort((a, b) => a - b).map((n) => {
    const e = data.entries.find((x) => x.periodNumber === n)!;
    return { periodNumber: n, startTime: e.startTime, endTime: e.endTime, isBreak: e.isBreak, breakLabel: e.breakLabel };
  });
  const daysInUse = DAYS.filter((d) => data.entries.some((e) => e.dayOfWeek === d));
  const days = daysInUse.length > 0 ? daysInUse : DAYS.slice(0, 6);

  const getEntry = (day: string, period: number) => data.entries.find((e) => e.dayOfWeek === day && e.periodNumber === period);

  return (
    <Document title={`Timetable-${data.className}${data.sectionName ? `-${data.sectionName}` : ""}`} author={school.name}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.schoolBlock}>
            {school.logoUrl ? <Image src={school.logoUrl} style={styles.logo} /> : (
              <View style={styles.logoPlaceholder}><Text style={{ fontSize: 14, color: "#1D4ED8", fontWeight: 700 }}>{school.name?.charAt(0) || "S"}</Text></View>
            )}
            <View>
              <Text style={styles.schoolName}>{school.name || "Pathshala Pro School"}</Text>
              {school.address ? <Text style={styles.schoolMeta}>{school.address}</Text> : null}
              <Text style={styles.schoolMeta}>{[school.phone, school.email].filter(Boolean).join("  |  ")}</Text>
            </View>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{L.title}</Text>
            <Text style={styles.subtitle}>{L.subtitle}</Text>
            {generatedAt ? <Text style={{ fontSize: 6.5, color: "#64748B", marginTop: 2 }}>{L.generatedOn}: {generatedAt}</Text> : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}><Text style={styles.metaText}>{L.class}: {data.className}</Text></View>
          {data.sectionName ? <View style={styles.metaChip}><Text style={styles.metaText}>{L.section}: {data.sectionName}</Text></View> : null}
          {data.academicYear ? <View style={styles.metaChip}><Text style={styles.metaText}>{L.academicYear}: {data.academicYear}</Text></View> : null}
        </View>

        <View style={styles.table}>
          {/* Header row: Day + periods */}
          <View style={styles.tableHeader}>
            <View style={[styles.headerCell, { width: 62, flex: 0 }]}>
              <Text style={styles.headerTextDay}>{L.day} / {L.period}</Text>
            </View>
            {periods.map((p) => (
              <View key={p.periodNumber} style={styles.headerCell}>
                {p.isBreak ? <Text style={styles.headerText}>{L.break}</Text> : (
                  <>
                    <Text style={styles.headerText}>P{p.periodNumber}</Text>
                    <Text style={[styles.headerText, { fontSize: 5.5, fontWeight: 400 }]}>{p.startTime} - {p.endTime}</Text>
                  </>
                )}
              </View>
            ))}
          </View>

          {/* Days */}
          {days.map((day, di) => (
            <View key={day} style={[styles.row, di % 2 === 1 ? styles.rowAlt : {}]}>
              <View style={styles.dayCell}>
                <Text style={styles.dayText}>{day.charAt(0) + day.slice(1).toLowerCase()}</Text>
              </View>
              {periods.map((p) => {
                if (p.isBreak) {
                  const br = getEntry(day, p.periodNumber);
                  return (
                    <View key={p.periodNumber} style={styles.breakCell}>
                      <Text style={styles.breakText}>{br?.breakLabel || p.breakLabel || L.break}</Text>
                    </View>
                  );
                }
                const e = getEntry(day, p.periodNumber);
                return (
                  <View key={p.periodNumber} style={styles.cell}>
                    {e ? (
                      e.isBreak ? <Text style={styles.breakText}>{e.breakLabel || L.break}</Text> : (
                        <>
                          <Text style={styles.subjectText}>{e.subjectName || "-"}</Text>
                          {e.subjectCode ? <Text style={styles.codeText}>{e.subjectCode}</Text> : null}
                          {e.staffName ? <Text style={styles.teacherText}>{e.staffName}</Text> : null}
                          {e.roomNumber ? <Text style={[styles.codeText, { color: "#475569" }]}>{L.room}: {e.roomNumber}</Text> : null}
                        </>
                      )
                    ) : (
                      <Text style={[styles.codeText, { color: "#CBD5E1" }]}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.sigRow}>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>Class Teacher</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>Academic Coordinator</Text></View>
          <View style={styles.sigBlock}><View style={styles.sigLine} /><Text style={styles.sigTitle}>Principal</Text></View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{school.name} • {data.className}{data.sectionName ? ` - ${data.sectionName}` : ""}</Text>
          <Text>Computer-generated timetable</Text>
        </View>
      </Page>
    </Document>
  );
}
