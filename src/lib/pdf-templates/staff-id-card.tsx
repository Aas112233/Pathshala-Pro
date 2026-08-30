/* eslint-disable jsx-a11y/alt-text */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfSchoolInfo } from "./report-base";

export interface StaffIDCardData {
  staffId: string;
  name: string;
  designation: string;
  department: string;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  joiningDate?: string;
  validUntil?: string;
  photoUrl?: string;
  qrData?: string;
}

export interface StaffIDCardProps {
  school: PdfSchoolInfo;
  staff: StaffIDCardData[];
  academicYear?: string;
  verificationBaseUrl?: string;
}

const styles = StyleSheet.create({
  page: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8, backgroundColor: "#F1F5F9" },
  card: { width: "48.5%", height: 210, borderRadius: 8, overflow: "hidden", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", flexDirection: "column" },
  header: { backgroundColor: "#1D4ED8", paddingVertical: 7, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  logo: { width: 26, height: 26, borderRadius: 4, backgroundColor: "#FFFFFF", marginRight: 6, objectFit: "cover" },
  logoPlaceholder: { width: 26, height: 26, borderRadius: 4, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginRight: 6 },
  schoolName: { color: "#FFFFFF", fontSize: 8, fontWeight: 700, flex: 1 },
  badge: { backgroundColor: "#FFFFFF", color: "#1D4ED8", fontSize: 6, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3 },
  body: { flex: 1, flexDirection: "row", padding: 8, gap: 8 },
  photoWrap: { width: 72, alignItems: "center" },
  photo: { width: 68, height: 78, borderRadius: 6, border: "1.5px solid #1D4ED8", objectFit: "cover" },
  photoPlaceholder: { width: 68, height: 78, borderRadius: 6, border: "1.5px dashed #CBD5E1", backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  qr: { width: 48, height: 48, marginTop: 4, border: "1px solid #E2E8F0" },
  info: { flex: 1 },
  staffName: { fontSize: 10, fontWeight: 700, color: "#0F172A", marginBottom: 1 },
  designation: { fontSize: 7, color: "#1D4ED8", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { fontSize: 6, color: "#64748B", width: 54, fontWeight: 700, textTransform: "uppercase" },
  value: { fontSize: 7, color: "#0F172A", fontWeight: 700, flex: 1 },
  footer: { borderTop: "1px solid #E2E8F0", paddingVertical: 5, paddingHorizontal: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#F8FAFC" },
  footerText: { fontSize: 6, color: "#64748B", fontWeight: 700 },
  validText: { fontSize: 6, color: "#DC2626", fontWeight: 700 },
});

export function StaffIDCardTemplate({ school, staff, academicYear, verificationBaseUrl }: StaffIDCardProps) {
  return (
    <Document title="Staff_ID_Cards" author={school.name}>
      <Page size="A4" style={styles.page}>
        {staff.map((s, i) => {
          const qrData = verificationBaseUrl ? `${verificationBaseUrl}/verify/staff/${s.staffId}` : s.qrData || s.staffId;
          const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}`;
          return (
            <View key={s.staffId + i} style={styles.card}>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  {school.logoUrl ? <Image src={school.logoUrl} style={styles.logo} /> : (
                    <View style={styles.logoPlaceholder}><Text style={{ fontSize: 12, color: "#1D4ED8", fontWeight: 700 }}>{school.name?.charAt(0) || "S"}</Text></View>
                  )}
                  <Text style={styles.schoolName}>{(school.name || "School").toUpperCase()}</Text>
                </View>
                <Text style={styles.badge}>STAFF ID</Text>
              </View>
              <View style={styles.body}>
                <View style={styles.photoWrap}>
                  {s.photoUrl ? <Image src={s.photoUrl} style={styles.photo} /> : (
                    <View style={styles.photoPlaceholder}><Text style={{ fontSize: 6, color: "#94A3B8" }}>Photo</Text></View>
                  )}
                  <Image src={qrSrc} style={styles.qr} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.staffName}>{s.name}</Text>
                  <Text style={styles.designation}>{s.designation} • {s.department}</Text>
                  <View style={styles.row}><Text style={styles.label}>Staff ID</Text><Text style={styles.value}>{s.staffId}</Text></View>
                  <View style={styles.row}><Text style={styles.label}>Dept.</Text><Text style={styles.value}>{s.department}</Text></View>
                  {s.phone ? <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{s.phone}</Text></View> : null}
                  {s.bloodGroup ? <View style={styles.row}><Text style={styles.label}>Blood</Text><Text style={styles.value}>{s.bloodGroup}</Text></View> : null}
                  {s.emergencyContact ? <View style={styles.row}><Text style={styles.label}>Emergency</Text><Text style={styles.value}>{s.emergencyContact}</Text></View> : null}
                  {s.joiningDate ? <View style={styles.row}><Text style={styles.label}>Joined</Text><Text style={styles.value}>{s.joiningDate}</Text></View> : null}
                </View>
              </View>
              <View style={styles.footer}>
                <Text style={styles.footerText}>{academicYear || new Date().getFullYear().toString()} • {school.name}</Text>
                <Text style={styles.validText}>{s.validUntil ? `Valid: ${s.validUntil}` : "Valid: 1 Year"}</Text>
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
