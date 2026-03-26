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

interface Mark {
  subject: string;
  subjectCode: string;
  maxMarks: number;
  obtainedMarks: number;
  passMarks: number;
  grade: string;
  gradePoint: number;
  remarks?: string;
}

interface MarkSheetGeneratorProps {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    section: string;
    dateOfBirth: string;
    gender?: string;
    guardianName: string;
    guardianContact: string;
  };
  exams: {
    id: string;
    name: string;
    type: string;
    academicYear: string;
    date: string;
  }[];
  getMarksForExam: (examId: string) => Mark[];
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
}

export function MarkSheetGenerator({
  student,
  exams,
  getMarksForExam,
  school,
}: MarkSheetGeneratorProps) {
  const { exportMarkSheet } = usePDFExport();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>("");

  const handleGenerate = async () => {
    if (!selectedExamId) {
      toast.error("Please select an exam");
      return;
    }

    const exam = exams.find(e => e.id === selectedExamId);
    if (!exam) return;

    const marks = getMarksForExam(selectedExamId);
    if (marks.length === 0) {
      toast.error("No marks found for this exam");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await exportMarkSheet(
        {
          name: student.name,
          admissionNumber: student.admissionNumber,
          rollNumber: student.rollNumber,
          className: student.className,
          section: student.section,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender || "Not specified",
          guardianName: student.guardianName,
          guardianContact: student.guardianContact,
        },
        {
          name: exam.name,
          type: exam.type,
          academicYear: exam.academicYear,
          date: exam.date,
        },
        marks,
        school
      );

      if (result.success) {
        toast.success("Mark sheet generated successfully");
        setIsOpen(false);
      } else {
        toast.error("Failed to generate mark sheet");
      }
    } catch (error) {
      toast.error("Failed to generate mark sheet");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Generate Mark Sheet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Mark Sheet</DialogTitle>
          <DialogDescription>
            Select an exam to generate the mark sheet for {student.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Exam</label>
            <Select value={selectedExamId} onValueChange={setSelectedExamId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.name} ({exam.academicYear})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedExamId}
            className="w-full"
          >
            <FileText className="mr-2 h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate Mark Sheet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
