"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Save, Calendar } from "lucide-react";
import { useExam, useUpdateExam } from "@/hooks/use-exams";
import { useAcademicYears } from "@/hooks/use-queries";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useRouter, useParams } from "next/navigation";
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
  classId: string;
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

export default function EditExamPage() {
  const t = useTranslations('exams');
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const examId = params?.id;
  const { formatDate } = useTenantFormatting();

  const { data: examData, isLoading: isExamLoading, error: examError } = useExam(examId || "");
  const { data: academicYearsData } = useAcademicYears();
  const updateExam = useUpdateExam();

  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjectSelectionByClass, setSubjectSelectionByClass] = useState<Record<string, string[]>>({});
  const [hasAutoSelectedClass, setHasAutoSelectedClass] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const { data: classesData = [] } = useQuery<ClassOption[]>({
    queryKey: ["classes-for-exams-edit"],
    queryFn: async (): Promise<ClassOption[]> => {
      const response = await api.get<ClassOption>("/api/classes?limit=100");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const { data: classSubjects = [], isLoading: isClassSubjectsLoading } = useQuery<ClassSubjectOption[]>({
    queryKey: ["exam-class-subjects-edit", selectedClassId],
    queryFn: async (): Promise<ClassSubjectOption[]> => {
      if (!selectedClassId) return [];
      const response = await api.get<ClassSubjectOption[]>(`/api/class-subjects?classId=${selectedClassId}`) as ApiSuccessResponse<ClassSubjectOption[]>;
      return response.data || [];
    },
    enabled: !!selectedClassId,
  });

  // Extract data from API response structure FIRST (before the query that depends on it)
  const academicYears = (Array.isArray(academicYearsData)
    ? academicYearsData
    : academicYearsData?.data ?? []) as AcademicYearOption[];
  const classes = classesData;

  // Fetch all classes with their subjects to find matching class for saved subjects
  const { data: allClassSubjectsData } = useQuery<Map<string, ClassSubjectOption[]>>({
    queryKey: ["all-classes-subjects-for-edit"],
    queryFn: async () => {
      // Fetch subjects for each class
      const classSubjectsMap = new Map<string, ClassSubjectOption[]>();

      for (const classItem of classes) {
        try {
          const response = await api.get<ClassSubjectOption[]>(`/api/class-subjects?classId=${classItem.id}`) as ApiSuccessResponse<ClassSubjectOption[]>;
          classSubjectsMap.set(classItem.id, response.data || []);
        } catch (error) {
          console.error(`Failed to fetch subjects for class ${classItem.name}:`, error);
        }
      }

      return classSubjectsMap;
    },
    enabled: !!examData && classes.length > 0 && !hasAutoSelectedClass,
  });

  const [formData, setFormData] = useState({
    academicYearId: "",
    name: "",
    type: "MID_TERM" as typeof EXAM_TYPES[number]["value"],
    startDate: "",
    endDate: "",
    isPublished: false,
  });

  // Get selected subjects - either from current class selection or default (prefilled)
  const selectedSubjectIds = selectedClassId
    ? (subjectSelectionByClass[selectedClassId] ?? classSubjects.map((item) => item.subjectId))
    : (subjectSelectionByClass.default ?? []);

  // Load exam data and auto-select class based on saved subjects
  useEffect(() => {
    if (examData && allClassSubjectsData && allClassSubjectsData.size > 0 && !hasAutoSelectedClass && !isDataLoaded) {
      try {
        // The exam data is directly in examData
        const exam = examData as any;

        console.log('=== LOADING EXAM DATA ===');
        console.log('Exam:', exam);
        console.log('Exam subjects:', exam.subjects);
        console.log('All class subjects map:', allClassSubjectsData);

        // Prefill form data with existing exam data
        setFormData({
          academicYearId: exam.academicYearId || "",
          name: exam.name || "",
          type: exam.type || "MID_TERM",
          startDate: exam.startDate ? exam.startDate.split('T')[0] : "",
          endDate: exam.endDate ? exam.endDate.split('T')[0] : "",
          isPublished: exam.isPublished || false,
        });

        console.log('Form data set:', formData);

        // Get saved subject IDs from exam
        if (exam.subjects && exam.subjects.length > 0) {
          const savedSubjectIds = exam.subjects.map((s: any) => s.subjectId || s.subject?.subjectId).filter(Boolean);
          console.log('Saved subject IDs:', savedSubjectIds);

          // Find class with most matching subjects
          let bestMatchingClassId = "";
          let maxMatchCount = 0;

          allClassSubjectsData.forEach((subjects, classId) => {
            const subjectIds = subjects.map(s => s.subjectId);
            const matchCount = subjectIds.filter(id => savedSubjectIds.includes(id)).length;
            console.log(`Class ${classId}: ${matchCount} matches out of ${subjects.length} subjects`);
            if (matchCount > maxMatchCount) {
              maxMatchCount = matchCount;
              bestMatchingClassId = classId;
            }
          });

          console.log('Best matching class:', bestMatchingClassId, 'with', maxMatchCount, 'matches');

          // Auto-select the best matching class
          if (bestMatchingClassId) {
            setSelectedClassId(bestMatchingClassId);

            // Pre-select the matching subjects for this class
            const matchingSubjects = allClassSubjectsData.get(bestMatchingClassId) || [];
            const matchingSubjectIds = matchingSubjects
              .filter(s => savedSubjectIds.includes(s.subjectId))
              .map(s => s.subjectId);

            console.log('Setting selected subjects:', matchingSubjectIds);

            setSubjectSelectionByClass({
              [bestMatchingClassId]: matchingSubjectIds,
              default: savedSubjectIds,
            });

            setHasAutoSelectedClass(true);
            setIsDataLoaded(true);
            console.log('=== DATA LOADED SUCCESSFULLY ===');
          } else {
            // If no matching class found, just store the subject IDs
            console.log('No matching class found, storing default subjects');
            setSubjectSelectionByClass({
              default: savedSubjectIds,
            });
            setIsDataLoaded(true);
          }
        } else {
          console.log('No exam subjects found');
          setIsDataLoaded(true);
        }
      } catch (error) {
        console.error('Error loading exam data:', error);
        setIsDataLoaded(true);
      }
    }
  }, [examData, allClassSubjectsData, hasAutoSelectedClass, isDataLoaded]);

  function handleSubjectToggle(subjectId: string) {
    if (!selectedClassId) {
      // If no class selected, toggle in default
      setSubjectSelectionByClass((current) => {
        const currentSelection = current.default ?? [];
        const nextSelection = currentSelection.includes(subjectId)
          ? currentSelection.filter((id) => id !== subjectId)
          : [...currentSelection, subjectId];

        return {
          ...current,
          default: nextSelection,
        };
      });
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

    if (!formData.academicYearId || !formData.name) {
      toast.error(t('fillRequiredFields'));
      return;
    }

    // Get subjects from either current class selection or default (prefilled)
    const subjectsToUse = selectedClassId
      ? classSubjects.filter((subject) => selectedSubjectIds.includes(subject.subjectId))
      : classSubjects; // If no class selected, use all class subjects that match prefilled IDs

    const subjects = subjectsToUse
      .filter((subject) => selectedSubjectIds.includes(subject.subjectId))
      .map((subject) => ({
        subjectId: subject.subjectId,
        maxMarks: subject.subject.maxMarks,
        passMarks: subject.subject.passMarks,
      }));

    if (subjects.length === 0 && selectedClassId) {
      toast.error(t('subjectsRequired'));
      return;
    }

    updateExam.mutate(
      {
        id: examId!,
        data: {
          ...formData,
          subjects: subjects.length > 0 ? subjects : undefined
        }
      },
      {
        onSuccess: () => {
          toast.success(t('examUpdatedSuccessfully'));
          router.push('/exams');
        },
        onError: (error: Error) => {
          toast.error(error.message || t('examUpdateFailed'));
        },
      }
    );
  }

  if (isExamLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">{t('loadingExam')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!examData) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">{t('examNotFound')}</h2>
          <p className="text-muted-foreground mb-6">{t('examNotFoundDescription')}</p>
          <Button onClick={() => router.push('/exams')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToExams')}
          </Button>
        </div>
      </div>
    );
  }

  // examData is already the exam object (not wrapped)
  const exam = examData;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push('/exams')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('editExam')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('editExamDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Edit Exam Form */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-6 space-y-6">
          <div className="grid gap-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="examId">{t('examId')}</Label>
                <Input
                  id="examId"
                  value={exam.examId || t('autoGenerated')}
                  readOnly
                  disabled
                  className="bg-muted"
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
              <Label htmlFor="classId">{t('class')}</Label>
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
                  onValueChange={(value: typeof EXAM_TYPES[number]["value"]) => setFormData({ ...formData, type: value })}
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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.push('/exams')}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={updateExam.isPending}
              onClick={handleSubmit}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateExam.isPending ? t('saving') : t('saveChanges')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
