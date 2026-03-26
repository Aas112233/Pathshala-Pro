import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

// Register fonts (using built-in fonts for simplicity)
Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf", fontWeight: 300 },
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf", fontWeight: 400 },
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf", fontWeight: 500 },
    { src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf", fontWeight: 700 },
  ],
});

interface StudentIDCardProps {
  student: {
    name: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    section: string;
    dateOfBirth: string;
    bloodGroup?: string;
    photoUrl?: string;
    guardianName: string;
    guardianContact: string;
    academicYear: string;
  };
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
}

const styles = StyleSheet.create({
  // ID Card Styles
  idCardPage: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 20,
  },
  idCard: {
    width: "48%",
    margin: "1%",
    borderRadius: 8,
    overflow: "hidden",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  idCardHeader: {
    background: "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  idCardLogo: {
    width: 30,
    height: 30,
    marginRight: 8,
  },
  idCardSchoolName: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 700,
    flex: 1,
  },
  idCardBadge: {
    backgroundColor: "#FFFFFF",
    color: "#1E40AF",
    fontSize: 7,
    fontWeight: 700,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  idCardBody: {
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  idCardPhotoSection: {
    flexDirection: "row",
    marginBottom: 10,
  },
  idCardPhoto: {
    width: 80,
    height: 90,
    border: "2px solid #1E40AF",
    borderRadius: 4,
  },
  idCardPhotoPlaceholder: {
    width: 80,
    height: 90,
    border: "2px dashed #CBD5E1",
    borderRadius: 4,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  idCardPhotoPlaceholderText: {
    fontSize: 7,
    color: "#94A3B8",
  },
  idCardInfo: {
    flex: 1,
    paddingLeft: 10,
  },
  idCardStudentName: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1E293B",
    marginBottom: 6,
  },
  idCardRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  idCardLabel: {
    fontSize: 6,
    color: "#64748B",
    width: 70,
    fontWeight: 500,
  },
  idCardValue: {
    fontSize: 7,
    color: "#1E293B",
    fontWeight: 400,
    flex: 1,
  },
  idCardFooter: {
    borderTop: "1px solid #E2E8F0",
    paddingTop: 8,
    marginTop: 8,
  },
  idCardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  idCardFooterLabel: {
    fontSize: 6,
    color: "#64748B",
  },
  idCardFooterValue: {
    fontSize: 7,
    color: "#1E293B",
    fontWeight: 500,
  },
  idCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px solid #E2E8F0",
  },
  idCardSignature: {
    fontSize: 6,
    color: "#64748B",
  },
  idCardQR: {
    width: 40,
    height: 40,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  idCardQRText: {
    fontSize: 5,
    color: "#94A3B8",
  },
  // Mark Sheet Styles
  markSheetPage: {
    padding: 30,
    backgroundColor: "#FFFFFF",
  },
  markSheetHeader: {
    borderBottom: "3px solid #1E40AF",
    paddingBottom: 15,
    marginBottom: 20,
  },
  markSheetLogoSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  markSheetLogo: {
    width: 50,
    height: 50,
    marginRight: 15,
  },
  markSheetSchoolInfo: {
    flex: 1,
  },
  markSheetSchoolName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1E40AF",
    marginBottom: 3,
  },
  markSheetSchoolAddress: {
    fontSize: 8,
    color: "#64748B",
    marginBottom: 2,
  },
  markSheetContact: {
    fontSize: 7,
    color: "#64748B",
  },
  markSheetTitle: {
    textAlign: "center" as const,
    fontSize: 14,
    fontWeight: 700,
    color: "#1E293B",
    marginTop: 10,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
  },
  markSheetSubtitle: {
    textAlign: "center" as const,
    fontSize: 9,
    color: "#64748B",
    marginTop: 3,
  },
  markSheetStudentInfo: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 6,
    marginBottom: 15,
    border: "1px solid #E2E8F0",
  },
  markSheetInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap" as const,
  },
  markSheetInfoItem: {
    width: "33.33%",
    marginBottom: 6,
  },
  markSheetInfoLabel: {
    fontSize: 7,
    color: "#64748B",
    marginBottom: 2,
  },
  markSheetInfoValue: {
    fontSize: 9,
    color: "#1E293B",
    fontWeight: 600,
  },
  markSheetTable: {
    marginBottom: 15,
  },
  markSheetTableHeader: {
    flexDirection: "row",
    backgroundColor: "#1E40AF",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  markSheetHeaderCell: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  markSheetTableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottom: "1px solid #E2E8F0",
  },
  markSheetTableCell: {
    fontSize: 8,
    color: "#1E293B",
  },
  markSheetTableFooter: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTop: "2px solid #1E40AF",
  },
  markSheetResultSection: {
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 6,
    marginBottom: 15,
    border: "1px solid #86EFAC",
  },
  markSheetResultGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  markSheetResultItem: {
    alignItems: "center",
  },
  markSheetResultLabel: {
    fontSize: 7,
    color: "#166534",
    marginBottom: 3,
  },
  markSheetResultValue: {
    fontSize: 14,
    fontWeight: 700,
    color: "#15803D",
  },
  markSheetFooter: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1px solid #E2E8F0",
    paddingTop: 20,
  },
  markSheetSignature: {
    alignItems: "center",
  },
  markSheetSignatureLine: {
    width: 150,
    borderTop: "1px solid #1E293B",
    marginBottom: 5,
  },
  markSheetSignatureText: {
    fontSize: 8,
    color: "#64748B",
  },
  markSheetDisclaimer: {
    fontSize: 6,
    color: "#94A3B8",
    textAlign: "center" as const,
    marginTop: 15,
    fontStyle: "italic",
  },
});

