"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Trash2,
  ArrowLeft,
  Search,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  HelpCircle,
  GripVertical,
  BookOpen,
  Filter,
  Save,
  Tag,
  AlertCircle,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface SectionDraft {
  id: string;
  title: string;
  instructions: string;
  totalMarks: number;
  questionIds: string[];
}

export default function CreateQuestionPaperPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Paper header metadata
  const [title, setTitle] = useState("Annual Examination 2026");
  const [code, setCode] = useState("SET-A");
  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examId, setExamId] = useState("");
  const [targetTotalMarks, setTargetTotalMarks] = useState<number>(100);
  const [durationMinutes, setDurationMinutes] = useState<number>(180);
  const [instructions, setInstructions] = useState(
    "1. Read all questions carefully before answering.\n2. Write your Roll Number, Class, and Name clearly on the answer script.\n3. Figures in the right margin indicate full marks for each question."
  );

  // Sections
  const [sections, setSections] = useState<SectionDraft[]>([
    {
      id: "sec-1",
      title: "Section A: Multiple Choice Questions",
      instructions: "Choose the correct answer for each question. All questions are compulsory.",
      totalMarks: 20,
      questionIds: [],
    },
    {
      id: "sec-2",
      title: "Section B: Short Answer Questions",
      instructions: "Answer any 5 questions in 2–3 concise sentences.",
      totalMarks: 30,
      questionIds: [],
    },
    {
      id: "sec-3",
      title: "Section C: Descriptive & Creative Questions",
      instructions: "Answer the following broad questions in detail.",
      totalMarks: 50,
      questionIds: [],
    },
  ]);

  // Question Picker modal state
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerType, setPickerType] = useState("ALL");
  const [pickerDifficulty, setPickerDifficulty] = useState("ALL");

  // Fetch academic years
  const { data: yearsData } = useQuery({
    queryKey: ["academic-years-all"],
    queryFn: async () => {
      const res = await fetch("/api/academic-years?limit=100");
      if (!res.ok) throw new Error("Failed to fetch academic years");
      return res.json();
    },
  });
  const academicYears = yearsData?.data || [];

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true");
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });
  const classes = classesData?.data || [];

  // Fetch subjects
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects-all"],
    queryFn: async () => {
      const res = await fetch("/api/subjects");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
  });
  const subjects = subjectsData?.data || [];

  // Fetch class subjects for selected class (dependency)
  const { data: classSubjectsData = [] } = useQuery({
    queryKey: ["paper-class-subjects", classId],
    queryFn: async () => {
      const res = await fetch(`/api/class-subjects?classId=${classId}`);
      if (!res.ok) throw new Error("Failed to fetch class subjects");
      return res.json();
    },
    enabled: !!classId,
  });

  const classSubjectIds = useMemo(
    () => new Set(classSubjectsData.map((cs: any) => cs.subjectId)),
    [classSubjectsData]
  );

  const filteredSubjects = useMemo(
    () => subjects.filter((s: any) => classSubjectIds.has(s.subjectId)),
    [subjects, classSubjectIds]
  );

  // Fetch exams
  const { data: examsData } = useQuery({
    queryKey: ["exams-all"],
    queryFn: async () => {
      const res = await fetch("/api/exams");
      if (!res.ok) throw new Error("Failed to fetch exams");
      return res.json();
    },
  });
  const exams = examsData?.data || [];

  // Fetch question bank questions for currently selected class and subject
  const { data: questionsData } = useQuery({
    queryKey: ["questions-for-paper", classId, subjectId],
    queryFn: async () => {
      if (!classId || !subjectId) return { data: [] };
      const res = await fetch(`/api/questions?classId=${classId}&subjectId=${subjectId}&limit=100`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
    enabled: !!classId && !!subjectId,
  });
  const questionPool: any[] = questionsData?.data || [];
  const questionMap = useMemo(() => new Map(questionPool.map((q) => [q.id, q])), [questionPool]);

  // Add Section
  const handleAddSection = () => {
    const nextIdx = sections.length + 1;
    const char = String.fromCharCode(64 + nextIdx);
    setSections((prev) => [
      ...prev,
      {
        id: `sec-${Date.now()}`,
        title: `Section ${char}: Additional Questions`,
        instructions: "Answer all questions.",
        totalMarks: 20,
        questionIds: [],
      },
    ]);
  };

  // Remove Section
  const handleRemoveSection = (secId: string) => {
    if (sections.length <= 1) {
      toast.error(t("questionPapers.sectionMinimum"));
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== secId));
  };

  // Toggle question in section
  const handleToggleQuestion = (secId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        const exists = sec.questionIds.includes(questionId);
        const newQids = exists
          ? sec.questionIds.filter((id) => id !== questionId)
          : [...sec.questionIds, questionId];

        // Auto-calculate section marks from questions
        const totalSectionMarks = newQids.reduce((sum, qid) => {
          const q = questionMap.get(qid);
          return sum + (q?.marks || 1);
        }, 0);

        return {
          ...sec,
          questionIds: newQids,
          totalMarks: totalSectionMarks > 0 ? totalSectionMarks : sec.totalMarks,
        };
      })
    );
  };

  // Remove single question from section
  const handleRemoveQuestionFromSection = (secId: string, qId: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== secId) return sec;
        return {
          ...sec,
          questionIds: sec.questionIds.filter((id) => id !== qId),
        };
      })
    );
  };

  // Computed total marks across all sections
  const currentTotalMarks = useMemo(() => {
    return sections.reduce((sum, sec) => sum + (Number(sec.totalMarks) || 0), 0);
  }, [sections]);

  // Difficulty ratio calculation from selected questions
  const difficultyStats = useMemo(() => {
    const allSelectedQids = sections.flatMap((s) => s.questionIds);
    if (allSelectedQids.length === 0) return { easy: 0, medium: 0, hard: 0, total: 0 };

    let easy = 0;
    let medium = 0;
    let hard = 0;

    allSelectedQids.forEach((qid) => {
      const q = questionMap.get(qid);
      if (q?.difficulty === "EASY") easy++;
      else if (q?.difficulty === "HARD") hard++;
      else medium++;
    });

    const total = allSelectedQids.length;
    return {
      easy: Math.round((easy / total) * 100),
      medium: Math.round((medium / total) * 100),
      hard: Math.round((hard / total) * 100),
      total,
    };
  }, [sections, questionMap]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async (status: "DRAFT" | "READY") => {
      if (!title.trim() || !academicYearId || !classId || !subjectId) {
        throw new Error("Please complete the required paper details (Title, Academic Year, Class, Subject).");
      }

      const payload = {
        title: title.trim(),
        code: code.trim() || null,
        academicYearId,
        classId,
        subjectId,
        examId: examId || null,
        totalMarks: currentTotalMarks || targetTotalMarks,
        durationMinutes: Number(durationMinutes) || 180,
        instructions: instructions.trim() || null,
        sections: sections.map((s) => ({
          id: s.id,
          title: s.title,
          instructions: s.instructions || null,
          totalMarks: Number(s.totalMarks) || 0,
          questionIds: s.questionIds,
        })),
        status,
      };

      const res = await fetch("/api/question-papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save question paper");
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast.success(t("questionPapers.savedSuccess"));
      queryClient.invalidateQueries({ queryKey: ["question-papers"] });
      router.push(`/exams/question-papers/${data.data.id}/preview`);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  // Filtered picker questions
  const filteredPickerQuestions = useMemo(() => {
    return questionPool.filter((q) => {
      if (pickerType !== "ALL" && q.type !== pickerType) return false;
      if (pickerDifficulty !== "ALL" && q.difficulty !== pickerDifficulty) return false;
      if (pickerSearch.trim()) {
        const query = pickerSearch.toLowerCase();
        const textMatch = q.questionText?.toLowerCase().includes(query);
        const chapterMatch = q.chapter?.toLowerCase().includes(query);
        return textMatch || chapterMatch;
      }
      return true;
    });
  }, [questionPool, pickerType, pickerDifficulty, pickerSearch]);

  const activeSection = sections.find((s) => s.id === activeSectionId);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/exams/question-papers">
            <Button variant="outline" size="sm" className="h-9 w-9 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {t("questionPapers.createPaper")}
            </h1>
            <p className="text-xs text-muted-foreground">
              Interactive Section Composer & Marks Budget Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate("DRAFT")}
            disabled={saveMutation.isPending}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => saveMutation.mutate("READY")}
            disabled={saveMutation.isPending}
            className="gap-2 font-bold shadow-md"
          >
            <CheckCircle2 className="h-4 w-4" />
            Save & Finalize Paper
          </Button>
        </div>
      </div>

      {/* Sticky Marks & Difficulty Gauge Bar */}
      <Card className="border-primary/30 bg-primary/5 shadow-sm sticky top-4 z-10 backdrop-blur-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Marks Budget
                </span>
                <span className="text-xl font-bold text-primary font-mono">
                  {currentTotalMarks} <span className="text-xs text-muted-foreground">/ {targetTotalMarks} Marks</span>
                </span>
              </div>
              <div className="h-8 w-[1px] bg-border/80 hidden sm:block" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Time Allowed
                </span>
                <span className="text-sm font-semibold text-foreground font-mono">
                  {Math.floor(durationMinutes / 60)}h {durationMinutes % 60}m ({durationMinutes} mins)
                </span>
              </div>
              <div className="h-8 w-[1px] bg-border/80 hidden sm:block" />
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Total Questions
                </span>
                <span className="text-sm font-semibold text-foreground font-mono">
                  {difficultyStats.total} Questions Selected
                </span>
              </div>
            </div>

            {/* Difficulty Ratio Bar */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Difficulty Ratio
                </span>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400">Easy {difficultyStats.easy}%</span>
                  <span>•</span>
                  <span className="text-amber-600 dark:text-amber-400">Med {difficultyStats.medium}%</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400">Hard {difficultyStats.hard}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paper Metadata Form */}
      <Card className="border-border shadow-sm">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold">{t("questionPapers.paperDetails")}</CardTitle>
          <CardDescription className="text-xs">
            Configure target class, subject, and general instructions on the examination header.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionPapers.paperTitle")} *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("questionPapers.annualExamPlaceholder")}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionPapers.paperCode")}
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("questionPapers.paperCodePlaceholder")}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionPapers.academicYear")} *
              </label>
              <Select value={academicYearId} onValueChange={setAcademicYearId} required>
                <SelectTrigger>
                  <SelectValue placeholder={t("questionPapers.selectAcademicYear")} />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((y: any) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionPapers.class")} *
              </label>
              <Select value={classId} onValueChange={(value) => { setClassId(value); setSubjectId(""); }} required>
                <SelectTrigger>
                  <SelectValue placeholder={t("questionPapers.selectClass")} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionPapers.subject")} *
              </label>
              <Select value={subjectId} onValueChange={setSubjectId} required>
                <SelectTrigger>
                  <SelectValue placeholder={t("questionPapers.selectSubject")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjects.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionPapers.totalMarks")} *
              </label>
              <Input
                type="number"
                min="10"
                value={targetTotalMarks}
                onChange={(e) => setTargetTotalMarks(parseInt(e.target.value) || 100)}
                className="font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionPapers.durationMinutes")} *
              </label>
              <Input
                type="number"
                min="10"
                step="15"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 180)}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              {t("questionPapers.instructions")}
            </label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sections Builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {t("questionPapers.sections")} ({sections.length})
          </h2>
          <Button variant="outline" size="sm" onClick={handleAddSection} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("questionPapers.addSection")}
          </Button>
        </div>

        {sections.map((sec, secIdx) => {
          const selectedQuestions = sec.questionIds
            .map((qid) => questionMap.get(qid))
            .filter(Boolean);

          return (
            <Card key={sec.id} className="border-border shadow-sm bg-card">
              <CardHeader className="p-4 pb-2 bg-muted/20 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="font-mono text-xs font-bold w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center">
                      {secIdx + 1}
                    </span>
                    <Input
                      value={sec.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSections((prev) =>
                          prev.map((s) => (s.id === sec.id ? { ...s, title: val } : s))
                        );
                      }}
                      className="font-bold text-sm bg-transparent border-transparent hover:border-border focus:border-primary max-w-md h-8"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground font-semibold">{t("questionPapers.print.marks")}:</span>
                      <Input
                        type="number"
                        min="1"
                        value={sec.totalMarks}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSections((prev) =>
                            prev.map((s) => (s.id === sec.id ? { ...s, totalMarks: val } : s))
                          );
                        }}
                        className="w-20 h-8 font-mono text-xs font-bold text-center"
                      />
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!classId || !subjectId) {
                          toast.error(t("questionPapers.selectClassSubjectAbove"));
                          return;
                        }
                        setActiveSectionId(sec.id);
                      }}
                      className="gap-1.5 h-8 text-xs font-semibold text-primary border-primary/30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("questionPapers.pickFromBank")} ({sec.questionIds.length})
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSection(sec.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="pt-2">
                  <Input
                    placeholder={t("questionPapers.sectionInstructionsPlaceholder")}
                    value={sec.instructions}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSections((prev) =>
                        prev.map((s) => (s.id === sec.id ? { ...s, instructions: val } : s))
                      );
                    }}
                    className="text-xs text-muted-foreground bg-transparent border-transparent hover:border-border focus:border-primary h-7"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-2">
                {selectedQuestions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                    {t("questionPapers.noQuestionsInSection")}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        if (!classId || !subjectId) {
                          toast.error(t("questionPapers.selectClassSubjectFirst"));
                          return;
                        }
                        setActiveSectionId(sec.id);
                      }}
                      className="text-primary font-bold underline underline-offset-2"
                    >
                      {t("questionPapers.pickFromBank")}
                    </button>{" "}
                    {t("questionPapers.toChooseQuestions")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedQuestions.map((q: any, qIdx: number) => (
                      <div
                        key={q.id}
                        className="p-3 bg-muted/30 rounded-lg border border-border/60 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">
                              Q{qIdx + 1}.
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {q.type}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {q.difficulty}
                            </Badge>
                            {q.chapter && (
                              <span className="text-[11px] text-muted-foreground">
                                {q.chapter}
                              </span>
                            )}
                            <span className="ml-auto font-mono font-bold text-foreground">
                              [{q.marks} {t("questionPapers.print.marks")}]
                            </span>
                          </div>
                          <p className="text-foreground font-medium line-clamp-2">
                            {q.questionText}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveQuestionFromSection(sec.id, q.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Question Bank Picker Modal */}
      {activeSection && (
        <Dialog open={!!activeSectionId} onOpenChange={() => setActiveSectionId(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between text-base">
                <span>{t("questionPapers.pickerTitle", { section: activeSection.title })}</span>
                <Badge variant="outline" className="font-mono">
                  {t("questionPapers.selectedCount", { count: activeSection.questionIds.length })}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("questionPapers.pickerDescription")}
              </DialogDescription>
            </DialogHeader>

            {/* Modal Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-y border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("questionPapers.searchQuestions")}
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <Select value={pickerType} onValueChange={setPickerType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("questionPapers.allTypes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("questionBank.filterAllTypes")}</SelectItem>
                  <SelectItem value="MCQ">{t("questionBank.types.MCQ")}</SelectItem>
                  <SelectItem value="SHORT">{t("questionBank.types.SHORT")}</SelectItem>
                  <SelectItem value="DESCRIPTIVE">{t("questionBank.types.DESCRIPTIVE")}</SelectItem>
                  <SelectItem value="CREATIVE_NCTB">{t("questionBank.types.CREATIVE_NCTB")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={pickerDifficulty} onValueChange={setPickerDifficulty}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("questionPapers.allDifficulties")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("questionBank.filterAllDifficulties")}</SelectItem>
                  <SelectItem value="EASY">{t("questionPapers.easy")}</SelectItem>
                  <SelectItem value="MEDIUM">{t("questionPapers.medium")}</SelectItem>
                  <SelectItem value="HARD">{t("questionPapers.hard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scrollable Questions list */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
              {filteredPickerQuestions.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {t("questionPapers.noQuestionsMatch")}
                </div>
              ) : (
                filteredPickerQuestions.map((q) => {
                  const isSelected = activeSection.questionIds.includes(q.id);

                  return (
                    <div
                      key={q.id}
                      onClick={() => handleToggleQuestion(activeSection.id, q.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 text-xs ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-sm"
                          : "bg-card hover:bg-muted/40 border-border"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {q.type}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {q.difficulty}
                          </Badge>
                          {q.chapter && (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {q.chapter}
                            </span>
                          )}
                          <span className="ml-auto font-mono font-bold">
                            {q.marks} {t("questionPapers.print.marks")}
                          </span>
                        </div>
                        <p className="text-foreground font-medium">{q.questionText}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button onClick={() => setActiveSectionId(null)} className="font-bold">
                {t("questionPapers.doneSelected", { count: activeSection.questionIds.length })}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
