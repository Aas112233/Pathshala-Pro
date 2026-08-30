"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  HelpCircle,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Eye,
  CheckCircle2,
  Layers,
  Sparkles,
  BookOpen,
  GraduationCap,
  FileQuestion,
  Tag,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
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
import {
  QUESTION_TYPES,
  QUESTION_DIFFICULTIES,
  BLOOM_LEVELS,
} from "@/lib/schemas";

interface OptionItem {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface SubQuestionItem {
  label: string;
  text: string;
  marks: number;
}

export default function QuestionBankPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Filters state
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [filterSubject, setFilterSubject] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Drawer & Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<any | null>(null);

  // Form states
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [questionType, setQuestionType] = useState<string>("MCQ");
  const [difficulty, setDifficulty] = useState<string>("MEDIUM");
  const [bloomLevel, setBloomLevel] = useState<string>("UNDERSTANDING");
  const [marks, setMarks] = useState<number>(1);
  const [questionText, setQuestionText] = useState("");
  const [stimulus, setStimulus] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [explanation, setExplanation] = useState("");

  // MCQ Options
  const [options, setOptions] = useState<OptionItem[]>([
    { id: "A", text: "", isCorrect: true },
    { id: "B", text: "", isCorrect: false },
    { id: "C", text: "", isCorrect: false },
    { id: "D", text: "", isCorrect: false },
  ]);

  // NCTB Sub-Questions (a, b, c, d)
  const [subQuestions, setSubQuestions] = useState<SubQuestionItem[]>([
    { label: "ক", text: "", marks: 1 },
    { label: "খ", text: "", marks: 2 },
    { label: "গ", text: "", marks: 3 },
    { label: "ঘ", text: "", marks: 4 },
  ]);

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
    queryKey: ["question-class-subjects", classId],
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

