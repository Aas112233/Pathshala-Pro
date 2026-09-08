import React from 'react';
import Link from 'next/link';
import { ExamPaperStudioModel as ExamPaper } from '@/types/exam-studio';
import { EXAM_TEMPLATES } from '@/lib/question-paper-studio/templates';
import {
  ArrowLeft,
  FileDown,
  Printer,
  Layers,
  Settings,
  BookOpen,
  Search,
  ZoomIn,
  ZoomOut,
  GraduationCap,
  Save,
  Loader2,
  PieChart,
} from 'lucide-react';

interface TopNavbarProps {
  paper: ExamPaper;
  zoomLevel: number;
  onZoomChange: (newZoom: number) => void;
  onSelectTemplate: (template: ExamPaper) => void;
  onOpenQuestionBankModal?: () => void;
  onOpenCognitiveBalance?: () => void;
  onOpenBatchModal: () => void;
  onOpenSettingsDrawer: () => void;
  onOpenOmniPalette: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
  isExporting: boolean;
  onSavePaper?: () => void;
  isSaving?: boolean;
}

export function TopNavbar({
  paper,
  zoomLevel,
  onZoomChange,
  onSelectTemplate,
  onOpenQuestionBankModal,
  onOpenCognitiveBalance,
  onOpenBatchModal,
  onOpenSettingsDrawer,
  onOpenOmniPalette,
  onExportPDF,
  onPrint,
  isExporting,
  onSavePaper,
  isSaving,
}: TopNavbarProps) {
  const totalCalculatedMarks = paper.sections.reduce((secAcc, section) => {
    return (
      secAcc +
      section.questions.reduce((qAcc, q) => {
        const numericMarks = typeof q.marks === 'number' ? q.marks : parseFloat(String(q.marks)) || 0;
        return qAcc + numericMarks;
      }, 0)
    );
  }, 0);

  const totalQuestionsCount = paper.sections.reduce(
    (acc, sec) => acc + sec.questions.length,
    0
  );

  return (
    <header className="no-print sticky top-0 z-40 bg-card text-card-foreground border-b border-border shadow-xs">
      <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Brand & Template Switcher */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/exams/question-papers"
            title="ফিরে যান (Exit Studio)"
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors border border-border/60 flex items-center justify-center shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
              <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground tracking-tight truncate max-w-[200px] sm:max-w-xs">
                  {paper.header.instituteName || 'Question Paper Studio'}
                </span>
                {paper.header.sessionYear && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border border-border rounded">
                    {paper.header.sessionYear}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

          {/* Preset Exam Styles Selector (8 styles) */}
          <div className="relative">
            <select
              aria-label="Preset Examination Templates"
              onChange={(e) => {
                const found = EXAM_TEMPLATES.find((t) => t.id === e.target.value);
                if (found) onSelectTemplate(found);
              }}
              value={paper.id}
              className="text-xs bg-muted/60 hover:bg-muted text-foreground border border-border rounded-md px-2.5 py-1.5 pr-6 cursor-pointer font-medium focus:ring-1 focus:ring-primary focus:outline-none max-w-[260px] truncate"
            >
              <option value="" disabled>
                প্রশ্নপত্র স্টাইল সিলেক্ট করুন (Styles)...
              </option>
              {EXAM_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.title}
                </option>
              ))}
            </select>
          </div>

          {/* Metrics summary */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground ml-2">
            <span className="font-medium text-foreground">
              {totalQuestionsCount}টি প্রশ্ন
            </span>
            <span>•</span>
            <span className="font-mono font-semibold text-primary">
              মোট মান: {totalCalculatedMarks} / {paper.header.totalMarks || '১০০'}
            </span>
          </div>
        </div>

        {/* Center: Command Palette & Smart Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Omni Command Palette Trigger */}
          <button
            type="button"
            onClick={onOpenOmniPalette}
            className="px-2.5 py-1 bg-muted/60 hover:bg-muted border border-border rounded-md text-xs text-muted-foreground flex items-center gap-2 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden md:inline">কমান্ড</span>
            <kbd className="text-[10px] font-mono px-1 py-0.2 bg-card border border-border rounded text-muted-foreground hidden sm:inline">
              Ctrl+K
            </kbd>
          </button>

          {/* Question Bank Direct Import */}
          {onOpenQuestionBankModal && (
            <button
              type="button"
              onClick={onOpenQuestionBankModal}
              className="px-2.5 py-1 bg-muted hover:bg-muted/80 border border-border text-foreground rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="প্রশ্ন ব্যাংক থেকে ইমপোর্ট করুন"
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>প্রশ্ন ব্যাংক</span>
            </button>
          )}

          {/* Cognitive Balance Meter Toggle */}
          {onOpenCognitiveBalance && (
            <button
              type="button"
              onClick={onOpenCognitiveBalance}
              className="px-2.5 py-1 bg-muted hover:bg-muted/80 border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="ব্লুমস ট্যাক্সনমি ও মান ভারসাম্য"
            >
              <PieChart className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden lg:inline">ব্যালেন্স মিটার</span>
            </button>
          )}

          {/* Batch Sets Generator */}
          <button
            type="button"
            onClick={onOpenBatchModal}
            className="px-2.5 py-1 bg-muted hover:bg-muted/80 border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="মাল্টিপল সেট ও শাফলিং"
          >
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden md:inline">সেট শাফলিং</span>
          </button>

          {/* Layout Settings Drawer */}
          <button
            type="button"
            onClick={onOpenSettingsDrawer}
            className="px-2.5 py-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            title="লেআউট সেটিংস ও ফন্ট"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>লেআউট ও ফন্ট</span>
          </button>
        </div>

        {/* Right: Zoom & Export Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden xl:flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(0.7, zoomLevel - 0.1))}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="জুম আউট"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-medium px-1.5 text-muted-foreground">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(1.4, zoomLevel + 0.1))}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="জুম ইন"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Unified Print & PDF Action */}
          <button
            type="button"
            onClick={onPrint}
            className="px-3 py-1.5 bg-foreground text-background hover:bg-foreground/90 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            title="প্রশ্নপত্র সরাসরি প্রিন্ট বা PDF আকারে সংরক্ষণ করুন"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>প্রিন্ট / PDF</span>
          </button>

          {/* Database Save */}
          {onSavePaper && (
            <button
              type="button"
              onClick={onSavePaper}
              disabled={isSaving}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>সংরক্ষণ করুন</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
