"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Eye, Calendar } from "lucide-react";
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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

const EXAM_TYPES = [
  { value: "MID_TERM", label: "Mid-Term" },
  { value: "FINAL", label: "Final" },
  { value: "UNIT_TEST", label: "Unit Test" },
  { value: "ANNUAL", label: "Annual" },
];

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
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjectSelectionByClass, setSubjectSelectionByClass] = useState<Record<string, string[]>>({});
  const { formatDate } = useTenantFormatting();

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
    
    if (!formData.academicYearId || !formData.name || !selectedClassId) {
      toast.error(t('fillRequiredFields'));
      return;
    }

    if (selectedSubjectIds.length === 0) {
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
    deleteExam.mutate(id);
  }

  function handleViewExam(exam: Exam) {
    setSelectedExam(exam);
    setDetailsOpen(true);
  }

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
        <Button onClick={handleCreateOpen}>
          <Plus className="h-4 w-4 mr-2" />
          {t('createExam')}
        </Button>
      </div>

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
                {type.label}
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
                <TableCell colSpan={7} className="text-center py-8">
                  {t('loadingExams')}
                </TableCell>
              </TableRow>
            ) : filteredExams?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">{t('noExamsFound')}</p>
                  <Button variant="link" onClick={handleCreateOpen} className="mt-2">
                    {t('createYourFirstExam')}
                  </Button>
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
                      {EXAM_TYPES.find(t => t.value === exam.type)?.label || exam.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{exam.academicYear?.label || "N/A"}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDate(exam.startDate)}</div>
                      <div className="text-muted-foreground">
                        to {formatDate(exam.endDate)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={exam.isPublished ? "default" : "secondary"}>
                      {exam.isPublished ? t('published') : t('draft')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewExam(exam)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/exams/${exam.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(exam.id)}
                        disabled={deleteExam.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                    {EXAM_TYPES.find((type) => type.value === selectedExam.type)?.label || selectedExam.type}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('academicYear')}</p>
                  <p className="mt-1 font-semibold">{selectedExam.academicYear?.label || "N/A"}</p>
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

      {/* Create Exam Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[min(96vw,1100px)] max-w-[1100px] max-h-[90vh] overflow-hidden p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">{t('createNewExam')}</DialogTitle>
            <DialogDescription className="px-6">
              {t('addExamDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex max-h-[calc(90vh-72px)] flex-col">
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="grid gap-5 py-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="examId">{t('examId')}</Label>
                    <Input
                      id="examId"
                      value={t('autoGenerated')}
                      readOnly
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">{t('autoGeneratedExamId')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="academicYearId">{t('academicYear')} *</Label>
                    <Select
                      value={formData.academicYearId}
                      onValueChange={(value) => setFormData({ ...formData, academicYearId: value })}
                    >
                      <SelectTrigger>
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
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">{t('examName')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Mid-Term Examination 2025"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="classId">{t('class')} *</Label>
                  <Select
                    value={selectedClassId}
                    onValueChange={setSelectedClassId}
                  >
                    <SelectTrigger id="classId">
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
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('classSubjects')} *</Label>
                    {selectedClassId && classSubjects.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {selectedSubjectIds.length} {t('subjectsSelected')}
                      </span>
                    ) : null}
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3">
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
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={selectedSubjectIds.includes(item.subjectId)}
                            onChange={() => handleSubjectToggle(item.subjectId)}
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
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="type">{t('examType')}</Label>
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
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">{t('startDate')} *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">{t('endDate')} *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-end space-x-2 pb-2">
                    <Switch
                      id="isPublished"
                      checked={formData.isPublished}
                      onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                    />
                    <Label htmlFor="isPublished">{t('isPublished')}</Label>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={createExam.isPending}>
                {createExam.isPending ? t('creating') : t('createExam')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
