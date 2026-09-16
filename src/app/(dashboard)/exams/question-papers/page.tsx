"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Sparkles,
  Search,
  Copy,
  Printer,
  Edit,
  Edit3,
  Lock,
  Trash2,
  CheckCircle2,
  Clock,
  BookOpen,
  Calendar,
  Layers,
  FileQuestion,
  GraduationCap,
  Sliders,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppDropdown } from "@/components/ui/app-dropdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function QuestionPapersLibraryPage() {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "exams", "read");
  const canWrite = hasPermission(perms, "exams", "write");
  const canManage = hasPermission(perms, "exams", "manage");

  // Filters
  const [filterClass, setFilterClass] = useState("ALL");
  const [filterSubject, setFilterSubject] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Blueprint Generator modal state — Blueprint 2.0
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const [bpTitle, setBpTitle] = useState("");
  const [bpClassId, setBpClassId] = useState("");
  const [bpSubjectId, setBpSubjectId] = useState("");
  const [bpAcademicYearId, setBpAcademicYearId] = useState("");
  const [bpTotalMarks, setBpTotalMarks] = useState(100);
  const [bpDurationMinutes, setBpDurationMinutes] = useState(180);
  const [bpMcqCount, setBpMcqCount] = useState(20);
  const [bpMcqMarksEach, setBpMcqMarksEach] = useState(1);
  const [bpShortCount, setBpShortCount] = useState(5);
  const [bpShortMarksEach, setBpShortMarksEach] = useState(4);
  const [bpDescriptiveCount, setBpDescriptiveCount] = useState(4);
  const [bpDescriptiveMarksEach, setBpDescriptiveMarksEach] = useState(10);
  const [bpCreativeCount, setBpCreativeCount] = useState(2);
  const [bpCreativeMarksEach, setBpCreativeMarksEach] = useState(10);
  const [bpEasyRatio, setBpEasyRatio] = useState(30);
  const [bpMediumRatio, setBpMediumRatio] = useState(50);
  const [bpHardRatio, setBpHardRatio] = useState(20);
  const [bpBloomKnowledge, setBpBloomKnowledge] = useState(25);
  const [bpBloomUnderstanding, setBpBloomUnderstanding] = useState(25);
  const [bpBloomApplication, setBpBloomApplication] = useState(25);
  const [bpBloomAnalysis, setBpBloomAnalysis] = useState(25);
  const [bpChapterDist, setBpChapterDist] = useState<"balanced" | "sequential">("balanced");

  // NCTB presets — one-click curriculum-accurate blueprints
  const applyNctbPreset = (preset: "primary" | "secondary" | "hsc" | "madrasah") => {
    if (preset === "primary") { // Class 1-5 / 6-8 Primary
      setBpTotalMarks(100); setBpDurationMinutes(150);
      setBpMcqCount(30); setBpMcqMarksEach(1);
      setBpShortCount(8); setBpShortMarksEach(2);
      setBpDescriptiveCount(5); setBpDescriptiveMarksEach(4);
      setBpCreativeCount(4); setBpCreativeMarksEach(7);
    } else if (preset === "secondary") { // Class 9-10 SSC
      setBpTotalMarks(100); setBpDurationMinutes(180);
      setBpMcqCount(30); setBpMcqMarksEach(1);
      setBpShortCount(0); setBpShortMarksEach(4);
      setBpDescriptiveCount(0); setBpDescriptiveMarksEach(10);
      setBpCreativeCount(7); setBpCreativeMarksEach(10);
    } else if (preset === "hsc") { // Class 11-12 HSC
      setBpTotalMarks(100); setBpDurationMinutes(180);
      setBpMcqCount(25); setBpMcqMarksEach(1);
      setBpShortCount(5); setBpShortMarksEach(3);
      setBpDescriptiveCount(2); setBpDescriptiveMarksEach(10);
      setBpCreativeCount(5); setBpCreativeMarksEach(8);
    } else {
      setBpTotalMarks(100); setBpDurationMinutes(180);
      setBpMcqCount(20); setBpMcqMarksEach(1);
      setBpShortCount(4); setBpShortMarksEach(5);
      setBpDescriptiveCount(3); setBpDescriptiveMarksEach(10);
      setBpCreativeCount(3); setBpCreativeMarksEach(10);
    }
  };

  // Fetch academic years
  const { data: yearsData } = useQuery({
    queryKey: ["academic-years", "all"],
    queryFn: async () => {
      const res = await fetch("/api/academic-years?limit=100");
      if (!res.ok) throw new Error("Failed to fetch academic years");
      return res.json();
    },
  });
  const academicYears = yearsData?.data || [];

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ["classes", "all"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true");
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });
  const classes = classesData?.data || [];

  // Fetch subjects
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects", "all"],
    queryFn: async () => {
      const res = await fetch("/api/subjects");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
  });
  const subjects = subjectsData?.data || [];

  // Fetch Question Papers
  const { data: papersData, isLoading } = useQuery({
    queryKey: ["question-papers", filterClass, filterSubject, filterStatus, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterClass !== "ALL") params.append("classId", filterClass);
      if (filterSubject !== "ALL") params.append("subjectId", filterSubject);
      if (filterStatus !== "ALL") params.append("status", filterStatus);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      params.append("limit", "50");

      const res = await fetch(`/api/question-papers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch question papers");
      return res.json();
    },
  });
  const papers: any[] = papersData?.data || [];

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-papers/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error(t("questionPapers.duplicateFailed"));
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("questionPapers.duplicateSuccess"));
      queryClient.invalidateQueries({ queryKey: ["question-papers"] });
    },
    onError: (err: any) => {
      toast.error(err.message || t("questionPapers.duplicateFailed"));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-papers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("questionPapers.deleteFailed"));
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("questionPapers.deleteSuccess"));
      queryClient.invalidateQueries({ queryKey: ["question-papers"] });
    },
    onError: (err: any) => {
      toast.error(err.message || t("questionPapers.deleteFailed"));
    },
  });

  // Generate Blueprint mutation
  const generateBlueprintMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/question-papers/generate-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate paper blueprint");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(t("questionPapers.blueprintComposed"));
      setIsBlueprintOpen(false);
      // Save blueprint generated paper
      saveGeneratedPaper(data.data);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const saveGeneratedPaper = async (paperData: any) => {
    try {
      const res = await fetch("/api/question-papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: paperData.title,
          academicYearId: paperData.academicYearId,
          classId: paperData.classId,
          subjectId: paperData.subjectId,
          totalMarks: paperData.totalMarks,
          durationMinutes: paperData.durationMinutes,
          instructions: paperData.instructions,
          sections: paperData.sections,
          status: "READY",
        }),
      });

      if (!res.ok) throw new Error("Failed to save blueprint paper");
      const created = await res.json();
      toast.success(t("questionPapers.savedReady"));
      queryClient.invalidateQueries({ queryKey: ["question-papers"] });
      router.push(`/exams/question-papers/${created.data.id}/preview`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const bpComputedMarks = bpMcqCount * bpMcqMarksEach + bpShortCount * bpShortMarksEach + bpDescriptiveCount * bpDescriptiveMarksEach + bpCreativeCount * bpCreativeMarksEach;
  const bpDifficultySum = bpEasyRatio + bpMediumRatio + bpHardRatio;
  const bpBloomSum = bpBloomKnowledge + bpBloomUnderstanding + bpBloomApplication + bpBloomAnalysis;
  const bpMarksMismatch = Math.abs(bpComputedMarks - bpTotalMarks) > 0.01;

  const handleGenerateBlueprint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bpClassId || !bpSubjectId || !bpAcademicYearId || !bpTitle.trim()) {
      toast.error(t("questionPapers.requiredDetails"));
      return;
    }
    if (bpDifficultySum !== 100) {
      toast.error(t("questionPapers.blueprintModal.difficultySumError"));
      return;
    }
    if (bpBloomSum !== 100) {
      toast.error(t("questionPapers.blueprintModal.bloomSumError"));
      return;
    }
    if (bpMarksMismatch) {
      toast.error(t("questionPapers.blueprintModal.marksMismatchError", { computed: String(bpComputedMarks), target: String(bpTotalMarks) }));
      return;
    }
    if ((bpMcqCount + bpShortCount + bpDescriptiveCount + bpCreativeCount) === 0) {
      toast.error(t("questionPapers.blueprintModal.atLeastOneSection"));
      return;
    }

    const payload = {
      title: bpTitle.trim(),
      academicYearId: bpAcademicYearId,
      classId: bpClassId,
      subjectId: bpSubjectId,
      totalMarks: Number(bpTotalMarks) || 100,
      durationMinutes: Number(bpDurationMinutes) || 180,
      blueprint: {
        mcqCount: Number(bpMcqCount) || 0,
        mcqMarksEach: Number(bpMcqMarksEach) || 1,
        shortCount: Number(bpShortCount) || 0,
        shortMarksEach: Number(bpShortMarksEach) || 4,
        descriptiveCount: Number(bpDescriptiveCount) || 0,
        descriptiveMarksEach: Number(bpDescriptiveMarksEach) || 10,
        creativeCount: Number(bpCreativeCount) || 0,
        creativeMarksEach: Number(bpCreativeMarksEach) || 10,
        difficultyRatio: { easy: Number(bpEasyRatio) || 30, medium: Number(bpMediumRatio) || 50, hard: Number(bpHardRatio) || 20 },
        bloomRatio: { knowledge: Number(bpBloomKnowledge) || 25, understanding: Number(bpBloomUnderstanding) || 25, application: Number(bpBloomApplication) || 25, analysis: Number(bpBloomAnalysis) || 25 },
        chapterDistribution: bpChapterDist,
      },
    };

    generateBlueprintMutation.mutate(payload);
  };

  // KPIs
  const totalPapers = papers.length;
  const readyPapers = papers.filter((p) => p.status === "READY" || p.status === "PUBLISHED").length;
  const draftPapers = papers.filter((p) => p.status === "DRAFT").length;

  const statusBadges: Record<string, { label: string; className: string }> = {
    DRAFT: { label: t("questionPapers.status.DRAFT"), className: "bg-muted text-muted-foreground" },
    READY: { label: t("questionPapers.status.READY"), className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    PUBLISHED: { label: t("questionPapers.status.PUBLISHED"), className: "bg-primary/10 text-primary border-primary/30" },
    ARCHIVED: { label: t("questionPapers.status.ARCHIVED"), className: "bg-amber-500/10 text-amber-600" },
  };

  if (!canRead) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("questionPapers.title")} description={t("questionPapers.description")} />
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{tCommon("accessRestricted")}</h2>
          <p className="text-sm text-muted-foreground mt-2">{tCommon("noPermission")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("questionPapers.title")}
        description={t("questionPapers.description")}
      >
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <Button
              variant="outline"
              onClick={() => {
                if (classes.length > 0) setBpClassId(classes[0].id);
                if (subjects.length > 0) setBpSubjectId(subjects[0].id);
                if (academicYears.length > 0) setBpAcademicYearId(academicYears[0].id);
                setBpTitle("Annual Examination 2026-2027");
                setIsBlueprintOpen(true);
              }}
              className="gap-2 border-primary/30 hover:bg-primary/5 text-primary"
            >
              <Sparkles className="h-4 w-4" />
              {t("questionPapers.smartGenerate")}
            </Button>
          )}
          {canWrite && (
            <Link href="/exams/question-papers/create">
              <Button className="gap-2 shadow-sm font-semibold">
                <Plus className="h-4 w-4" />
                {t("questionPapers.createPaper")}
              </Button>
            </Link>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ERPMetricCard
          title={t("questionPapers.kpi.totalPapers")}
          value={totalPapers}
          subtitle={t("questionPapers.repositoryPapers")}
          icon={FileText}
        />
        <ERPMetricCard
          title={t("questionPapers.kpi.readyPapers")}
          value={readyPapers}
          subtitle={t("questionPapers.readyForExamDay")}
          icon={CheckCircle2}
        />
        <ERPMetricCard
          title={t("questionPapers.kpi.draftPapers")}
          value={draftPapers}
          subtitle={t("questionPapers.inProgressCustomSets")}
          icon={Clock}
        />
      </div>

      {/* Filter Bar */}
      <Card className="shadow-sm border-border/80 bg-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("questionPapers.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Class Filter */}
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={t("questionBank.filterAllClasses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("questionBank.filterAllClasses")}</SelectItem>
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Subject Filter */}
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={t("questionBank.filterAllSubjects")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("questionBank.filterAllSubjects")}</SelectItem>
                {subjects.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={t("questionPapers.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("questionPapers.allStatuses")}</SelectItem>
                <SelectItem value="READY">{t("questionPapers.status.READY")}</SelectItem>
                <SelectItem value="DRAFT">{t("questionPapers.status.DRAFT")}</SelectItem>
                <SelectItem value="PUBLISHED">{t("questionPapers.status.PUBLISHED")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Papers List */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : papers.length === 0 ? (
        <Card className="py-16 text-center border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-muted rounded-full text-muted-foreground">
              <FileQuestion className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold">{t("questionPapers.noPapers")}</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {t("questionPapers.noPapersHint")}
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBlueprintOpen(true)}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                {t("questionPapers.smartGenerate")}
              </Button>
              <Link href="/exams/question-papers/create">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  {t("questionPapers.createPaper")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {papers.map((paper) => {
            const statusConfig = statusBadges[paper.status] || {
              label: paper.status,
              className: "bg-muted",
            };
            const sectionCount = Array.isArray(paper.sections) ? paper.sections.length : 0;
            const totalQuestionsCount = Array.isArray(paper.sections)
              ? paper.sections.reduce((sum: number, s: any) => sum + (s.questionIds?.length || 0), 0)
              : 0;

            return (
              <Card
                key={paper.id}
                className="border-border hover:border-primary/50 transition-all shadow-sm hover:shadow-md bg-card flex flex-col justify-between"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="text-[10px] font-mono mb-1.5">
                        {paper.paperId} {paper.code ? `• ${paper.code}` : ""}
                      </Badge>
                      <CardTitle className="text-base font-bold text-foreground leading-tight">
                        {paper.title}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {paper.exam?.isPublished && (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 dark:text-amber-400 gap-1">
                          <Lock className="h-3 w-3" />
                          লক করা
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs pt-1 flex items-center gap-2">
                    <span className="font-semibold text-foreground">{paper.class?.name}</span>
                    <span>•</span>
                    <span className="text-primary font-medium">{paper.subject?.name}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-muted/40 rounded-lg text-center font-mono">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">{t("questionPapers.fullMarks")}</span>
                      <span className="text-sm font-bold text-foreground">{paper.totalMarks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">{t("questionPapers.duration")}</span>
                      <span className="text-sm font-bold text-foreground">{paper.durationMinutes}m</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">{t("questionPapers.sectionsCount")}</span>
                      <span className="text-sm font-bold text-foreground">
                        {sectionCount} ({totalQuestionsCount} Qs)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                    {paper.exam?.isPublished ? (
                      <Link
                        href={`/exams/question-papers/${paper.id}/preview`}
                        className="flex-1"
                      >
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full gap-1.5 font-bold"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>ভিউ ও প্রিন্ট</span>
                        </Button>
                      </Link>
                    ) : canWrite ? (
                      <>
                        <Link
                          href={`/exams/question-papers/${paper.id}/edit`}
                          className="flex-1"
                        >
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full gap-1.5 font-bold"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{t("common.edit") || "সম্পাদনা"}</span>
                          </Button>
                        </Link>

                        <Link
                          href={`/exams/question-papers/${paper.id}/preview`}
                          title={t("questionPapers.previewPrint")}
                        >
                          <Button variant="outline" size="sm" className="h-9 px-2.5">
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/exams/question-papers/${paper.id}/preview`}
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full gap-1.5 font-bold">
                          <Printer className="h-3.5 w-3.5" />
                          <span>{t("questionPapers.previewPrint")}</span>
                        </Button>
                      </Link>
                    )}

                    {canWrite && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateMutation.mutate(paper.id)}
                        disabled={duplicateMutation.isPending}
                        title={t("questionPapers.duplicatePaper")}
                        className="h-9 px-2.5"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}

                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(t("questionPapers.deleteConfirm"))) {
                            deleteMutation.mutate(paper.id);
                          }
                        }}
                        disabled={paper.exam?.isPublished}
                        title={paper.exam?.isPublished ? "ফলাফল প্রকাশিত হওয়ায় মুছে ফেলা যাবে না" : t("questionPapers.deletePaper")}
                        className="h-9 px-2.5 hover:text-rose-600 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-rose-600" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Smart Blueprint Generator Modal — Blueprint 2.0 */}
      <Dialog open={isBlueprintOpen} onOpenChange={setIsBlueprintOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              {t("questionPapers.blueprintModal.title")}
              <Badge variant="outline" className="ml-2 text-[10px] font-mono border-primary/30 text-primary">2.0</Badge>
            </DialogTitle>
            <DialogDescription>
              {t("questionPapers.blueprintModal.description")}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateBlueprint} className="space-y-4 pt-2">
            {/* NCTB Presets */}
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider w-full mb-1 flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" />{t("questionPapers.blueprintModal.presetsLabel")}</span>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyNctbPreset("primary")}>{t("questionPapers.blueprintModal.presetPrimary")}</Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyNctbPreset("secondary")}>{t("questionPapers.blueprintModal.presetSecondary")}</Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyNctbPreset("hsc")}>{t("questionPapers.blueprintModal.presetHsc")}</Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyNctbPreset("madrasah")}>{t("questionPapers.blueprintModal.presetMadrasah")}</Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  {t("questionPapers.paperTitle")} *
                </label>
                <Input value={bpTitle} onChange={(e) => setBpTitle(e.target.value)} placeholder={t("questionPapers.paperTitlePlaceholder")} required />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">{t("questionPapers.academicYear")} *</label>
                <AppDropdown
                  options={academicYears.map((y: any) => ({ label: (y.label || y.yearId || y.id) + (!y.isClosed ? ' (চলতি)' : ''), value: y.id }))}
                  value={bpAcademicYearId}
                  onChange={setBpAcademicYearId}
                  placeholder={t("questionPapers.selectAcademicYear")}
                  searchable
                  noOptionsText="কোনো শিক্ষাবর্ষ পাওয়া যায়নি — সেটিংসে তৈরি করুন"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">{t("questionPapers.class")} *</label>
                <Select value={bpClassId || undefined} onValueChange={setBpClassId}>
                  <SelectTrigger><SelectValue placeholder={t("questionPapers.selectClass")} /></SelectTrigger>
                  <SelectContent className="z-[80]">{classes.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">{t("questionPapers.subject")} *</label>
                <Select value={bpSubjectId || undefined} onValueChange={setBpSubjectId}>
                  <SelectTrigger><SelectValue placeholder={t("questionPapers.selectSubject")} /></SelectTrigger>
                  <SelectContent className="z-[80]">{subjects.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">{t("questionPapers.blueprintModal.totalMarksLabel")}</label>
                <Input type="number" min="1" value={bpTotalMarks} onChange={(e) => setBpTotalMarks(parseInt(e.target.value) || 100)} className="font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">{t("questionPapers.blueprintModal.durationLabel")}</label>
                <Input type="number" min="10" value={bpDurationMinutes} onChange={(e) => setBpDurationMinutes(parseInt(e.target.value) || 180)} className="font-mono" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-foreground mb-1 block">{t("questionPapers.blueprintModal.chapterDistLabel")}</label>
                <Select value={bpChapterDist} onValueChange={(v: any) => setBpChapterDist(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[80]">
                    <SelectItem value="balanced">{t("questionPapers.blueprintModal.chapterBalanced")}</SelectItem>
                    <SelectItem value="sequential">{t("questionPapers.blueprintModal.chapterSequential")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">{t("questionPapers.blueprintModal.chapterDistHint")}</p>
              </div>
            </div>

            {/* Live validation banner */}
            {(bpMarksMismatch || bpDifficultySum !== 100 || bpBloomSum !== 100) && (
              <div className="space-y-1.5 p-2.5 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-xs">
                {bpMarksMismatch && <p className="text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />{t("questionPapers.blueprintModal.marksMismatchError", { computed: String(bpComputedMarks), target: String(bpTotalMarks) })}</p>}
                {bpDifficultySum !== 100 && <p className="text-amber-700 dark:text-amber-300">⚠ {t("questionPapers.blueprintModal.difficultySumError")} — {t("questionPapers.blueprintModal.currentSum")}: {bpDifficultySum}%</p>}
                {bpBloomSum !== 100 && <p className="text-amber-700 dark:text-amber-300">⚠ {t("questionPapers.blueprintModal.bloomSumError")} — {t("questionPapers.blueprintModal.currentSum")}: {bpBloomSum}%</p>}
              </div>
            )}
            {!bpMarksMismatch && bpDifficultySum === 100 && bpBloomSum === 100 && (
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />{t("questionPapers.blueprintModal.marksBalanced", { computed: String(bpComputedMarks) })}
              </div>
            )}

            {/* Question Breakdown Blueprint */}
            <div className="p-3.5 bg-muted/40 rounded-lg border border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                <span>{t("questionPapers.blueprintQuestionDistribution")}</span>
                <Badge variant="outline" className={`font-mono ${bpMarksMismatch ? "border-amber-400 text-amber-600" : "border-emerald-400 text-emerald-600"}`}>
                  {bpComputedMarks} / {bpTotalMarks} {t("questionPapers.print.marks")}
                </Badge>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-background rounded border space-y-1.5">
                  <div className="font-semibold text-foreground flex justify-between">
                    <span>{t("questionPapers.blueprintModal.mcqSection")}</span>
                    <span className="font-mono text-primary font-bold">{bpMcqCount * bpMcqMarksEach} {t("questionPapers.points")}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1"><span className="text-[10px] text-muted-foreground">{t("questionPapers.count")}</span><Input type="number" min="0" value={bpMcqCount} onChange={(e) => setBpMcqCount(parseInt(e.target.value) || 0)} className="h-7 text-xs font-mono" /></div>
                    <div className="w-16"><span className="text-[10px] text-muted-foreground">{t("questionPapers.pointsPerQuestion")}</span><Input type="number" min="0.5" step="0.5" value={bpMcqMarksEach} onChange={(e) => setBpMcqMarksEach(parseFloat(e.target.value) || 1)} className="h-7 text-xs font-mono text-center" /></div>
                  </div>
                </div>
                <div className="p-2.5 bg-background rounded border space-y-1.5">
                  <div className="font-semibold text-foreground flex justify-between">
                    <span>{t("questionPapers.blueprintModal.shortSection")}</span>
                    <span className="font-mono text-primary font-bold">{bpShortCount * bpShortMarksEach} {t("questionPapers.points")}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1"><span className="text-[10px] text-muted-foreground">{t("questionPapers.count")}</span><Input type="number" min="0" value={bpShortCount} onChange={(e) => setBpShortCount(parseInt(e.target.value) || 0)} className="h-7 text-xs font-mono" /></div>
                    <div className="w-16"><span className="text-[10px] text-muted-foreground">{t("questionPapers.pointsPerQuestion")}</span><Input type="number" min="1" value={bpShortMarksEach} onChange={(e) => setBpShortMarksEach(parseFloat(e.target.value) || 1)} className="h-7 text-xs font-mono text-center" /></div>
                  </div>
                </div>
                <div className="p-2.5 bg-background rounded border space-y-1.5">
                  <div className="font-semibold text-foreground flex justify-between">
                    <span>{t("questionPapers.blueprintModal.descriptiveSection")}</span>
                    <span className="font-mono text-primary font-bold">{bpDescriptiveCount * bpDescriptiveMarksEach} {t("questionPapers.points")}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1"><span className="text-[10px] text-muted-foreground">{t("questionPapers.count")}</span><Input type="number" min="0" value={bpDescriptiveCount} onChange={(e) => setBpDescriptiveCount(parseInt(e.target.value) || 0)} className="h-7 text-xs font-mono" /></div>
                    <div className="w-16"><span className="text-[10px] text-muted-foreground">{t("questionPapers.pointsPerQuestion")}</span><Input type="number" min="1" value={bpDescriptiveMarksEach} onChange={(e) => setBpDescriptiveMarksEach(parseFloat(e.target.value) || 1)} className="h-7 text-xs font-mono text-center" /></div>
                  </div>
                </div>
                <div className="p-2.5 bg-background rounded border space-y-1.5">
                  <div className="font-semibold text-foreground flex justify-between">
                    <span>{t("questionPapers.blueprintModal.creativeSection")}</span>
                    <span className="font-mono text-primary font-bold">{bpCreativeCount * bpCreativeMarksEach} {t("questionPapers.points")}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1"><span className="text-[10px] text-muted-foreground">{t("questionPapers.count")}</span><Input type="number" min="0" value={bpCreativeCount} onChange={(e) => setBpCreativeCount(parseInt(e.target.value) || 0)} className="h-7 text-xs font-mono" /></div>
                    <div className="w-16"><span className="text-[10px] text-muted-foreground">{t("questionPapers.pointsPerQuestion")}</span><Input type="number" min="1" value={bpCreativeMarksEach} onChange={(e) => setBpCreativeMarksEach(parseFloat(e.target.value) || 1)} className="h-7 text-xs font-mono text-center" /></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Difficulty Ratio */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/60 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Sliders className="h-3.5 w-3.5" />{t("questionPapers.blueprintModal.difficultyTitle")}</span>
                <Badge variant={bpDifficultySum === 100 ? "outline" : "destructive"} className="font-mono text-[10px]">{bpDifficultySum}% {bpDifficultySum === 100 ? "✓" : `(${t("questionPapers.blueprintModal.need100")})`}</Badge>
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1 block">{t("questionPapers.blueprintModal.easyRatio")}</label><Input type="number" min="0" max="100" value={bpEasyRatio} onChange={(e) => setBpEasyRatio(parseInt(e.target.value) || 0)} className="font-mono text-xs" /></div>
                <div><label className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1 block">{t("questionPapers.blueprintModal.mediumRatio")}</label><Input type="number" min="0" max="100" value={bpMediumRatio} onChange={(e) => setBpMediumRatio(parseInt(e.target.value) || 0)} className="font-mono text-xs" /></div>
                <div><label className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-1 block">{t("questionPapers.blueprintModal.hardRatio")}</label><Input type="number" min="0" max="100" value={bpHardRatio} onChange={(e) => setBpHardRatio(parseInt(e.target.value) || 0)} className="font-mono text-xs" /></div>
              </div>
            </div>

            {/* Bloom Taxonomy Ratio — NEW 2.0 */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/60 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{t("questionPapers.blueprintModal.bloomTitle")}</span>
                <Badge variant={bpBloomSum === 100 ? "outline" : "destructive"} className="font-mono text-[10px]">{bpBloomSum}% {bpBloomSum === 100 ? "✓" : `(${t("questionPapers.blueprintModal.need100")})`}</Badge>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className="text-[11px] font-semibold mb-1 block">{t("questionPapers.blueprintModal.bloomKnowledge")}</label><Input type="number" min="0" max="100" value={bpBloomKnowledge} onChange={(e) => setBpBloomKnowledge(parseInt(e.target.value) || 0)} className="font-mono text-xs" /></div>
                <div><label className="text-[11px] font-semibold mb-1 block">{t("questionPapers.blueprintModal.bloomUnderstanding")}</label><Input type="number" min="0" max="100" value={bpBloomUnderstanding} onChange={(e) => setBpBloomUnderstanding(parseInt(e.target.value) || 0)} className="font-mono text-xs" /></div>
                <div><label className="text-[11px] font-semibold mb-1 block">{t("questionPapers.blueprintModal.bloomApplication")}</label><Input type="number" min="0" max="100" value={bpBloomApplication} onChange={(e) => setBpBloomApplication(parseInt(e.target.value) || 0)} className="font-mono text-xs" /></div>
                <div><label className="text-[11px] font-semibold mb-1 block">{t("questionPapers.blueprintModal.bloomAnalysis")}</label><Input type="number" min="0" max="100" value={bpBloomAnalysis} onChange={(e) => setBpBloomAnalysis(parseInt(e.target.value) || 0)} className="font-mono text-xs" /></div>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("questionPapers.blueprintModal.bloomHint")}</p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsBlueprintOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={generateBlueprintMutation.isPending} className="gap-2 font-bold">
                <Sparkles className="h-4 w-4" />
                {generateBlueprintMutation.isPending ? t("common.loading") : t("questionPapers.blueprintModal.generateBtn")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
