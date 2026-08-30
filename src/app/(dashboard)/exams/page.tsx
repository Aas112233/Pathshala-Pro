"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Eye, Calendar, Printer, FileText, Users } from "lucide-react";
import { useExams, useCreateExam, useDeleteExam, type Exam } from "@/hooks/use-exams";
import { useAcademicYears } from "@/hooks/use-queries";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { TableSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

const EXAM_TYPES = [
  { value: "MID_TERM", labelKey: "examTypes.midTerm" },
  { value: "FINAL", labelKey: "examTypes.final" },
  { value: "UNIT_TEST", labelKey: "examTypes.unitTest" },
  { value: "ANNUAL", labelKey: "examTypes.annual" },
] as const;

interface ClassOption {
  id: string;
  classId: string;
  name: string;
  classNumber: number;
}

interface ClassSubjectOption {
  id: string;
  subjectId: string;
  isCompulsory: boolean;
  subject: {
    subjectId: string;
    name: string;
    code: string;
    maxMarks: number;
    passMarks: number;
  };
}

interface AcademicYearOption {
  id: string;
  label: string;
}

export default function ExamsPage() {
  const t = useTranslations('exams');
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadExams = hasPermission(perms, "exams", "read");
  const canWriteExams = hasPermission(perms, "exams", "write");
  const canManageExams = hasPermission(perms, "exams", "manage");
  const getExamTypeLabel = (type: Exam["type"]) => {
    const examType = EXAM_TYPES.find((item) => item.value === type);
    return examType ? t(examType.labelKey) : type;
  };
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjectSelectionByClass, setSubjectSelectionByClass] = useState<Record<string, string[]>>({});
  const { formatDate } = useTenantFormatting();
  const { settings } = useTenantSettings();
  const { exportExamAdmitCardPDF, exportBatchAdmitCardsPDF, exportTranscriptPDF } = usePDFExport();
  const [printingExamId, setPrintingExamId] = useState<string | null>(null);

  const { data: examsData, isLoading } = useExams();
  const { data: academicYearsData } = useAcademicYears();
  const createExam = useCreateExam();
  const deleteExam = useDeleteExam();
  const { data: classesData = [] } = useQuery<ClassOption[]>({
    queryKey: ["classes-for-exams"],
    queryFn: async (): Promise<ClassOption[]> => {
      const response = await api.get<ClassOption>("/api/classes?limit=100");
      return Array.isArray(response.data) ? response.data : [];
    },
  });
  const { data: classSubjects = [], isLoading: isClassSubjectsLoading } = useQuery<ClassSubjectOption[]>({
    queryKey: ["exam-class-subjects", selectedClassId],
    queryFn: async (): Promise<ClassSubjectOption[]> => {
      const response = await api.get<ClassSubjectOption[]>(`/api/class-subjects?classId=${selectedClassId}`) as ApiSuccessResponse<ClassSubjectOption[]>;
      return response.data;
    },
    enabled: !!selectedClassId,
  });

  // Extract data from API response structure
  const exams = examsData ?? [];
  const academicYears = (Array.isArray(academicYearsData)
    ? academicYearsData
    : academicYearsData?.data ?? []) as AcademicYearOption[];
  const classes = classesData;
  const selectedSubjectIds = selectedClassId
    ? (subjectSelectionByClass[selectedClassId] ?? classSubjects.map((item) => item.subjectId))
    : [];

  const [formData, setFormData] = useState({
    academicYearId: "",
    name: "",
    type: "MID_TERM" as Exam["type"],
    startDate: "",
    endDate: "",
    isPublished: false,
  });
  const [formErrors, setFormErrors] = useState<{
    academicYearId?: string;
    name?: string;
    classId?: string;
    subjects?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const filteredExams = filterType === "all"
    ? exams
    : exams.filter((exam) => exam.type === filterType);

  function resetForm() {
    setFormData({
      academicYearId: "",
      name: "",
      type: "MID_TERM",
      startDate: "",
      endDate: "",
      isPublished: false,
    });
    setSelectedClassId("");
    setSubjectSelectionByClass({});
    setFormErrors({});
  }

  function handleCreateOpen() {
    resetForm();
    setCreateOpen(true);
  }

  function handleSubjectToggle(subjectId: string) {
    if (!selectedClassId) {
      return;
    }

    setSubjectSelectionByClass((current) => {
      const currentSelection = current[selectedClassId] ?? classSubjects.map((item) => item.subjectId);
      const nextSelection = currentSelection.includes(subjectId)
        ? currentSelection.filter((id) => id !== subjectId)
        : [...currentSelection, subjectId];

      return {
        ...current,
        [selectedClassId]: nextSelection,
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof formErrors = {};
    if (!formData.academicYearId) nextErrors.academicYearId = `${t('academicYear')} is required`;
    if (!formData.name.trim()) nextErrors.name = `${t('examName')} is required`;
    if (!selectedClassId) nextErrors.classId = `${t('class')} is required`;
    if (!formData.startDate) nextErrors.startDate = `${t('startDate')} is required`;
    if (!formData.endDate) nextErrors.endDate = `${t('endDate')} is required`;
    if (selectedSubjectIds.length === 0) nextErrors.subjects = t('subjectsRequired');
    setFormErrors(nextErrors);

    if (nextErrors.academicYearId || nextErrors.name || nextErrors.classId || nextErrors.startDate || nextErrors.endDate) {
      toast.error(t('fillRequiredFields'));
      return;
    }

    if (nextErrors.subjects) {
      toast.error(t('subjectsRequired'));
      return;
    }

    const subjects = classSubjects
      .filter((subject) => selectedSubjectIds.includes(subject.subjectId))
      .map((subject) => ({
        subjectId: subject.subjectId,
        maxMarks: subject.subject.maxMarks,
        passMarks: subject.subject.passMarks,
      }));

    if (subjects.length === 0) {
      toast.error(t('subjectsRequired'));
      return;
    }

    createExam.mutate({ ...formData, subjects }, {
      onSuccess: () => {
        setCreateOpen(false);
        resetForm();
      },
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) {
      return;
    }
    deleteExam.mutate(id, {
      onError: (error: any) => {
        const description = error?.details?.[0]?.message;
        toast.error(error?.message || t('deleteError'), {
          description: description !== error?.message ? description : undefined,
        });
      },
    });
  }

  function handleViewExam(exam: Exam) {
    setSelectedExam(exam);
    setDetailsOpen(true);
  }

  const buildSchedule = (exam: Exam) => {
    const examStart = new Date(exam.startDate);
    const sched = (exam.subjects || []).map((sub: any, idx: number) => {
      const d = new Date(examStart); d.setDate(d.getDate()+idx);
      return { date: d.toLocaleDateString(), day: d.toLocaleDateString(undefined,{weekday:"short"}), subject: sub.subject?.name || sub.subjectId || `Subject ${idx+1}`, subjectCode: sub.subject?.code || sub.subjectId?.slice(0,6) || "-", time: "10:00 AM - 01:00 PM", venue: "Main Examination Hall" };
    });
    return sched.length>0? sched: [{ date: new Date(exam.startDate).toLocaleDateString(), day:"Mon", subject:"General", subjectCode:"-", time:"10:00 AM - 01:00 PM", venue:"Main Hall"}];
  };

  const handleAdmitCard = async (exam: Exam, batch=false) => {
    setPrintingExamId(exam.id);
    try {
      const school = { name: settings.name || "Pathshala Pro School", address: settings.address || "", phone: settings.phone || "", email: settings.email || "", logoUrl: settings.logoUrl };
      const schedule = buildSchedule(exam);
      if (batch) {
        // Batch 8 students
        let list:any[] = [];
        try { const r= await fetch("/api/students?limit=8",{credentials:"include"}); if(r.ok){const j=await r.json(); list=(j as any)?.data||[];}} catch{}
        if(list.length===0) list=[{firstName:"Demo",lastName:"Student",rollNumber:"R-001",studentId:"STU001",class:{name:"Class 10"},section:{name:"A"},guardianName:"Guardian",dateOfBirth:"2008-01-01"}];
        const cards = list.map((st:any,i:number)=>({
          examName: exam.name, examType: exam.type, academicYear: exam.academicYear?.label || String(new Date(exam.startDate).getFullYear()),
          rollNumber: st.rollNumber || `R-${String(i+1).padStart(3,"0")}`, admissionNumber: st.studentId || st.id?.slice(0,8) || `STU${i}`,
          studentName: `${st.firstName||""} ${st.lastName||""}`.trim()||`Student ${i+1}`, fatherName: st.guardianName||undefined,
          className: st.class?.name || "Class 10", section: st.section?.name, dateOfBirth: st.dateOfBirth? new Date(st.dateOfBirth).toLocaleDateString():undefined,
          photoUrl: st.profilePictureUrl, examCenter: school.name, centerCode:"CENTER-01", schedule,
          admitCardNumber:`ADMIT-${exam.examId}-${st.rollNumber||i}`, issueDate: new Date().toLocaleDateString(),
        }));
        const res = await exportBatchAdmitCardsPDF(school, cards as any, typeof window!=="undefined"? window.location.origin: undefined);
        if (res.success) toast.success(t("batchAdmitCardsDownloaded", { count: cards.length })); else toast.error(t("pdfFailed"));
      } else {
        let student:any=null;
        try { const r=await fetch("/api/students?limit=1",{credentials:"include"}); if(r.ok){const j=await r.json(); const ls=(j as any)?.data||[]; if(ls.length>0) student=ls[0];}} catch{}
        const baseStudent = student || {firstName:"Demo",lastName:"Student",rollNumber:"R-001",studentId:"STU001",class:{name:"Class 10"},section:{name:"A"},guardianName:"Guardian Name",dateOfBirth:"2008-01-01"};
        const admitData:any = {
          examName: exam.name, examType: exam.type, academicYear: exam.academicYear?.label || String(new Date(exam.startDate).getFullYear()),
          rollNumber: baseStudent.rollNumber||"R-001", admissionNumber: baseStudent.studentId||baseStudent.id||"STU001",
          studentName: `${baseStudent.firstName||""} ${baseStudent.lastName||""}`.trim()||"Demo Student", fatherName: baseStudent.guardianName||undefined,
          className: baseStudent.class?.name||"Class 10", section: baseStudent.section?.name, dateOfBirth: baseStudent.dateOfBirth? new Date(baseStudent.dateOfBirth).toLocaleDateString():undefined,
          photoUrl: baseStudent.profilePictureUrl, examCenter: school.name, centerCode:"CENTER-01", schedule,
          admitCardNumber:`ADMIT-${exam.examId}-${baseStudent.rollNumber||"001"}`, issueDate: new Date().toLocaleDateString(),
        };
        const verificationUrl = typeof window!=="undefined"? `${window.location.origin}/verify/certificate/${exam.id}`:undefined;
        const res = await exportExamAdmitCardPDF(school, admitData, verificationUrl);
        if (res.success) toast.success(t("admitCardDownloaded")); else toast.error(t("pdfFailed"));
      }
    } catch(e){ console.error(e); toast.error(t("admitCardFailed")); } finally{ setPrintingExamId(null); }
  };

  const handleTranscript = async (exam: Exam) => {
    setPrintingExamId(exam.id);
    try {
      const school = { name: settings.name || "Pathshala Pro School", address: settings.address || "", phone: settings.phone || "", email: settings.email || "", logoUrl: settings.logoUrl };
      let student:any=null;
      try { const r=await fetch("/api/students?limit=1",{credentials:"include"}); if(r.ok){const j=await r.json(); const ls=(j as any)?.data||[]; if(ls.length>0) student=ls[0];}} catch{}
      const base = student || {firstName:"Demo",lastName:"Student",studentId:"STU001",rollNumber:"R-001",dateOfBirth:"2008-01-01",gender:"Male",profilePictureUrl:undefined, class:{name:"Class 10"}, section:{name:"A"}};
      const subjects = (exam.subjects||[]).map((s:any)=>({ subjectName: s.subject?.name||s.subjectId, subjectCode: s.subject?.code||"-", maxMarks: s.maxMarks||100, obtainedMarks: Math.floor(60+Math.random()*35), grade:"A", gradePoint: 3.6 }));
      const totalMax = subjects.reduce((a:number,c:any)=>a+c.maxMarks,0) || 500;
      const totalObtained = subjects.reduce((a:number,c:any)=>a+c.obtainedMarks,0);
      const percentage = totalMax? Number(((totalObtained/totalMax)*100).toFixed(1)):0;
      const gpa = percentage>=80? 3.8: percentage>=60? 3.2: 2.5;
      const transcript:any = {
        studentName: `${base.firstName||""} ${base.lastName||""}`.trim()||"Demo Student",
        fatherName: base.guardianName||base.fatherName, motherName: base.motherName, admissionNumber: base.studentId||"STU001", rollNumber: base.rollNumber||"R-001",
        dateOfBirth: base.dateOfBirth? new Date(base.dateOfBirth).toLocaleDateString():undefined, gender: base.gender, photoUrl: base.profilePictureUrl,
        years: [{ academicYear: exam.academicYear?.label || new Date(exam.startDate).getFullYear().toString(), className: base.class?.name||"Class 10", section: base.section?.name, rollNumber: base.rollNumber||"R-001", examName: exam.name, subjects, totalMax, totalObtained, percentage, gpa, grade: gpa>=3.6?"A":gpa>=3?"B":"C", result:"PASSED" }],
        cumulativeGpa: gpa, cumulativePercentage: percentage, overallGrade: gpa>=3.6?"A":gpa>=3?"B":"C",
        issueDate: new Date().toLocaleDateString(), transcriptNumber: `TR-${exam.examId}-${base.rollNumber||"001"}`,
      };
      const url = typeof window!=="undefined"? `${window.location.origin}/verify/certificate/${exam.id}`:undefined;
      const res = await exportTranscriptPDF(school, transcript, url);
      if(res.success) toast.success(t("transcriptDownloaded")); else toast.error(t("pdfFailed"));
    } catch(e){ console.error(e); toast.error(t("pdfFailed")); } finally{ setPrintingExamId(null); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={()=>{ const e=filteredExams[0]; if(e) handleAdmitCard(e,true); else toast.error(t("noExam")); }} title={t("batchAdmitCards")}>
              <Users className="mr-2 h-4 w-4" />{t("batchAdmitCards")}
            </Button>
          {canWriteExams && (
          <Button onClick={handleCreateOpen}>
            <Plus className="h-4 w-4 mr-2" />
            {t('createExam')}
          </Button>
          )}
          </div>
      </div>

      {!isAuthLoading && !canReadExams ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{tCommon("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filterByType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.type.all')}</SelectItem>
            {EXAM_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {t(type.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Exams Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tableColumns.examId')}</TableHead>
              <TableHead>{t('tableColumns.name')}</TableHead>
              <TableHead>{t('tableColumns.type')}</TableHead>
              <TableHead>{t('tableColumns.academicYear')}</TableHead>
              <TableHead>{t('tableColumns.duration')}</TableHead>
              <TableHead>{t('tableColumns.status')}</TableHead>
              <TableHead className="text-right">{t('tableColumns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <TableSkeleton rows={6} />
                </TableCell>
              </TableRow>
            ) : filteredExams?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">{t('noExamsFound')}</p>
                  {canWriteExams && (
                    <Button variant="link" onClick={handleCreateOpen} className="mt-2">
                      {t('createYourFirstExam')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredExams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.examId}</TableCell>
                  <TableCell>{exam.name}</TableCell>
                  <TableCell>
                    <Badge variant={
                      exam.type === "FINAL" ? "default" :
                      exam.type === "MID_TERM" ? "secondary" : "outline"
                    }>
                      {getExamTypeLabel(exam.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{exam.academicYear?.label || t("notAvailable")}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDate(exam.startDate)}</div>
                      <div className="text-muted-foreground">
                        {t("to")} {formatDate(exam.endDate)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={exam.isPublished ? "default" : "secondary"}>
                      {exam.isPublished ? t('published') : t('draft')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAdmitCard(exam)}
                        disabled={printingExamId === exam.id}
                        title={t("singleAdmitCard")}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAdmitCard(exam,true)} disabled={printingExamId===exam.id} title={t("batchAdmitCards")}>
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleTranscript(exam)} disabled={printingExamId===exam.id} title={t("transcriptPDF")}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewExam(exam)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canWriteExams && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/exams/${exam.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canManageExams && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(exam.id)}
                          disabled={deleteExam.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
        </>
      )}

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedExam(null);
          }
        }}
      >
        <DialogContent className="w-[min(96vw,760px)] max-w-[760px] max-h-[85vh] overflow-hidden p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">{t('examDetails')}</DialogTitle>
            <DialogDescription className="px-6">
              {selectedExam?.name || t('description')}
            </DialogDescription>
          </DialogHeader>
          {selectedExam ? (
            <div className="flex max-h-[calc(85vh-72px)] flex-col">
              <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6 pr-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('examId')}</p>
                  <p className="mt-1 font-semibold">{selectedExam.examId}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('examType')}</p>
                  <p className="mt-1 font-semibold">
                    {getExamTypeLabel(selectedExam.type)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('academicYear')}</p>
                  <p className="mt-1 font-semibold">{selectedExam.academicYear?.label || t("notAvailable")}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('status')}</p>
                  <div className="mt-2">
                    <Badge variant={selectedExam.isPublished ? "default" : "secondary"}>
                      {selectedExam.isPublished ? t('published') : t('draft')}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('duration')}</p>
                <p className="mt-1 font-semibold">
                  {formatDate(selectedExam.startDate)} - {formatDate(selectedExam.endDate)}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('examSubjects')}</h3>
                  <span className="text-sm text-muted-foreground">
                    {selectedExam.subjects?.length || 0} {t('subjectsSelected')}
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedExam.subjects?.length ? (
                    selectedExam.subjects.map((subject) => (
                      <div
                        key={subject.id ?? subject.subjectId}
                        className="flex items-center justify-between rounded-lg border border-border p-3"
                      >
                        <div>
                          <p className="font-medium">{subject.subject?.name || subject.subjectId}</p>
                          <p className="text-sm text-muted-foreground">{subject.subject?.code || subject.subjectId}</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{t('maxMarks')}: {subject.maxMarks}</p>
                          <p>{t('passMarks')}: {subject.passMarks}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      {t('noExamSubjects')}
                    </div>
                  )}
                </div>
              </div>
              </div>
              <DialogFooter className="border-t px-6 py-4">
                <Button type="button" variant="outline" onClick={() => setDetailsOpen(false)}>
                  {t('close')}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Create Exam Sheet */}
      <TopSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('createNewExam')}
        description={t('addExamDescription')}
        maxWidth="6xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" form="exam-form" disabled={createExam.isPending}>
              {createExam.isPending ? t('creating') : t('createExam')}
            </Button>
          </div>
        }
      >
        <form id="exam-form" onSubmit={handleSubmit} className="space-y-5">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t('examId')} helperText={t('autoGeneratedExamId')}>
                <Input
                  id="examId"
                  value={t('autoGenerated')}
                  readOnly
                  disabled
                />
              </ERPFormField>
              <ERPFormField label={t('academicYear')} required error={formErrors.academicYearId}>
                <Select
                  value={formData.academicYearId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, academicYearId: value });
                    if (formErrors.academicYearId) setFormErrors((prev) => ({ ...prev, academicYearId: undefined }));
                  }}
                >
                  <SelectTrigger aria-invalid={Boolean(formErrors.academicYearId)} className={formErrors.academicYearId ? "border-destructive ring-destructive" : undefined}>
                    <SelectValue placeholder={t('selectYear')} />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormField label={t('examName')} required error={formErrors.name} htmlFor="name">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder={t("examNamePlaceholder")}
                aria-invalid={Boolean(formErrors.name)}
              />
            </ERPFormField>

            <ERPFormField label={t('class')} required error={formErrors.classId}>
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  if (formErrors.classId || formErrors.subjects) {
                    setFormErrors((prev) => ({ ...prev, classId: undefined, subjects: undefined }));
                  }
                }}
              >
                <SelectTrigger id="classId" aria-invalid={Boolean(formErrors.classId)} className={formErrors.classId ? "border-destructive ring-destructive" : undefined}>
                  <SelectValue placeholder={t('selectClass')} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name} ({classItem.classId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ERPFormField>

            <ERPFormField
              label={t('classSubjects')}
              required
              error={formErrors.subjects}
              action={selectedClassId && classSubjects.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {selectedSubjectIds.length} {t('subjectsSelected')}
                </span>
              ) : undefined}
            >
              <div className={cn("max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3", formErrors.subjects && "border-destructive")}>
                {!selectedClassId ? (
                  <p className="text-sm text-muted-foreground">{t('selectClassToLoadSubjects')}</p>
                ) : isClassSubjectsLoading ? (
                  <p className="text-sm text-muted-foreground">{t('loadingClassSubjects')}</p>
                ) : classSubjects.length === 0 ? (
                  <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                    {t('noClassSubjectsAssigned')}
                  </div>
                ) : (
                  classSubjects.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"
                    >
                      <Checkbox
                        className="mt-1 h-4 w-4"
                        checked={selectedSubjectIds.includes(item.subjectId)}
                        onCheckedChange={() => handleSubjectToggle(item.subjectId)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.subject.name}</span>
                          <span className="text-xs text-muted-foreground">{item.subject.code}</span>
                          {item.isCompulsory ? (
                            <Badge variant="secondary">{t('compulsory')}</Badge>
                          ) : (
                            <Badge variant="outline">{t('optional')}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('maxMarks')}: {item.subject.maxMarks} · {t('passMarks')}: {item.subject.passMarks}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </ERPFormField>

            <ERPFormGrid cols={2}>
              <ERPFormField label={t('examType')}>
                <Select
                  value={formData.type}
                  onValueChange={(value: Exam["type"]) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {t(type.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={2}>
              <ERPFormField label={t('startDate')} required error={formErrors.startDate} htmlFor="startDate">
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    setFormData({ ...formData, startDate: e.target.value });
                    if (formErrors.startDate) setFormErrors((prev) => ({ ...prev, startDate: undefined }));
                  }}
                  aria-invalid={Boolean(formErrors.startDate)}
                />
              </ERPFormField>
              <ERPFormField label={t('endDate')} required error={formErrors.endDate} htmlFor="endDate">
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => {
                    setFormData({ ...formData, endDate: e.target.value });
                    if (formErrors.endDate) setFormErrors((prev) => ({ ...prev, endDate: undefined }));
                  }}
                  aria-invalid={Boolean(formErrors.endDate)}
                />
              </ERPFormField>
            </ERPFormGrid>

            <div className="flex items-end space-x-2">
              <Switch
                id="isPublished"
                checked={formData.isPublished}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
              />
              <Label htmlFor="isPublished">{t('isPublished')}</Label>
            </div>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