export const StudentIDCardTemplate: React.FC<StudentIDCardProps> = ({ student, school }) => (
  <Document>
    <Page size="A4" style={styles.idCardPage}>
      {/* Generate 4 ID cards per page */}
      {[0, 1, 2, 3].map((_, index) => (
        <View key={index} style={styles.idCard}>
          {/* Header */}
          <View style={styles.idCardHeader}>
            {school.logoUrl ? (
              <Image src={school.logoUrl} style={styles.idCardLogo} />
            ) : (
              <View style={styles.idCardLogo}>
                <Text style={{ fontSize: 20, textAlign: "center" }}>🏫</Text>
              </View>
            )}
            <Text style={styles.idCardSchoolName}>{school.name.toUpperCase()}</Text>
            <Text style={styles.idCardBadge}>ID CARD</Text>
          </View>

          {/* Body */}
          <View style={styles.idCardBody}>
            <View style={styles.idCardPhotoSection}>
              {student.photoUrl ? (
                <Image src={student.photoUrl} style={styles.idCardPhoto} />
              ) : (
                <View style={styles.idCardPhotoPlaceholder}>
                  <Text style={styles.idCardPhotoPlaceholderText}>Photo</Text>
                </View>
              )}
              <View style={styles.idCardInfo}>
                <Text style={styles.idCardStudentName}>{student.name}</Text>
                
                <View style={styles.idCardRow}>
                  <Text style={styles.idCardLabel}>Admission No:</Text>
                  <Text style={styles.idCardValue}>{student.admissionNumber}</Text>
                </View>
                
                <View style={styles.idCardRow}>
                  <Text style={styles.idCardLabel}>Roll Number:</Text>
                  <Text style={styles.idCardValue}>{student.rollNumber}</Text>
                </View>
                
                <View style={styles.idCardRow}>
                  <Text style={styles.idCardLabel}>Class:</Text>
                  <Text style={styles.idCardValue}>{student.className} - {student.section}</Text>
                </View>
                
                <View style={styles.idCardRow}>
                  <Text style={styles.idCardLabel}>Date of Birth:</Text>
                  <Text style={styles.idCardValue}>{student.dateOfBirth}</Text>
                </View>

                {student.bloodGroup && (
                  <View style={styles.idCardRow}>
                    <Text style={styles.idCardLabel}>Blood Group:</Text>
                    <Text style={styles.idCardValue}>{student.bloodGroup}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Footer Info */}
            <View style={styles.idCardFooter}>
              <View style={styles.idCardFooterRow}>
                <Text style={styles.idCardFooterLabel}>Guardian:</Text>
                <Text style={styles.idCardFooterValue}>{student.guardianName}</Text>
              </View>
              <View style={styles.idCardFooterRow}>
                <Text style={styles.idCardFooterLabel}>Contact:</Text>
                <Text style={styles.idCardFooterValue}>{student.guardianContact}</Text>
              </View>
              <View style={styles.idCardFooterRow}>
                <Text style={styles.idCardFooterLabel}>Academic Year:</Text>
                <Text style={styles.idCardFooterValue}>{student.academicYear}</Text>
              </View>
            </View>

            {/* Bottom Section */}
            <View style={styles.idCardBottom}>
              <Text style={styles.idCardSignature}>Principal Signature</Text>
              <View style={styles.idCardQR}>
                <Text style={styles.idCardQRText}>QR</Text>
              </View>
            </View>
          </View>
        </View>
      ))}
    </Page>
  </Document>
);

export { styles };
