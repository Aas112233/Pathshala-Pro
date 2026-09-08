'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Layers,
  Settings,
  FileDown,
  Printer,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  Save,
  BookOpen,
  Calendar,
  GraduationCap,
  Sliders,
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

export default function CreateQuestionPaperStudioPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { settings } = useTenantSettings();

  // Active Exam Paper State initialized with standard template
  const [currentPaper, setCurrentPaper] = useState<ExamPaper>(() => {
    return JSON.parse(JSON.stringify(EXAM_TEMPLATES[0]));
  });

  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty, 'question-paper-create');

  // Sync tenant institute name when settings load
  React.useEffect(() => {
    if (settings?.name && !currentPaper.header.instituteName) {
      setCurrentPaper((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          instituteName: settings.name,
          subInstituteText: settings.address || prev.header.subInstituteText || '',
        },
      }));
    }
  }, [settings?.name, settings?.address]);

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

  // Fetch subjects
  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-all'],
    queryFn: async () => {
      const res = await fetch('/api/subjects');
      if (!res.ok) throw new Error('Failed to fetch subjects');
      return res.json();
    },
  });
  const subjects = subjectsData?.data || [];

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
    return subjects.filter((s: any) => !s.classId || s.classId === classId);
  }, [subjects, classId]);

  // Sync Header details with DB selectors
  const handleSelectClass = (newClassId: string) => {
    setClassId(newClassId);
    const cls = classes.find((c: any) => c.id === newClassId);
    if (cls) {
      setCurrentPaper((prev) => ({
        ...prev,
        header: {
          ...prev.header,
          gradeClass: cls.name,
        },
      }));
    }
  };

  const handleSelectSubject = (newSubjectId: string) => {
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
    setEditingQuestion({
      question: null,
      sectionId,
    });
  };

  const handleEditQuestion = (question: QuestionItem, sectionId: string) => {
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
        format: currentPaper.layout.pageFormat.toLowerCase() as any,
        scale: 2.5,
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

  // Save to Database Mutation
  const saveMutation = useMutation({
    mutationFn: async (status: 'DRAFT' | 'READY') => {
      const effectiveAcademicYearId = academicYearId || (academicYears[0]?.id as string);
      const effectiveClassId = classId || (classes[0]?.id as string);
      const effectiveSubjectId = subjectId || (subjects[0]?.id as string);

      if (!effectiveAcademicYearId || !effectiveClassId || !effectiveSubjectId) {
        throw new Error('অনুগ্রহ করে শিক্ষাবর্ষ, শ্রেণি ও বিষয় নির্বাচন করুন');
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
        academicYearId: effectiveAcademicYearId,
        classId: effectiveClassId,
        subjectId: effectiveSubjectId,
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

      const res = await fetch('/api/question-papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save question paper');
      }

      return res.json();
    },
    onSuccess: (data) => {
      setIsDirty(false);
      toast.success(t('questionPapers.savedSuccess') || 'প্রশ্নপত্র সফলভাবে ডাটাবেজে সংরক্ষিত হয়েছে');
      queryClient.invalidateQueries({ queryKey: ['question-papers'] });
      router.push(`/exams/question-papers/${data.data.id}/preview`);
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
      case 'export-pdf':
        handleExportPDF();
        break;
      case 'open-print':
        triggerPrintWindow();
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
      case 'template-bangla-ssc':
        handleSelectTemplate(EXAM_TEMPLATES[0]);
        break;
      case 'template-cambridge-edexcel':
        handleSelectTemplate(EXAM_TEMPLATES[1]);
        break;
      case 'template-cbse-icse':
        handleSelectTemplate(EXAM_TEMPLATES[2]);
        break;
      case 'template-madrasah-dakhil':
        handleSelectTemplate(EXAM_TEMPLATES[3]);
        break;
      case 'template-mcq-omr-speed':
        handleSelectTemplate(EXAM_TEMPLATES[4]);
        break;
      case 'template-primary-worksheet':
        handleSelectTemplate(EXAM_TEMPLATES[5]);
        break;
      case 'template-university-final':
        handleSelectTemplate(EXAM_TEMPLATES[6]);
        break;
      case 'template-class-test-slip':
        handleSelectTemplate(EXAM_TEMPLATES[7]);
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)] bg-background text-foreground">
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
        onSavePaper={() => saveMutation.mutate('READY')}
        isSaving={saveMutation.isPending}
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
                ERP Linked
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
                value={academicYearId || academicYears[0]?.id || ''}
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
                value={classId || classes[0]?.id || ''}
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
                value={subjectId || filteredSubjects[0]?.id || ''}
                onChange={handleSelectSubject}
                placeholder="বিষয় নির্বাচন করুন..."
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
                  value={currentPaper.header.instituteName}
                  onChange={(e) =>
                    setCurrentPaper((prev) => ({
                      ...prev,
                      header: { ...prev.header, instituteName: e.target.value },
                    }))
                  }
                  className="w-full px-2.5 py-1 bg-background border border-input rounded text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                  উপ-শিরোনাম / ঠিকানা (Sub Header)
                </label>
                <input
                  type="text"
                  value={currentPaper.header.subInstituteText || ''}
                  onChange={(e) =>
                    setCurrentPaper((prev) => ({
                      ...prev,
                      header: { ...prev.header, subInstituteText: e.target.value },
                    }))
                  }
                  className="w-full px-2.5 py-1 bg-background border border-input rounded text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                    মোট মান
                  </label>
                  <input
                    type="text"
                    value={currentPaper.header.totalMarks}
                    onChange={(e) =>
                      setCurrentPaper((prev) => ({
                        ...prev,
                        header: { ...prev.header, totalMarks: e.target.value },
                      }))
                    }
                    className="w-full px-2 py-1 bg-background border border-input rounded text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                    সময়
                  </label>
                  <input
                    type="text"
                    value={currentPaper.header.timeAllowed}
                    onChange={(e) =>
                      setCurrentPaper((prev) => ({
                        ...prev,
                        header: { ...prev.header, timeAllowed: e.target.value },
                      }))
                    }
                    className="w-full px-2 py-1 bg-background border border-input rounded text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-border space-y-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate('DRAFT')}
                disabled={saveMutation.isPending}
                className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>ড্রাফট হিসেবে সংরক্ষণ</span>
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
                onUpdatePaper={setCurrentPaper}
                onEditQuestion={handleEditQuestion}
                onAddQuestion={handleAddQuestion}
                onOpenQuestionBank={(secId) => {
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
          setCurrentPaper(newPaper);
          toast.success(`সেট চালু করা হয়েছে: ${newPaper.header.examSet}`);
        }}
      />

      <LayoutSettingsDrawer
        isOpen={isSettingsOpen}
        paper={currentPaper}
        onClose={() => setIsSettingsOpen(false)}
        onUpdatePaper={setCurrentPaper}
      />

      <OmniPalette
        isOpen={isOmniPaletteOpen}
        onClose={() => setIsOmniPaletteOpen(false)}
        onSelectAction={handlePaletteAction}
      />
    </div>
  );
}
