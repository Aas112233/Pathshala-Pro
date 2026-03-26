"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SubjectResult {
  subject: string;
  subjectCode: string;
  maxMarks: number;
  obtainedMarks: number;
  passMarks: number;
  grade: string;
  gradePoint: number;
  remarks?: string;
}

interface TermResult {
  termName: string;
  subjects: SubjectResult[];
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  rank?: number;
  totalStudents?: number;
}

interface AttendanceRecord {
  month: string;
  present: number;
  total: number;
}

interface CoCurricularActivity {
  activity: string;
  grade: string;
  remarks?: string;
}

interface ReportCardGeneratorProps {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    section: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup?: string;
    guardianName: string;
    guardianContact: string;
    address?: string;
    photoUrl?: string;
  };
  academicYears: string[];
  terms: TermResult[];
  attendance: AttendanceRecord[];
  coCurricular?: CoCurricularActivity[];
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
}

export function ReportCardGenerator({
  student,
  academicYears,
  terms,
  attendance,
  coCurricular,
  school,
}: ReportCardGeneratorProps) {
  const { exportReportCard } = usePDFExport();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(academicYears[0] || "");
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [principalRemarks, setPrincipalRemarks] = useState("");

  const handleGenerate = async () => {
    if (!selectedYear) {
      toast.error("Please select an academic year");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await exportReportCard(
        {
          name: student.name,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
          className: student.className,
          section: student.section,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          bloodGroup: student.bloodGroup,
          guardianName: student.guardianName,
          guardianContact: student.guardianContact,
          address: student.address,
          photoUrl: student.photoUrl,
        },
        selectedYear,
        terms,
        attendance,
        coCurricular,
        teacherRemarks || undefined,
        principalRemarks || undefined,
        school
      );

      if (result.success) {
        toast.success("Report card generated successfully");
        setIsOpen(false);
      } else {
        toast.error("Failed to generate report card");
      }
    } catch (error) {
      toast.error("Failed to generate report card");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Generate Report Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Report Card</DialogTitle>
          <DialogDescription>
            Generate a comprehensive report card for {student.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label>Academic Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Choose academic year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Teacher's Remarks (Optional)</Label>
            <Textarea
              value={teacherRemarks}
              onChange={(e) => setTeacherRemarks(e.target.value)}
              placeholder="Enter teacher's remarks about the student's performance..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Principal's Remarks (Optional)</Label>
            <Textarea
              value={principalRemarks}
              onChange={(e) => setPrincipalRemarks(e.target.value)}
              placeholder="Enter principal's remarks..."
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedYear}
              className="flex-1"
            >
              <FileText className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate Report Card"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            The report card will include:
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Student profile with photo</li>
              <li>Term-wise academic performance</li>
              <li>Attendance record</li>
              <li>Co-curricular activities</li>
              <li>Teacher and principal remarks</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
