import React from 'react';
import Link from 'next/link';
import { ExamPaperStudioModel as ExamPaper } from '@/types/exam-studio';
import { EXAM_TEMPLATES } from '@/lib/question-paper-studio/templates';
import { AppDropdown } from '@/components/ui/app-dropdown';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Printer,
  Layers,
  Settings,
  BookOpen,
  Search,
  ZoomIn,
  ZoomOut,
  GraduationCap,
  Save,
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
          <Button asChild variant="outline" size="icon-sm" title="ফিরে যান (Exit Studio)">
            <Link href="/exams/question-papers">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>

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
            <AppDropdown
              onChange={(v) => {
                const found = EXAM_TEMPLATES.find((t) => t.id === v);
                if (found) onSelectTemplate(found);
              }}
              value={paper.id}
              options={EXAM_TEMPLATES.map((tmpl) => ({ value: tmpl.id, label: tmpl.title }))}
              placeholder="প্রশ্নপত্র স্টাইল সিলেক্ট করুন (Styles)..."
              triggerClassName="text-xs bg-muted/60 hover:bg-muted font-medium max-w-[260px]"
            />
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenOmniPalette}
            className="bg-muted/60 text-muted-foreground hover:bg-muted"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden md:inline">কমান্ড</span>
            <kbd className="text-[10px] font-mono px-1 py-0.2 bg-card border border-border rounded text-muted-foreground hidden sm:inline">
              Ctrl+K
            </kbd>
          </Button>

          {/* Question Bank Direct Import */}
          {onOpenQuestionBankModal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenQuestionBankModal}
              title="প্রশ্ন ব্যাংক থেকে ইমপোর্ট করুন"
              className="bg-muted font-semibold hover:bg-muted/80"
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>প্রশ্ন ব্যাংক</span>
            </Button>
          )}

          {/* Cognitive Balance Meter Toggle */}
          {onOpenCognitiveBalance && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCognitiveBalance}
              title="ব্লুমস ট্যাক্সোনমি ও মান ভারসাম্য"
              className="bg-muted hover:bg-muted/80"
            >
              <PieChart className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden lg:inline">ব্যালেন্স মিটার</span>
            </Button>
          )}

          {/* Batch Sets Generator */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenBatchModal}
            title="মাল্টিপল সেট ও শাফলিং"
            className="bg-muted hover:bg-muted/80"
          >
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden md:inline">সেট শাফলিং</span>
          </Button>

          {/* Layout Settings Drawer */}
          <Button
            type="button"
            size="sm"
            onClick={onOpenSettingsDrawer}
            title="লেআউট সেটিংস ও ফন্ট"
            className="font-semibold"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>লেআউট ও ফন্ট</span>
          </Button>
        </div>

        {/* Right: Zoom & Export Actions */}
        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden xl:flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/40">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onZoomChange(Math.max(0.7, zoomLevel - 0.1))}
              title="জুম আউট"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[11px] font-mono font-medium px-1.5 text-muted-foreground">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onZoomChange(Math.min(1.4, zoomLevel + 0.1))}
              title="জুম ইন"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Unified Print & PDF Action */}
          <Button
            type="button"
            size="sm"
            onClick={onPrint}
            title="প্রশ্নপত্র সরাসরি প্রিন্ট বা PDF আকারে সংরক্ষণ করুন"
            className="bg-foreground text-background hover:bg-foreground/90 font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>প্রিন্ট / PDF</span>
          </Button>

          {/* Database Save */}
          {onSavePaper && (
            <Button
              type="button"
              size="sm"
              onClick={onSavePaper}
              loading={isSaving}
              className="font-bold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>সংরক্ষণ করুন</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
