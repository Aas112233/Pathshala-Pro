"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { toast } from "sonner";
import { FileText, Download, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StudentIDCardGeneratorProps {
  student?: {
    id: string;
    name: string;
    admissionNumber: string;
    rollNumber: string;
    className: string;
    section: string;
    dateOfBirth: string;
    gender: string;
    bloodGroup?: string;
    photoUrl?: string;
    guardianName: string;
    guardianContact: string;
  };
  students?: typeof student[];
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
  };
  academicYear: string;
}

export function StudentIDCardGenerator({
  student,
  students,
  school,
  academicYear,
}: StudentIDCardGeneratorProps) {
  const { exportStudentIDCard, exportBulkIDCards } = usePDFExport();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleGenerateSingle = async () => {
    if (!student) return;
    
    setIsGenerating(true);
    try {
      const result = await exportStudentIDCard(
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
          photoUrl: student.photoUrl,
        },
        school,
        academicYear
      );

      if (result.success) {
        toast.success("ID card generated successfully");
      } else {
        toast.error("Failed to generate ID card");
      }
    } catch (error) {
      toast.error("Failed to generate ID card");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateBulk = async () => {
    if (!students || students.length === 0) return;
    
    setIsGenerating(true);
    try {
      const results = await exportBulkIDCards(
        students.map(s => ({
          name: s.name,
          admissionNumber: s.admissionNumber,
          rollNumber: s.rollNumber,
          className: s.className,
          section: s.section,
          dateOfBirth: s.dateOfBirth,
          gender: s.gender,
          bloodGroup: s.bloodGroup,
          guardianName: s.guardianName,
          guardianContact: s.guardianContact,
          photoUrl: s.photoUrl,
        })),
        school,
        academicYear
      );

      const successCount = results.filter(r => r.success).length;
      toast.success(`Generated ${successCount} of ${students.length} ID cards`);
    } catch (error) {
      toast.error("Failed to generate ID cards");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Generate ID Card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Student ID Card</DialogTitle>
          <DialogDescription>
            Generate ID cards for students. Cards will be generated in A4 format with 4 cards per page.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          {student && (
            <Button 
              onClick={handleGenerateSingle} 
              disabled={isGenerating}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating..." : `Generate ID Card for ${student.name}`}
            </Button>
          )}
          {students && students.length > 0 && (
            <Button 
              onClick={handleGenerateBulk} 
              disabled={isGenerating}
              variant="secondary"
              className="w-full"
            >
              <Users className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating..." : `Generate All (${students.length} cards)`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
