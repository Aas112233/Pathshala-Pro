'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ExamPaperStudioModel as ExamPaper, QuestionItem, ExamSection } from '@/types/exam-studio';
import { QuestionCard } from '@/components/question-paper-studio/question-card';
import { formatNumeral } from '@/lib/question-paper-studio/bengali-numerals';
import { Button } from '@/components/ui/button';
import { Plus, Layers, Trash2, Edit3, BookOpen, Scissors } from 'lucide-react';

interface PaperCanvasProps {
  paper: ExamPaper;
  onUpdatePaper: (updated: ExamPaper) => void;
  onEditQuestion: (question: QuestionItem, sectionId: string) => void;
  onAddQuestion: (sectionId: string) => void;
  onOpenQuestionBank?: (sectionId: string) => void;
}

const emptySubscribe = () => () => {};

export function PaperCanvas({
  paper,
  onUpdatePaper,
  onEditQuestion,
  onAddQuestion,
  onOpenQuestionBank,
}: PaperCanvasProps) {
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent, sectionId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sectionIndex = paper.sections.findIndex((s) => s.sectionId === sectionId);
    if (sectionIndex === -1) return;

    const currentSection = paper.sections[sectionIndex];
    const oldIndex = currentSection.questions.findIndex((q) => q.id === active.id);
    const newIndex = currentSection.questions.findIndex((q) => q.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const updatedQuestions = arrayMove(currentSection.questions, oldIndex, newIndex);
      const renumbered = updatedQuestions.map((q, idx) => ({
        ...q,
        qNumber: formatNumeral(idx + 1, paper.layout.numeralSystem),
      }));

      const updatedSections = [...paper.sections];
      updatedSections[sectionIndex] = {
        ...currentSection,
        questions: renumbered,
      };

      onUpdatePaper({
        ...paper,
        sections: updatedSections,
        lastModified: new Date().toISOString(),
      });
    }
  };

  const handleDeleteQuestion = (sectionId: string, questionId: string) => {
    const sectionIndex = paper.sections.findIndex((s) => s.sectionId === sectionId);
    if (sectionIndex === -1) return;

    const currentSection = paper.sections[sectionIndex];
    const filtered = currentSection.questions.filter((q) => q.id !== questionId);
    const renumbered = filtered.map((q, idx) => ({
      ...q,
      qNumber: formatNumeral(idx + 1, paper.layout.numeralSystem),
    }));

    const updatedSections = [...paper.sections];
    updatedSections[sectionIndex] = {
      ...currentSection,
      questions: renumbered,
    };

    onUpdatePaper({
      ...paper,
      sections: updatedSections,
      lastModified: new Date().toISOString(),
    });
  };

  const handleDuplicateQuestion = (sectionId: string, question: QuestionItem) => {
    const sectionIndex = paper.sections.findIndex((s) => s.sectionId === sectionId);
    if (sectionIndex === -1) return;

    const currentSection = paper.sections[sectionIndex];
    const qIndex = currentSection.questions.findIndex((q) => q.id === question.id);
    if (qIndex === -1) return;

    const duplicated: QuestionItem = {
      ...JSON.parse(JSON.stringify(question)),
      id: `q-dup-${Date.now()}`,
    };

    const newQuestions = [...currentSection.questions];
    newQuestions.splice(qIndex + 1, 0, duplicated);

    const renumbered = newQuestions.map((q, idx) => ({
      ...q,
      qNumber: formatNumeral(idx + 1, paper.layout.numeralSystem),
    }));

    const updatedSections = [...paper.sections];
    updatedSections[sectionIndex] = {
      ...currentSection,
      questions: renumbered,
    };

    onUpdatePaper({
      ...paper,
      sections: updatedSections,
      lastModified: new Date().toISOString(),
    });
  };

  const handleAddSection = () => {
    const newSecNumber = paper.sections.length + 1;
    const newSection: ExamSection = {
      sectionId: `sec-${Date.now()}`,
      title: `বিভাগ ${formatNumeral(newSecNumber, paper.layout.numeralSystem)}`,
      subTitle: 'সকল প্রশ্নের উত্তর দাও',
      marksInstruction: '[পূর্ণমান]',
      questions: [],
    };

    onUpdatePaper({
      ...paper,
      sections: [...paper.sections, newSection],
      lastModified: new Date().toISOString(),
    });
  };

  const handleDeleteSection = (secId: string) => {
    if (paper.sections.length <= 1) return;
    onUpdatePaper({
      ...paper,
      sections: paper.sections.filter((s) => s.sectionId !== secId),
      lastModified: new Date().toISOString(),
    });
  };

  // Font family utility classes
  const getFontFamilyClass = () => {
    switch (paper.layout.fontBengali) {
      case 'tiro':
        return 'font-tiro';
      case 'noto':
        return 'font-noto';
      case 'anek':
        return 'font-anek';
      default:
        return 'font-hind';
    }
  };

  // Border style class
  const getBorderStyleClass = () => {
    if (!paper.layout.showBorder || paper.layout.borderStyle === 'none') return 'border-0';
    switch (paper.layout.borderStyle) {
      case 'double':
        return 'border-4 border-double border-gray-900 dark:border-gray-800 p-6';
      case 'dashed':
        return 'border-2 border-dashed border-gray-800 dark:border-gray-700 p-6';
      case 'dotted':
        return 'border-2 border-dotted border-gray-800 dark:border-gray-700 p-6';
      case 'ornamental':
        return 'border-4 border-double border-gray-900 p-6 outline outline-1 outline-offset-4 outline-gray-800';
      default:
        return 'border border-gray-800 dark:border-gray-700 p-6';
    }
  };

  // Font Size Class
  const getFontSizeClass = () => {
    switch (paper.layout.fontSize) {
      case 'compact':
        return 'text-[12px] leading-snug';
      case 'sm':
        return 'text-[13px] leading-normal';
      case 'lg':
        return 'text-[15px] leading-relaxed';
      case 'xl':
        return 'text-[16px] leading-loose';
      default:
        return 'text-[14px] leading-normal';
    }
  };

  const getMarginClass = () => {
    switch (paper.layout.marginSize) {
      case 'compact':
        return 'p-6';
      case 'wide':
        return 'p-12';
      default:
        return 'p-8';
    }
  };

  const isTwoColumn = paper.layout.columnLayout === 'two-column';
  const headerStyle = paper.layout.headerStyle || 'classic-center';

  const isEnglishPaper = paper.layout.numeralSystem === 'english' || paper.layout.numberingStyle === 'english';
  const isArabicPaper = paper.layout.isRTL || paper.layout.numeralSystem === 'arabic';

  const labels = {
    subject: isEnglishPaper ? 'Subject' : isArabicPaper ? 'المادة' : 'বিষয়',
    subjectCode: isEnglishPaper ? 'Code' : isArabicPaper ? 'رمز المادة' : 'বিষয় কোড',
    class: isEnglishPaper ? 'Class' : isArabicPaper ? 'الصف' : 'শ্রেণি',
    time: isEnglishPaper ? 'Time' : isArabicPaper ? 'الوقت' : 'সময়',
    fullMarks: isEnglishPaper ? 'Full Marks' : isArabicPaper ? 'الدرجة الكاملة' : 'পূর্ণমান',
    set: isEnglishPaper ? 'Set' : isArabicPaper ? 'النموذج' : 'সেট',
    studentName: isEnglishPaper ? "Student's Name" : isArabicPaper ? 'اسم الطالب' : 'শিক্ষার্থীর নাম',
    rollNo: isEnglishPaper ? 'Roll No' : isArabicPaper ? 'رقم الجلوس' : 'রোল নং',
    section: isEnglishPaper ? 'Section' : isArabicPaper ? 'الشعبة' : 'শাখা',
    cutLine: isEnglishPaper ? 'Cut along the dotted line' : isArabicPaper ? 'اقطع من هنا' : 'এখান থেকে কেটে আলাদা করুন (Cut Here)',
    addManualQ: isEnglishPaper ? 'Add Question' : isArabicPaper ? 'إضافة سؤال' : 'ম্যানুয়াল প্রশ্ন যোগ করুন',
    importBank: isEnglishPaper ? 'Import from Bank' : isArabicPaper ? 'استيراد من بنك' : 'প্রশ্ন ব্যাংক থেকে আনুন',
    addSection: isEnglishPaper ? 'Add New Section' : isArabicPaper ? 'إضافة قسم جديد' : 'নতুন বিভাগ যুক্ত করুন (Add Section)',
  };

  return (
    <div
      id="exam-paper-canvas-root"
      dir={paper.layout.isRTL ? 'rtl' : 'ltr'}
      className={`relative bg-white text-black shadow-2xl transition-all duration-200 mx-auto select-text font-serif ${getFontFamilyClass()} ${getFontSizeClass()} ${getMarginClass()} w-full max-w-[210mm] min-h-[297mm]`}
    >
      {/* Background Watermark */}
      {paper.layout.showWatermark && paper.layout.watermarkText && (
        <div
          style={{ opacity: paper.layout.watermarkOpacity || 0.08 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
        >
          <div className="text-4xl md:text-6xl font-extrabold uppercase tracking-widest text-black transform -rotate-30 text-center px-4 leading-tight">
            {paper.layout.watermarkText}
          </div>
        </div>
      )}

      {/* Main Canvas Container with Border */}
      <div className={`relative z-10 space-y-4 ${getBorderStyleClass()}`}>
        {/* ======================================================== */}
        {/* 1. HEADER SECTION (5 Customizable Layout Styles)         */}
        {/* ======================================================== */}

        {/* Style A: Madrasah Ornate Header */}
        {headerStyle === 'madrasah-ornate' && (
          <header className="text-center border-b-2 border-double border-gray-900 pb-3 mb-4 space-y-1">
            <div className="font-amiri text-lg font-bold tracking-wide text-gray-900">
              {paper.header.bismillahArabicText || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'}
            </div>
            {paper.header.instituteName && (
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                {paper.header.instituteName}
              </h1>
            )}
            {paper.header.subInstituteText && (
              <p className="text-xs text-gray-700 font-medium">{paper.header.subInstituteText}</p>
            )}
            <div className="text-sm font-bold text-gray-900 pt-0.5">
              {paper.header.examName} — {paper.header.sessionYear}
            </div>
            <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-gray-400 mt-2 px-1">
              <span>{labels.subject}: {paper.header.subjectName} {paper.header.subjectCode ? `(${paper.header.subjectCode})` : ''}</span>
              <span>{labels.class}: {paper.header.gradeClass}</span>
              <span>{labels.fullMarks}: {paper.header.totalMarks}</span>
              <span>{labels.time}: {paper.header.timeAllowed}</span>
            </div>
          </header>
        )}

        {/* Style B: Cambridge / Edexcel Grid Header */}
        {headerStyle === 'cambridge-grid' && (
          <header className="border-2 border-gray-900 p-3 mb-4 space-y-2 text-xs">
            <div className="flex items-start justify-between border-b border-gray-400 pb-2">
              <div>
                <h1 className="text-base font-bold text-gray-900 uppercase tracking-wide">
                  {paper.header.instituteName || 'EXAMINATION BOARD'}
                </h1>
                <p className="text-[11px] text-gray-700">{paper.header.subInstituteText || 'International Secondary Assessment'}</p>
              </div>
              <div className="text-right font-mono font-bold">
                <div>{paper.header.subjectCode || 'CODE 01'}</div>
                <div className="text-primary text-[11px]">{paper.header.examSet || 'Paper 1'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="font-bold">{labels.subject}:</span> {paper.header.subjectName}
              </div>
              <div className="text-right">
                <span className="font-bold">{labels.time}:</span> {paper.header.timeAllowed}
              </div>
              <div>
                <span className="font-bold">{labels.class}:</span> {paper.header.gradeClass}
              </div>
              <div className="text-right font-mono font-bold">
                <span className="font-bold">{labels.fullMarks}:</span> {paper.header.totalMarks}
              </div>
            </div>
          </header>
        )}

        {/* Style C: Modern Dual Header (Left: School Info, Right: Exam Meta) */}
        {headerStyle === 'modern-dual' && (
          <header className="border-b-2 border-gray-900 pb-3 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                {paper.header.instituteName && (
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">
                    {paper.header.instituteName}
                  </h1>
                )}
                {paper.header.subInstituteText && (
                  <p className="text-xs text-gray-600">{paper.header.subInstituteText}</p>
                )}
                <div className="text-xs font-semibold text-gray-800 pt-1">
                  {paper.header.examName} {paper.header.sessionYear ? `(${paper.header.sessionYear})` : ''}
                </div>
              </div>

              <div className="text-right text-xs space-y-0.5 bg-gray-50 border border-gray-300 p-2 rounded">
                <div className="font-bold text-gray-900">{paper.header.subjectName}</div>
                <div className="text-gray-600">{labels.class}: {paper.header.gradeClass}</div>
                <div className="font-bold pt-0.5 text-gray-900">
                  {labels.time}: {paper.header.timeAllowed} • {labels.fullMarks}: {paper.header.totalMarks}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Style D: Minimal Left Header */}
        {headerStyle === 'minimal-left' && (
          <header className="border-b border-gray-900 pb-2 mb-4 space-y-1 text-xs">
            {paper.header.instituteName && (
              <h1 className="text-base font-bold text-gray-900">{paper.header.instituteName}</h1>
            )}
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>{paper.header.departmentName || paper.header.subInstituteText || ''}</span>
              <span>{paper.header.sessionYear}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-300 font-bold">
              <span>{paper.header.subjectName} {paper.header.subjectCode ? `(${paper.header.subjectCode})` : ''}</span>
              <span>{labels.time}: {paper.header.timeAllowed} | {labels.fullMarks}: {paper.header.totalMarks}</span>
            </div>
          </header>
        )}

        {/* Style E: Classic Board Center Header (Default) */}
        {headerStyle === 'classic-center' && (
          <header className="text-center border-b border-gray-400 pb-3 mb-4 space-y-1">
            {paper.header.bismillahHeader && (
              <div className="font-amiri text-base font-bold text-gray-800 mb-1">
                {paper.header.bismillahArabicText || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'}
              </div>
            )}
            {paper.header.instituteName && (
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                {paper.header.instituteName}
              </h1>
            )}
            {paper.header.subInstituteText && (
              <p className="text-xs text-gray-700 font-medium">{paper.header.subInstituteText}</p>
            )}
            <div className="text-sm font-bold text-gray-900 pt-0.5">
              {paper.header.examName} {paper.header.sessionYear ? `— ${paper.header.sessionYear}` : ''}
            </div>

            <div className="text-xs font-bold text-gray-900 flex items-center justify-center gap-4 pt-1 flex-wrap">
              <span>{labels.subject}: {paper.header.subjectName}</span>
              {paper.header.subjectCode && <span>[{labels.subjectCode}: {paper.header.subjectCode}]</span>}
              {paper.header.gradeClass && <span>{labels.class}: {paper.header.gradeClass}</span>}
              {paper.header.examSet && (
                <span className="px-1.5 py-0.5 border border-gray-900 font-mono text-[11px]">
                  {labels.set}: {paper.header.examSet}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-gray-300 mt-2 px-1">
              <span>{labels.time}: {paper.header.timeAllowed}</span>
              <span>{labels.fullMarks}: {paper.header.totalMarks}</span>
            </div>
          </header>
        )}

        {/* Special General Instructions */}
        {paper.header.specialInstructions && (
          <div className="text-xs italic text-gray-800 bg-gray-50 border-l-2 border-gray-900 p-2 leading-relaxed">
            {paper.header.specialInstructions}
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. STUDENT INFORMATION BOX / TEAR-OFF SLIP               */}
        {/* ======================================================== */}
        {paper.layout.studentInfoBox && (
          <div className="border border-gray-800 p-2.5 my-3 rounded text-xs bg-gray-50/50 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2">
                <span className="font-bold text-gray-900">{labels.studentName}: </span>
                <span className="border-b border-dotted border-gray-800 inline-block w-48" />
              </div>
              <div>
                <span className="font-bold text-gray-900">{labels.rollNo}: </span>
                <span className="border-b border-dotted border-gray-800 inline-block w-16" />
              </div>
              <div>
                <span className="font-bold text-gray-900">{labels.section}: </span>
                <span className="border-b border-dotted border-gray-800 inline-block w-14" />
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. PERFORATED CUT LINE                                   */}
        {/* ======================================================== */}
        {paper.layout.showHeaderCutLine && (
          <div className="relative my-4 flex items-center justify-center">
            <div className="w-full border-t-2 border-dashed border-gray-600" />
            <span className="absolute bg-white px-2 text-xs text-gray-600 flex items-center gap-1 font-mono">
              <Scissors className="w-3.5 h-3.5" />
              <span>{labels.cutLine}</span>
            </span>
          </div>
        )}

        {/* ======================================================== */}
        {/* 4. SECTIONS AND QUESTIONS CANVAS                         */}
        {/* ======================================================== */}
        {paper.sections.map((section, sIdx) => (
          <section key={section.sectionId} className="pt-2 space-y-2">
            {/* Section Header */}
            <div className="border-b border-gray-400 pb-1 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-gray-900">{section.title}</h2>
                {section.subTitle && (
                  <p className="text-xs text-gray-700 italic">{section.subTitle}</p>
                )}
              </div>
              {section.marksInstruction && (
                <div className="text-xs font-bold font-mono text-gray-900">
                  {section.marksInstruction}
                </div>
              )}
            </div>

            {/* Questions Container (Single or Two-Column) */}
            {isMounted ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(e, section.sectionId)}
              >
                <SortableContext
                  items={section.questions.map((q) => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    className={
                      isTwoColumn
                        ? 'grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3'
                        : 'space-y-2'
                    }
                  >
                    {section.questions.map((question) => (
                      <div key={question.id} className="space-y-1">
                        <QuestionCard
                          question={question}
                          layout={paper.layout}
                          onEdit={(q) => onEditQuestion(q, section.sectionId)}
                          onDelete={(qid) => handleDeleteQuestion(section.sectionId, qid)}
                          onDuplicate={(q) => handleDuplicateQuestion(section.sectionId, q)}
                        />

                        {/* Optional Dotted Lines for worksheets */}
                        {paper.layout.showDottedAnswerLines && question.dottedLinesCount && (
                          <div className="space-y-2.5 pt-1 pl-6">
                            {Array.from({ length: question.dottedLinesCount }).map((_, dIdx) => (
                              <div
                                key={dIdx}
                                className="w-full border-b border-dotted border-gray-400 h-3"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className={isTwoColumn ? 'grid grid-cols-2 gap-4' : 'space-y-2'}>
                {section.questions.map((question) => (
                  <div key={question.id} className="space-y-1">
                    <QuestionCard
                      question={question}
                      layout={paper.layout}
                      onEdit={(q) => onEditQuestion(q, section.sectionId)}
                      onDelete={(qid) => handleDeleteQuestion(section.sectionId, qid)}
                      onDuplicate={(q) => handleDuplicateQuestion(section.sectionId, q)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Section Actions (Add Manual & Import from Bank) */}
            <div className="no-print pt-2 flex items-center justify-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onAddQuestion(section.sectionId)}
                className="bg-white text-gray-700 hover:bg-gray-100 border-gray-300 dark:bg-white dark:text-gray-700 dark:hover:bg-gray-100 dark:border-gray-300"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{labels.addManualQ}</span>
              </Button>

              {onOpenQuestionBank && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onOpenQuestionBank(section.sectionId)}
                  className="bg-white text-gray-700 hover:bg-gray-100 border-gray-300 dark:bg-white dark:text-gray-700 dark:hover:bg-gray-100 dark:border-gray-300"
                >
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{labels.importBank}</span>
                </Button>
              )}
            </div>
          </section>
        ))}

        {/* OMR Answer Sheet — printed when showOMRGrid enabled */}
        {paper.layout.showOMRGrid && (
          <section className="mt-8 pt-4 border-t-2 border-dashed border-gray-400">
            <h3 className="text-center text-sm font-bold tracking-wide">OMR Answer Sheet — Fill circle with black ballpoint</h3>
            <p className="text-center text-[10px] text-gray-600">Cut here and submit — {paper.header.examSet || 'Set-A'} • {paper.header.subjectName}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4">
              {paper.sections.flatMap((s) => s.questions).filter((q) => q.type === 'mcq' || q.type === 'mcq-polynomial').map((q) => (
                <div key={q.id} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded px-1.5 py-1">
                  <span className="font-mono font-bold w-6 text-center">{q.qNumber}</span>
                  <div className="flex gap-1">
                    {['A', 'B', 'C', 'D'].map((lbl) => (
                      <span key={lbl} className="w-5 h-5 rounded-full border border-gray-800 flex items-center justify-center text-[10px] font-mono"> {lbl} </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {paper.sections.flatMap((s) => s.questions).filter((q) => q.type === 'mcq').length === 0 && (
              <p className="text-center text-xs text-gray-500 pt-2">No MCQ in this paper — OMR grid will auto-populate when MCQs are added.</p>
            )}
          </section>
        )}

        {/* Global Add Section Button */}
        <div className="no-print pt-4 border-t border-dashed border-gray-300 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleAddSection}
            className="bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-black border-gray-300 dark:bg-gray-50 dark:text-gray-700 dark:hover:bg-gray-100 dark:border-gray-300"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{labels.addSection}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