  // Fetch questions
  const { data: questionsData, isLoading } = useQuery({
    queryKey: ["questions", filterClass, filterSubject, filterType, filterDifficulty, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterClass !== "ALL") params.append("classId", filterClass);
      if (filterSubject !== "ALL") params.append("subjectId", filterSubject);
      if (filterType !== "ALL") params.append("type", filterType);
      if (filterDifficulty !== "ALL") params.append("difficulty", filterDifficulty);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      params.append("limit", "100");

      const res = await fetch(`/api/questions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
  });
  const questions: any[] = questionsData?.data || [];

  // Reset form
  const resetForm = () => {
    setEditingQuestion(null);
    setClassId("");
    setSubjectId("");
    setChapter("");
    setTopic("");
    setQuestionType("MCQ");
    setDifficulty("MEDIUM");
    setBloomLevel("UNDERSTANDING");
    setMarks(1);
    setQuestionText("");
    setStimulus("");
    setCorrectAnswer("");
    setExplanation("");
    setOptions([
      { id: "A", text: "", isCorrect: true },
      { id: "B", text: "", isCorrect: false },
      { id: "C", text: "", isCorrect: false },
      { id: "D", text: "", isCorrect: false },
    ]);
    setSubQuestions([
      { label: "ক", text: "", marks: 1 },
      { label: "খ", text: "", marks: 2 },
      { label: "গ", text: "", marks: 3 },
      { label: "ঘ", text: "", marks: 4 },
    ]);
  };

  // Open Add modal
  const handleOpenAdd = () => {
    resetForm();
    if (filterClass !== "ALL") setClassId(filterClass);
    if (filterSubject !== "ALL") setSubjectId(filterSubject);
    setIsFormOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (q: any) => {
    setEditingQuestion(q);
    setClassId(q.classId);
    setSubjectId(q.subjectId);
    setChapter(q.chapter || "");
    setTopic(q.topic || "");
    setQuestionType(q.type);
    setDifficulty(q.difficulty);
    setBloomLevel(q.bloomLevel || "UNDERSTANDING");
    setMarks(q.marks || 1);
    setQuestionText(q.questionText || "");
    setStimulus(q.stimulus || "");
    setCorrectAnswer(q.correctAnswer || "");
    setExplanation(q.explanation || "");

    if (Array.isArray(q.options) && q.options.length > 0) {
      setOptions(q.options);
    } else {
      setOptions([
        { id: "A", text: "", isCorrect: true },
        { id: "B", text: "", isCorrect: false },
        { id: "C", text: "", isCorrect: false },
        { id: "D", text: "", isCorrect: false },
      ]);
    }

    if (Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
      setSubQuestions(q.subQuestions);
    } else {
      setSubQuestions([
        { label: "ক", text: "", marks: 1 },
        { label: "খ", text: "", marks: 2 },
        { label: "গ", text: "", marks: 3 },
        { label: "ঘ", text: "", marks: 4 },
      ]);
    }

    setIsFormOpen(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editingQuestion
        ? `/api/questions/${editingQuestion.id}`
        : "/api/questions";
      const method = editingQuestion ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || t("questionBank.saveFailed"));
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success(t("questionBank.saveSuccess"));
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      setIsFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || t("questionBank.saveFailed"));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("questionBank.deleteFailed"));
      return res.json();
    },
    onSuccess: () => {
      toast.success(t("questionBank.deleteSuccess"));
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: (err: any) => {
      toast.error(err.message || t("questionBank.deleteFailed"));
    },
  });

  const handleDelete = (id: string) => {
    if (confirm(t("questionBank.deleteConfirm"))) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !subjectId || !questionText.trim()) {
      toast.error(t("questionBank.validationRequired"));
      return;
    }

    const payload: any = {
      classId,
      subjectId,
      chapter: chapter.trim() || null,
      topic: topic.trim() || null,
      type: questionType,
      difficulty,
      bloomLevel,
      marks: Number(marks) || 1,
      questionText: questionText.trim(),
      stimulus: stimulus.trim() || null,
      correctAnswer: correctAnswer.trim() || null,
      explanation: explanation.trim() || null,
    };

    if (questionType === "MCQ") {
      payload.options = options.filter((o) => o.text.trim() !== "");
      const correctOpt = payload.options.find((o: any) => o.isCorrect);
      if (correctOpt) {
        payload.correctAnswer = correctOpt.id;
      }
    } else if (questionType === "CREATIVE_NCTB") {
      payload.subQuestions = subQuestions.filter((sq) => sq.text.trim() !== "");
      payload.marks = subQuestions.reduce((sum, sq) => sum + (Number(sq.marks) || 0), 0) || 10;
    }

    saveMutation.mutate(payload);
  };

  // KPIs
  const totalCount = questions.length;
  const mcqCount = questions.filter((q) => q.type === "MCQ").length;
  const creativeCount = questions.filter((q) => q.type === "CREATIVE_NCTB").length;
  const shortCount = questions.filter((q) => q.type === "SHORT" || q.type === "FILL_BLANK").length;

  const difficultyColors: Record<string, string> = {
    EASY: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    MEDIUM: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    HARD: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("questionBank.title")}
        description={t("questionBank.description")}
      >
        <Button onClick={handleOpenAdd} className="gap-2 shadow-sm font-semibold">
          <Plus className="h-4 w-4" />
          {t("questionBank.addQuestion")}
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ERPMetricCard
          title={t("questionBank.totalQuestions")}
          value={totalCount}
          subtitle={t("questionBank.repositoryQuestions")}
          icon={FileQuestion}
        />
        <ERPMetricCard
          title={t("questionBank.mcqCount")}
          value={mcqCount}
          subtitle={t("questionBank.multipleChoice")}
          icon={CheckCircle2}
        />
        <ERPMetricCard
          title={t("questionBank.creativeCount")}
          value={creativeCount}
          subtitle={t("questionBank.creativeBroad")}
          icon={Sparkles}
        />
        <ERPMetricCard
          title={t("questionBank.shortCount")}
          value={shortCount}
          subtitle={t("questionBank.shortPrompts")}
          icon={BookOpen}
        />
      </div>

      {/* Filter Bar */}
      <Card className="shadow-sm border-border/80 bg-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("questionBank.searchPlaceholder")}
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

            {/* Question Type Filter */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={t("questionBank.filterAllTypes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("questionBank.filterAllTypes")}</SelectItem>
                {QUESTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`questionBank.types.${type}` as any)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Questions Grid / List */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : questions.length === 0 ? (
        <Card className="py-16 text-center border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-muted rounded-full text-muted-foreground">
              <FileQuestion className="h-8 w-8" />
            </div>
            <h3 className="text-base font-semibold">{t("questionBank.noQuestions")}</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {t("questionBank.noQuestionsHint")}
            </p>
            <Button onClick={handleOpenAdd} size="sm" className="mt-2">
              <Plus className="h-4 w-4 mr-1.5" />
              {t("questionBank.addQuestion")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <Card
              key={q.id}
              className="border-border hover:border-primary/50 transition-all shadow-sm hover:shadow group bg-card"
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono">
                        #{idx + 1}
                      </span>
                      <Badge variant="outline" className="text-xs bg-primary/5 font-semibold">
                        {q.class?.name || t("questionBank.classFallback")}
                      </Badge>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {q.subject?.name || t("questionBank.subjectFallback")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {t(`questionBank.types.${q.type}` as any) || q.type}
                      </Badge>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                          difficultyColors[q.difficulty] || "bg-muted"
                        }`}
                      >
                        {t(`questionBank.difficulties.${q.difficulty}` as any) || q.difficulty}
                      </span>
                      {q.chapter && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {q.chapter}
                        </span>
                      )}
                      <span className="ml-auto text-xs font-bold text-foreground font-mono bg-accent/50 px-2 py-0.5 rounded">
                        {q.marks} {t("questionBank.marks")}
                      </span>
                    </div>

                    {/* Stimulus Context if present */}
                    {q.stimulus && (
                      <div className="p-3 bg-muted/40 rounded-md border-l-2 border-primary text-xs italic text-muted-foreground line-clamp-2">
                        {q.stimulus}
                      </div>
                    )}

                    {/* Question text */}
                    <div className="text-sm font-medium text-foreground whitespace-pre-wrap">
                      {q.questionText}
                    </div>

                    {/* MCQ preview snippet */}
                    {q.type === "MCQ" && Array.isArray(q.options) && q.options.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {q.options.map((opt: any) => (
                          <div
                            key={opt.id}
                            className={`text-xs px-2.5 py-1.5 rounded border flex items-center gap-1.5 ${
                              opt.isCorrect
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-semibold"
                                : "bg-muted/30 border-border text-muted-foreground"
                            }`}
                          >
                            <span className="font-mono text-[10px] uppercase font-bold">{opt.id}.</span>
                            <span className="truncate">{opt.text}</span>
                            {opt.isCorrect && <Check className="h-3 w-3 ml-auto text-emerald-600 shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Creative CQ snippet */}
                    {q.type === "CREATIVE_NCTB" && Array.isArray(q.subQuestions) && (
                      <div className="space-y-1 pt-1">
                        {q.subQuestions.map((sq: any) => (
                          <div key={sq.label} className="text-xs text-muted-foreground flex gap-2">
                            <span className="font-bold text-foreground font-mono">({sq.label})</span>
                            <span className="truncate flex-1">{sq.text}</span>
                            <span className="font-mono text-[10px] bg-muted px-1.5 rounded">
                              [{sq.marks}m]
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 pt-1 md:pt-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewQuestion(q)}
                      title={t("questionBank.viewDetails")}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(q)}
                      title={t("questionBank.editQuestion")}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(q.id)}
                      title={t("questionBank.deleteQuestion")}
                      className="h-8 w-8 p-0 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-rose-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TopSheet Slide-Down Form for Add/Edit Question */}
      <TopSheet
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          resetForm();
        }}
        title={editingQuestion ? t("questionBank.editQuestion") : t("questionBank.addQuestion")}
        description={t("questionBank.description")}
        maxWidth="4xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* Top metadata grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionBank.class")} *
              </label>
              <Select value={classId} onValueChange={(value) => { setClassId(value); setSubjectId(""); }} required>
                <SelectTrigger>
                  <SelectValue placeholder={t("questionBank.selectClass")} />
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
                {t("questionBank.subject")} *
              </label>
              <Select value={subjectId} onValueChange={setSubjectId} required>
                <SelectTrigger>
                  <SelectValue placeholder={t("questionBank.selectSubject")} />
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
                {t("questionBank.questionType")} *
              </label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`questionBank.types.${type}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionBank.difficulty")} *
              </label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_DIFFICULTIES.map((diff) => (
                    <SelectItem key={diff} value={diff}>
                      {t(`questionBank.difficulties.${diff}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionBank.chapter")}
              </label>
              <Input
                placeholder={t("questionBank.chapterPlaceholder")}
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionBank.topic")}
              </label>
              <Input
                placeholder={t("questionBank.topicPlaceholder")}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionBank.marks")} *
              </label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={marks}
                onChange={(e) => setMarks(parseFloat(e.target.value) || 1)}
                required
              />
            </div>
          </div>

          {/* Stimulus / Passage (Optional or for Creative/Reading questions) */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
              <span>{t("questionBank.stimulus")}</span>
              <span className="text-[10px] text-muted-foreground font-normal">{t("questionBank.optionalLabel")}</span>
            </label>
            <Textarea
              placeholder={t("questionBank.stimulusPlaceholder")}
              value={stimulus}
              onChange={(e) => setStimulus(e.target.value)}
              rows={2}
              className="text-xs font-normal"
            />
          </div>

          {/* Main Question Text */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              {t("questionBank.questionText")} *
            </label>
            <Textarea
              placeholder={t("questionBank.questionTextPlaceholder")}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              required
            />
          </div>

          {/* MCQ Option Builder */}
          {questionType === "MCQ" && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {t("questionBank.options")} (Select the correct answer)
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {options.map((opt, oIdx) => (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-2 p-2 rounded-md border ${
                      opt.isCorrect ? "bg-emerald-500/10 border-emerald-500/40" : "bg-background border-border"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold w-6 h-6 rounded bg-muted flex items-center justify-center">
                      {opt.id}
                    </span>
                    <Input
                      placeholder={`Option ${opt.id} text...`}
                      value={opt.text}
                      onChange={(e) => {
                        const newText = e.target.value;
                        setOptions((prev) =>
                          prev.map((item, idx) => (idx === oIdx ? { ...item, text: newText } : item))
                        );
                      }}
                      className="h-8 text-xs bg-background"
                      required
                    />
                    <Button
                      type="button"
                      variant={opt.isCorrect ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setOptions((prev) =>
                          prev.map((item, idx) => ({ ...item, isCorrect: idx === oIdx }))
                        );
                      }}
                      className="h-8 text-xs shrink-0"
                    >
                      {opt.isCorrect ? <Check className="h-3.5 w-3.5" /> : t("questionBank.correctOption")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NCTB Creative (CQ) Sub-Questions Builder */}
          {questionType === "CREATIVE_NCTB" && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {t("questionBank.subQuestions")}
              </h4>
              <div className="space-y-2">
                {subQuestions.map((sq, sqIdx) => (
                  <div key={sq.label} className="flex items-center gap-2">
                    <span className="font-bold text-xs w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center font-mono shrink-0">
                      ({sq.label})
                    </span>
                    <Input
                      placeholder={t("questionBank.promptPartPlaceholder", { label: sq.label })}
                      value={sq.text}
                      onChange={(e) => {
                        const text = e.target.value;
                        setSubQuestions((prev) =>
                          prev.map((item, idx) => (idx === sqIdx ? { ...item, text } : item))
                        );
                      }}
                      className="h-8 text-xs bg-background"
                      required
                    />
                    <Input
                      type="number"
                      min="1"
                      value={sq.marks}
                      onChange={(e) => {
                        const m = parseFloat(e.target.value) || 1;
                        setSubQuestions((prev) =>
                          prev.map((item, idx) => (idx === sqIdx ? { ...item, marks: m } : item))
                        );
                      }}
                      className="w-16 h-8 text-xs bg-background font-mono text-center"
                    />
                    <span className="text-[11px] text-muted-foreground font-mono">{t("questionBank.points")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solution & Explanation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionBank.correctAnswer")}
              </label>
              <Textarea
                placeholder={t("questionBank.answerPlaceholder")}
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                {t("questionBank.explanation")}
              </label>
              <Textarea
                placeholder={t("questionBank.explanationPlaceholder")}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} className="font-bold">
              {saveMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </form>
      </TopSheet>

      {/* Preview Dialog */}
      {previewQuestion && (
        <Dialog open={!!previewQuestion} onOpenChange={() => setPreviewQuestion(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileQuestion className="h-5 w-5 text-primary" />
                {previewQuestion.class?.name} - {previewQuestion.subject?.name}
              </DialogTitle>
              <DialogDescription>
                {t(`questionBank.types.${previewQuestion.type}` as any)} • {previewQuestion.marks} {t("questionBank.marks")} •{" "}
                {previewQuestion.difficulty}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {previewQuestion.stimulus && (
                <div className="p-3 bg-muted rounded-md text-xs italic border-l-4 border-primary">
                  <div className="font-bold uppercase text-[10px] text-muted-foreground not-italic mb-1">
                    {t("questionBank.stimulusLabel")}
                  </div>
                  {previewQuestion.stimulus}
                </div>
              )}

              <div className="text-sm font-semibold text-foreground whitespace-pre-wrap">
                {previewQuestion.questionText}
              </div>

              {previewQuestion.type === "MCQ" && Array.isArray(previewQuestion.options) && (
                <div className="grid grid-cols-2 gap-2">
                  {previewQuestion.options.map((opt: any) => (
                    <div
                      key={opt.id}
                      className={`p-2 rounded border text-xs flex items-center justify-between ${
                        opt.isCorrect ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 font-semibold" : "bg-card"
                      }`}
                    >
                      <span>
                        <strong className="mr-2 font-mono">({opt.id})</strong> {opt.text}
                      </span>
                      {opt.isCorrect && <Check className="h-4 w-4 text-emerald-600" />}
                    </div>
                  ))}
                </div>
              )}

              {previewQuestion.type === "CREATIVE_NCTB" && Array.isArray(previewQuestion.subQuestions) && (
                <div className="space-y-2">
                  {previewQuestion.subQuestions.map((sq: any) => (
                    <div key={sq.label} className="p-2 rounded bg-muted/40 text-xs flex justify-between">
                      <span>
                        <strong className="mr-2 font-mono">({sq.label})</strong> {sq.text}
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {sq.marks} {t("questionBank.marks")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {previewQuestion.correctAnswer && (
                <div className="p-3 bg-emerald-500/5 rounded border border-emerald-500/20 text-xs">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                    {t("questionBank.solutionKeyLabel")}
                  </span>
                  {previewQuestion.correctAnswer}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
