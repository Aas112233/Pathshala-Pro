'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Layers,
  Settings,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  Save,
  BookOpen,
  Calendar,
  GraduationCap,
  Sliders,
  Lock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import { ExamPaperStudioModel as ExamPaper, QuestionItem } from '@/types/exam-studio';
import { EXAM_TEMPLATES } from '@/lib/question-paper-studio/templates';
import { exportElementToHighResPDF, triggerPrintWindow } from '@/lib/question-paper-studio/pdf-export';
import { PaperCanvas } from '@/components/question-paper-studio/paper-canvas';
import { TopNavbar } from '@/components/question-paper-studio/top-navbar';
import { QuestionEditorModal } from '@/components/question-paper-studio/question-editor-modal';
import { QuestionBankImportModal } from '@/components/question-paper-studio/question-bank-import-modal';
import { CognitiveBalanceMeter } from '@/components/question-paper-studio/cognitive-balance-meter';
import { BatchProcessingModal } from '@/components/question-paper-studio/batch-processing-modal';
import { LayoutSettingsDrawer } from '@/components/question-paper-studio/layout-settings-drawer';
import { OmniPalette } from '@/components/question-paper-studio/omni-palette';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppDropdown } from '@/components/ui/app-dropdown';
import { useTenantSettings } from '@/components/providers/tenant-settings-provider';
import { useUnsavedChanges } from '@/providers/unsaved-changes-provider';

export default function EditQuestionPaperStudioPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const { settings } = useTenantSettings();

  // Active Exam Paper State
  const [currentPaper, setCurrentPaper] = useState<ExamPaper>(() => {
    return JSON.parse(JSON.stringify(EXAM_TEMPLATES[0]));
  });

  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty, `question-paper-edit-${id}`);

  // DB Linkage State
  const [academicYearId, setAcademicYearId] = useState<string>('');
  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [examId, setExamId] = useState<string>('');

  // UI Navigation & Modal States
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isOmniPaletteOpen, setIsOmniPaletteOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Question Bank & Balance States
  const [isQuestionBankModalOpen, setIsQuestionBankModalOpen] = useState<boolean>(false);
  const [bankImportSectionId, setBankImportSectionId] = useState<string | undefined>(undefined);
  const [isCognitiveBalanceOpen, setIsCognitiveBalanceOpen] = useState<boolean>(false);

  // Question Editor modal state
  const [editingQuestion, setEditingQuestion] = useState<{
    question: QuestionItem | null;
    sectionId: string;
  } | null>(null);

  // Fetch Existing Paper Details
  const { data: paperData, isLoading: isPaperLoading } = useQuery({
    queryKey: ['question-paper-detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/question-papers/${id}`);
      if (!res.ok) throw new Error('Failed to fetch question paper');
      return res.json();
    },
    enabled: !!id,
  });

  const isLocked = paperData?.data?.isLocked || false;
  const lockReason = paperData?.data?.lockReason || '';

  // Strict Lock Guard: Never allow opening locked papers in Edit Engine
  useEffect(() => {
    if (isLocked) {
      toast.error(
        lockReason || 'পরীক্ষার ফলাফল প্রকাশিত হওয়ায় এই প্রশ্নপত্রটি লক করা হয়েছে। এটি শুধুমাত্র দেখা ও প্রিন্ট করা যাবে।',
        { id: `locked-paper-${id}` }
      );
      router.replace(`/exams/question-papers/${id}/preview`);
    }
  }, [isLocked, lockReason, id, router]);

  // Hydrate state when paper details load
  useEffect(() => {
    if (paperData?.data && !paperData.data.isLocked) {
      const p = paperData.data;
      setAcademicYearId(p.academicYearId || '');
      setClassId(p.classId || '');
      setSubjectId(p.subjectId || '');
      setExamId(p.examId || '');

      const hydratedSections = p.hydratedSections || p.sections || [];

      setCurrentPaper({
        id: p.id,
        title: p.title,
        templateCategory: 'nctb-general',
        header: {
          instituteName: settings?.name || p.tenant?.name || '',
          subInstituteText: settings?.address || p.tenant?.address || '',
          examName: p.exam?.name || 'বার্ষিক পরীক্ষা',
          sessionYear: p.academicYear?.label || '২০২৬',
          subjectName: p.subject?.name || '',
          subjectCode: p.subject?.code || '',
          gradeClass: p.class?.name || '',
          timeAllowed: `${p.durationMinutes || 180} মিনিট`,
          totalMarks: String(p.totalMarks || 100),
          specialInstructions: p.instructions || '',
          examSet: p.code || 'SET-A',
        },
        layout: {
          fontBengali: 'hind',
          fontArabic: 'amiri',
          numeralSystem: 'bengali',
          pageFormat: 'A4',
          columnLayout: 'single',
          headerStyle: 'classic-center',
          fontSize: 'md',
          lineSpacing: 'normal',
          showWatermark: false,
          watermarkText: '',
          watermarkOpacity: 0.08,
          watermarkType: 'text',
          showBorder: true,
          borderStyle: 'solid',
          showHeaderCutLine: false,
          showOMRGrid: false,
          studentInfoBox: false,
          marksPosition: 'right-bracket',
          numberingStyle: 'bengali',
          showDottedAnswerLines: false,
          isRTL: false,
          headerArabicBismillah: false,
          showTeacherNotes: false,
          pageNumberingFormat: 'bengali',
          marginSize: 'standard',
        },
        sections: hydratedSections.map((s: any, idx: number) => ({
          sectionId: s.sectionId || s.id || `sec-${idx + 1}`,
          title: s.title || `বিভাগ ${idx + 1}`,
          subTitle: s.instructions || s.subTitle || '',
          marksInstruction: s.marksInstruction || `[${s.totalMarks || ''} নম্বর]`,
          questions: Array.isArray(s.questions) ? s.questions : [],
        })),
        lastModified: new Date().toISOString(),
        version: '1.0.0',
      });
    }
  }, [paperData, settings]);

  // Fetch academic years
  const { data: yearsData } = useQuery({
    queryKey: ['academic-years-all'],
    queryFn: async () => {
      const res = await fetch('/api/academic-years?limit=100');
      if (!res.ok) throw new Error('Failed to fetch academic years');
      return res.json();
    },
  });
  const academicYears = yearsData?.data || [];

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['classes-all'],
    queryFn: async () => {
      const res = await fetch('/api/classes?limit=100&isActive=true');
      if (!res.ok) throw new Error('Failed to fetch classes');
      return res.json();
    },
  });
  const classes = classesData?.data || [];

  // Fetch subjects (all fallback)
  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-all'],
    queryFn: async () => {
      const res = await fetch('/api/subjects');
      if (!res.ok) throw new Error('Failed to fetch subjects');
      return res.json();
    },
  });
  const subjects = subjectsData?.data || [];

  // Fetch class-specific subjects
  const { data: classSubjectsData } = useQuery({
    queryKey: ['class-subjects', classId],
    queryFn: async () => {
      if (!classId) return [];
      const res = await fetch(`/api/class-subjects?classId=${classId}`);
      if (!res.ok) throw new Error('Failed to fetch class subjects');
      const json = await res.json();
      return (json.data || []).map((cs: any) => ({
        id: cs.subject?.id || cs.subjectId,
        name: cs.subject?.name || 'Unknown',
        code: cs.subject?.code || '',
      }));
    },
    enabled: !!classId,
  });

  // Fetch exams
  const { data: examsData } = useQuery({
    queryKey: ['exams-all'],
    queryFn: async () => {
      const res = await fetch('/api/exams');
      if (!res.ok) throw new Error('Failed to fetch exams');
      return res.json();
    },
  });
  const exams = examsData?.data || [];

  // Filter subjects by selected class
  const filteredSubjects = useMemo(() => {
    if (!classId) return subjects;
    return classSubjectsData || [];
  }, [subjects, classId, classSubjectsData]);

  // Sync Header details with DB selectors
  const handleSelectClass = (newClassId: string) => {
    if (isLocked) return;
    setClassId(newClassId);
    setSubjectId("");
    const cls = classes.find((c: any) => c.id === newClassId);
    if (cls) {
      setCurrentPaper((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          gradeClass: cls.name,
          subject: "",
        },
      }));
    }
  };

  const handleSelectSubject = (newSubjectId: string) => {
    if (isLocked) return;
    setSubjectId(newSubjectId);
    const sub = subjects.find((s: any) => s.id === newSubjectId);
    if (sub) {
      setCurrentPaper((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          subjectName: sub.name,
          subjectCode: sub.code || prev.header.subjectCode,
        },
        title: `${sub.name} - ${prev.header.examName || 'Exam Paper'}`,
      }));
    }
  };

  const handleSelectAcademicYear = (newYearId: string) => {
    if (isLocked) return;
    setAcademicYearId(newYearId);
    const yr = academicYears.find((y: any) => y.id === newYearId);
    if (yr) {
      setCurrentPaper((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          sessionYear: yr.label || yr.yearId || yr.name || prev.header.sessionYear,
        },
      }));
    }
  };

  const handleSelectExam = (newExamId: string) => {
    if (isLocked) return;
    setExamId(newExamId);
    const ex = exams.find((e: any) => e.id === newExamId);
    if (ex) {
      setCurrentPaper((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          examName: ex.name,
        },
      }));
    }
  };

  // Question Management Handlers
  const handleAddQuestion = (sectionId: string) => {
    if (isLocked) {
      toast.error('পরীক্ষার ফলাফল প্রকাশিত হওয়ায় প্রশ্ন যোগ করা যাবে না');
      return;
    }
    setEditingQuestion({
      question: null,
      sectionId,
    });
  };

  const handleEditQuestion = (question: QuestionItem, sectionId: string) => {
    if (isLocked) {
      toast.error('পরীক্ষার ফলাফল প্রকাশিত হওয়ায় প্রশ্ন সম্পাদনা করা যাবে না');
      return;
    }
    setEditingQuestion({
      question,
      sectionId,
    });
  };

  const handleSaveQuestion = (savedQuestion: QuestionItem, sectionId: string) => {
    const sectionIndex = currentPaper.sections.findIndex((s) => s.sectionId === sectionId);
    if (sectionIndex === -1) return;

    const currentSection = currentPaper.sections[sectionIndex];
    const qIndex = currentSection.questions.findIndex((q) => q.id === savedQuestion.id);

    let updatedQuestions: QuestionItem[];
    if (qIndex >= 0) {
      updatedQuestions = [...currentSection.questions];
      updatedQuestions[qIndex] = savedQuestion;
    } else {
      updatedQuestions = [...currentSection.questions, savedQuestion];
    }

    const updatedSections = [...currentPaper.sections];
    updatedSections[sectionIndex] = {
      ...currentSection,
      questions: updatedQuestions,
    };

    setCurrentPaper({
      ...currentPaper,
      sections: updatedSections,
      lastModified: new Date().toISOString(),
    });
    setIsDirty(true);

    toast.success('প্রশ্নটি সফলভাবে আপডেট হয়েছে');
  };

  // Import from Question Bank
  const handleImportBankQuestions = (questions: QuestionItem[], sectionId: string) => {
    if (isLocked) {
      toast.error('পরীক্ষার ফলাফল প্রকাশিত হওয়ায় প্রশ্ন ইমপোর্ট করা যাবে না');
      return;
    }
    const sIdx = currentPaper.sections.findIndex((s) => s.sectionId === sectionId);
    if (sIdx === -1) return;

    const currentSection = currentPaper.sections[sIdx];
    const updatedQuestions = [...currentSection.questions, ...questions].map((q, idx) => ({
      ...q,
      qNumber: (q as any).qNumber || String(idx + 1),
    }));

    const updatedSections = [...currentPaper.sections];
    updatedSections[sIdx] = {
      ...currentSection,
      questions: updatedQuestions,
    };

    setCurrentPaper({
      ...currentPaper,
      sections: updatedSections,
      lastModified: new Date().toISOString(),
    });

    toast.success(`${questions.length}টি প্রশ্ন ব্যাংক থেকে সফলভাবে যোগ করা হয়েছে`);
  };

  // Switch Preset Template
  const handleSelectTemplate = (template: ExamPaper) => {
    if (isLocked) {
      toast.error('পরীক্ষার ফলাফল প্রকাশিত হওয়ায় টেমপ্লেট পরিবর্তন করা যাবে না');
      return;
    }
    const cloned = JSON.parse(JSON.stringify(template));
    cloned.header.instituteName = settings?.name || currentPaper.header.instituteName || '';
    cloned.header.subInstituteText = settings?.address || currentPaper.header.subInstituteText || '';
    setCurrentPaper(cloned);
    toast.success(`টেমপ্লেট চালু হয়েছে: ${template.title}`);
  };

  // PDF Export
  const handleExportPDF = async () => {
    setIsExporting(true);
    const toastId = toast.loading('300 DPI হাই-রেজোলিউশন PDF প্রস্তুত হচ্ছে...');
    try {
      const sanitizedName = (currentPaper.header.subjectName || currentPaper.title || 'Exam-Paper')
        .replace(/[^a-zA-Z0-9\u0980-\u09FF-]/g, '_');
      const result = await exportElementToHighResPDF('exam-paper-canvas-root', {
        fileName: `${sanitizedName}_${currentPaper.header.examSet || 'Main'}.pdf`,
        paper: currentPaper,
      });

      if (result.success) {
        toast.success('PDF সফলভাবে ডাউনলোড হয়েছে', { id: toastId });
      } else {
        toast.error(result.error || 'PDF তৈরিতে সমস্যা হয়েছে', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'PDF এক্সপোর্টে ত্রুটি হয়েছে', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Save to Database Mutation (PUT /api/question-papers/[id])
  const updateMutation = useMutation({
    mutationFn: async (status: 'DRAFT' | 'READY') => {
      if (isLocked) {
        throw new Error('পরীক্ষার ফলাফল প্রকাশিত হওয়ায় এই প্রশ্নপত্রটি লক করা হয়েছে');
      }

      const calculatedTotalMarks = currentPaper.sections.reduce((secAcc, s) => {
        return (
          secAcc +
          s.questions.reduce((qAcc, q) => {
            const numericMarks = typeof q.marks === 'number' ? q.marks : parseFloat(String(q.marks)) || 0;
            return qAcc + numericMarks;
          }, 0)
        );
      }, 0);

      const payload = {
        title: currentPaper.title || `${currentPaper.header.subjectName} - ${currentPaper.header.examName}`,
        code: currentPaper.header.examSet || 'SET-A',
        academicYearId: academicYearId || undefined,
        classId: classId || undefined,
        subjectId: subjectId || undefined,
        examId: examId || undefined,
        totalMarks: calculatedTotalMarks || parseFloat(currentPaper.header.totalMarks) || 100,
        durationMinutes: 180,
        instructions: currentPaper.header.specialInstructions || '',
        sections: currentPaper.sections.map((sec, idx) => ({
          id: sec.sectionId || `sec-${idx + 1}`,
          title: sec.title,
          instructions: sec.subTitle || sec.marksInstruction || '',
          totalMarks: sec.questions.reduce(
            (acc, q) => acc + (typeof q.marks === 'number' ? q.marks : parseFloat(String(q.marks)) || 0),
            0
          ),
          questionIds: [],
          questions: sec.questions,
        })),
        status,
      };

      const res = await fetch(`/api/question-papers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update question paper');
      }

      return res.json();
    },
    onSuccess: () => {
      setIsDirty(false);
      toast.success('প্রশ্নপত্র সফলভাবে ডাটাবেজে আপডেট হয়েছে');
      queryClient.invalidateQueries({ queryKey: ['question-papers'] });
      queryClient.invalidateQueries({ queryKey: ['question-paper-detail', id] });
      router.push(`/exams/question-papers/${id}/preview`);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  // Omni Palette Action Dispatcher
  const handlePaletteAction = (actionId: string) => {
    switch (actionId) {
      case 'question-bank-import':
        setBankImportSectionId(currentPaper.sections[0]?.sectionId || 'sec-default');
        setIsQuestionBankModalOpen(true);
        break;
      case 'cognitive-balance':
        setIsCognitiveBalanceOpen(true);
        break;
      case 'open-print':
        triggerPrintWindow('exam-paper-canvas-root');
        break;
      case 'batch-sets':
        setIsBatchModalOpen(true);
        break;
      case 'layout-settings':
        setIsSettingsOpen(true);
        break;
      case 'add-cq-question':
      case 'add-mcq-question':
        handleAddQuestion(currentPaper.sections[0]?.sectionId || 'sec-default');
        break;
      default:
        break;
    }
  };

  if (isPaperLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">প্রশ্নপত্র লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)] bg-background text-foreground">
      {/* Lock Alert Banner if Results Published */}
      {isLocked && (
        <div className="no-print bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {lockReason || 'এই পরীক্ষার ফলাফল ডাটাবেজে প্রকাশিত হওয়ায় প্রশ্নপত্রটি সম্পাদনার জন্য লক করা হয়েছে (Read-Only Mode)।'}
            </span>
          </div>
          <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-[10px]">
            Locked: Results Published
          </Badge>
        </div>
      )}

      {/* Top Navbar */}
      <TopNavbar
        paper={currentPaper}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        onSelectTemplate={handleSelectTemplate}
        onOpenQuestionBankModal={() => {
          setBankImportSectionId(currentPaper.sections[0]?.sectionId || 'sec-default');
          setIsQuestionBankModalOpen(true);
        }}
        onOpenCognitiveBalance={() => setIsCognitiveBalanceOpen(true)}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenSettingsDrawer={() => setIsSettingsOpen(true)}
        onOpenOmniPalette={() => setIsOmniPaletteOpen(true)}
        onExportPDF={handleExportPDF}
        onPrint={() => triggerPrintWindow('exam-paper-canvas-root')}
        isExporting={isExporting}
        onSavePaper={() => updateMutation.mutate('READY')}
        isSaving={updateMutation.isPending}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left ERP Parameter Sidebar */}
        {isSidebarOpen && (
          <aside className="no-print w-80 shrink-0 border-r border-border bg-card p-4 overflow-y-auto space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Sliders className="w-4 h-4 text-primary" />
                <span>প্রাতিষ্ঠানিক ডেটা লিংকেজ</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {isLocked ? 'Locked' : 'ERP Linked'}
              </Badge>
            </div>

            {/* Academic Year */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                শিক্ষাবর্ষ (Academic Year) *
              </label>
              <AppDropdown
                options={academicYears.map((y: any) => ({
                  label: (y.label || y.yearId || y.id) + (!y.isClosed ? ' (চলতি বছর)' : ''),
                  value: y.id,
                }))}
                value={academicYearId || ''}
                onChange={handleSelectAcademicYear}
                placeholder="শিক্ষাবর্ষ নির্বাচন করুন..."
                searchable
                noOptionsText="কোনো শিক্ষাবর্ষ পাওয়া যায়নি — সেটিংসে তৈরি করুন"
              />
            </div>

            {/* Class */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                শ্রেণি (Class) *
              </label>
              <AppDropdown
                options={classes.map((c: any) => ({
                  label: c.name,
                  value: c.id,
                }))}
                value={classId || ''}
                onChange={handleSelectClass}
                placeholder="শ্রেণি নির্বাচন করুন..."
              />
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                বিষয় (Subject) *
              </label>
              <AppDropdown
                options={filteredSubjects.map((s: any) => ({
                  label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
                  value: s.id,
                }))}
                value={subjectId || ''}
                onChange={handleSelectSubject}
                placeholder={!classId ? "প্রথমে শ্রেণি নির্বাচন করুন..." : "বিষয় নির্বাচন করুন..."}
                disabled={!classId}
              />
            </div>

            {/* Exam */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                টার্ম / পরীক্ষা (Examination Term)
              </label>
              <AppDropdown
                options={exams.map((e: any) => ({
                  label: e.name,
                  value: e.id,
                }))}
                value={examId}
                onChange={handleSelectExam}
                placeholder="পরীক্ষার নাম নির্বাচন করুন..."
              />
            </div>

            {/* Quick Header Overrides */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="font-bold text-foreground text-xs">
                হেডার বিবরণ (Header Settings)
              </div>

              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                  প্রতিষ্ঠানের নাম (Institute Name)
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={currentPaper.header.instituteName}
                  onChange={(e) =>
                    setCurrentPaper((prev) => ({
                      ...prev,
                      header: { ...prev.header, instituteName: e.target.value },
                    }))
                  }
                  className="w-full px-2.5 py-1 bg-background border border-input rounded text-xs disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                  উপ-শিরোনাম / ঠিকানা (Sub Header)
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={currentPaper.header.subInstituteText || ''}
                  onChange={(e) =>
                    setCurrentPaper((prev) => ({
                      ...prev,
                      header: { ...prev.header, subInstituteText: e.target.value },
                    }))
                  }
                  className="w-full px-2.5 py-1 bg-background border border-input rounded text-xs disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                    মোট মান
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={isLocked}
                    value={currentPaper.header.totalMarks}
                    onChange={(e) =>
                      setCurrentPaper((prev) => ({
                        ...prev,
                        header: { ...prev.header, totalMarks: e.target.value.replace(/[^0-9]/g, "") },
                      }))
                    }
                    className="w-full px-2 py-1 bg-background border border-input rounded text-xs font-mono font-bold disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                    সময়
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={currentPaper.header.timeAllowed}
                    onChange={(e) =>
                      setCurrentPaper((prev) => ({
                        ...prev,
                        header: { ...prev.header, timeAllowed: e.target.value },
                      }))
                    }
                    className="w-full px-2 py-1 bg-background border border-input rounded text-xs disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-border space-y-2">
              <button
                type="button"
                onClick={() => updateMutation.mutate('DRAFT')}
                disabled={updateMutation.isPending || isLocked}
                className="w-full py-2 bg-muted hover:bg-muted/80 disabled:opacity-50 text-foreground border border-border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>ড্রাফট হিসেবে সংরক্ষণ</span>
              </button>

              <button
                type="button"
                onClick={() => updateMutation.mutate('READY')}
                disabled={updateMutation.isPending || isLocked}
                className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>আপডেট সম্পন্ন করুন</span>
              </button>
            </div>
          </aside>
        )}

        {/* Main Document Workspace Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          {/* Subheader Control Bar */}
          <div className="no-print px-4 py-2 bg-card border-b border-border flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded border border-border flex items-center gap-1.5 px-2"
                title={isSidebarOpen ? 'সাইডবার লুকান' : 'সাইডবার দেখান'}
              >
                {isSidebarOpen ? (
                  <>
                    <PanelLeftClose className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">সাইডবার লুকান</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">সাইডবার দেখান</span>
                  </>
                )}
              </button>
              <div className="text-[11px] text-muted-foreground">
                কাগজ: <span className="font-semibold text-foreground">{currentPaper.layout.pageFormat}</span> (210 × 297 mm)
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomLevel(1.0)}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded text-[11px] flex items-center gap-1 px-2"
                title="রিসেট জুম (100%)"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">100% ফিট</span>
              </button>
            </div>
          </div>

          {/* Canvas Scroll Area */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center">
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className="w-full flex justify-center pb-24"
            >
              <PaperCanvas
                paper={currentPaper}
                onUpdatePaper={(p) => !isLocked && setCurrentPaper(p)}
                onEditQuestion={handleEditQuestion}
                onAddQuestion={handleAddQuestion}
                onOpenQuestionBank={(secId) => {
                  if (isLocked) {
                    toast.error('ফলাফল প্রকাশিত হওয়ায় প্রশ্ন যোগ করা যাবে না');
                    return;
                  }
                  setBankImportSectionId(secId);
                  setIsQuestionBankModalOpen(true);
                }}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Modals & Drawers */}
      <QuestionEditorModal
        isOpen={!!editingQuestion}
        question={editingQuestion?.question || null}
        sectionId={editingQuestion?.sectionId || ''}
        onClose={() => setEditingQuestion(null)}
        onSave={handleSaveQuestion}
      />

      <QuestionBankImportModal
        isOpen={isQuestionBankModalOpen}
        sections={currentPaper.sections}
        initialSectionId={bankImportSectionId}
        classId={classId}
        subjectId={subjectId}
        onClose={() => setIsQuestionBankModalOpen(false)}
        onImportQuestions={handleImportBankQuestions}
      />

      <CognitiveBalanceMeter
        isOpen={isCognitiveBalanceOpen}
        paper={currentPaper}
        onClose={() => setIsCognitiveBalanceOpen(false)}
      />

      <BatchProcessingModal
        isOpen={isBatchModalOpen}
        paper={currentPaper}
        onClose={() => setIsBatchModalOpen(false)}
        onApplySet={(newPaper) => {
          if (isLocked) return;
          setCurrentPaper(newPaper);
          toast.success(`সেট চালু করা হয়েছে: ${newPaper.header.examSet}`);
        }}
      />

      <LayoutSettingsDrawer
        isOpen={isSettingsOpen}
        paper={currentPaper}
        onClose={() => setIsSettingsOpen(false)}
        onUpdatePaper={(p) => !isLocked && setCurrentPaper(p)}
      />

      <OmniPalette
        isOpen={isOmniPaletteOpen}
        onClose={() => setIsOmniPaletteOpen(false)}
        onSelectAction={handlePaletteAction}
      />
    </div>
  );
}
