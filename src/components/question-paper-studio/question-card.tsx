'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { QuestionItem, LayoutSettings } from '@/types/exam-studio';
import { formatNumeral, getCQPartLabels, getOptionLabel } from '@/lib/question-paper-studio/bengali-numerals';
import { GripVertical, Edit3, Trash2, Copy, Image as ImageIcon } from 'lucide-react';
import { renderRichText } from '@/components/ui/rich-text-field';

interface QuestionCardProps {
  question: QuestionItem;
  layout: LayoutSettings;
  onEdit: (question: QuestionItem) => void;
  onDelete: (id: string) => void;
  onDuplicate: (question: QuestionItem) => void;
}

export function QuestionCard({ question, layout, onEdit, onDelete, onDuplicate }: QuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const isRTL = question.isRTL || layout.isRTL;
  const isEnglish = layout.numeralSystem === 'english';
  const isArabic = layout.numeralSystem === 'arabic' || isRTL;
  const cqLabels = getCQPartLabels(layout.numeralSystem);

  const colALabel = isEnglish ? 'Column A' : isArabic ? 'العمود أ' : 'ক-কলাম';
  const colBLabel = isEnglish ? 'Column B' : isArabic ? 'العمود ب' : 'খ-কলাম';
  const orText = isEnglish ? '— OR —' : isArabic ? '— أو —' : '— অথবা —';

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`question-card-${question.id}`}
      className={`group relative rounded-md border transition-all duration-150 ${
        isDragging
          ? 'border-primary bg-muted shadow-sm'
          : 'border-transparent hover:border-border hover:bg-muted/40'
      } p-2.5 my-1.5 ${isRTL ? 'rtl text-right' : 'ltr text-left'}`}
    >
      {/* Action Toolbar on Hover */}
      <div
        className={`no-print absolute top-1 ${
          isRTL ? 'left-2' : 'right-2'
        } opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1 bg-card border border-border px-1.5 py-0.5 rounded-md shadow-xs z-10`}
      >
        <button
          type="button"
          onClick={() => onEdit(question)}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded text-xs flex items-center gap-1"
          title="Edit Question"
        >
          <Edit3 className="w-3.5 h-3.5" strokeWidth={1.25} />
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(question)}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded text-xs"
          title="Duplicate Question"
        >
          <Copy className="w-3.5 h-3.5" strokeWidth={1.25} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(question.id)}
          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded text-xs"
          title="Delete Question"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.25} />
        </button>
        <div
          {...attributes}
          {...listeners}
          className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing rounded"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" strokeWidth={1.25} />
        </div>
      </div>

      {/* Main Question Flow */}
      <div className="flex items-start gap-2">
        {/* Question Number */}
        <span className="font-semibold select-none shrink-0 min-w-[20px] text-foreground">
          {formatNumeral(question.qNumber, layout.numeralSystem)}.
        </span>

        <div className="flex-1 space-y-2">
          {/* Stimulus Context (উদ্দীপক / Passage) — rich text */}
          {question.stimulus && (
            <div className="p-2.5 bg-muted/40 border-l-2 border-primary/70 rounded-r text-[13px] leading-relaxed text-foreground italic font-normal">
              {renderRichText(question.stimulus) ? <span dangerouslySetInnerHTML={renderRichText(question.stimulus)!} /> : question.stimulus}
            </div>
          )}

          {/* Optional Stimulus Image / Diagram */}
          {question.stimulusImage?.url && (
            <div
              className={`my-2 flex ${
                question.stimulusImage.position === 'center'
                  ? 'justify-center'
                  : question.stimulusImage.position === 'right'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <div
                style={{ width: `${question.stimulusImage.widthPercent || 50}%` }}
                className="text-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={question.stimulusImage.url}
                  alt={question.stimulusImage.caption || 'Question Diagram'}
                  className="max-h-48 mx-auto object-contain border border-border rounded"
                />
                {question.stimulusImage.caption && (
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    {question.stimulusImage.caption}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Main Stem Instruction — rich text */}
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-medium text-[13.5px] leading-snug text-foreground">
              {renderRichText(question.questionText) ? <span dangerouslySetInnerHTML={renderRichText(question.questionText)!} /> : question.questionText}
            </span>
            {/* Total Marks Pill (Right Aligned per Bangladesh Board Standard) */}
            {question.marks !== undefined && question.type !== 'cq' && (
              <span className="text-xs font-semibold text-muted-foreground shrink-0 select-none">
                [{formatNumeral(question.marks, layout.numeralSystem)}]
              </span>
            )}
          </div>

          {/* Srijonshil (CQ) Sub-Questions (ক, খ, গ, ঘ) */}
          {question.type === 'cq' && question.cqParts && (
            <div className="pl-2 sm:pl-4 space-y-1.5 pt-1 text-[13px]">
              {/* Part Ka (জ্ঞান) — rich */}
              {question.cqParts.ka?.text && (
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-foreground">({cqLabels.ka})</span>
                    <span className="text-foreground">{renderRichText(question.cqParts.ka.text) ? <span dangerouslySetInnerHTML={renderRichText(question.cqParts.ka.text)!} /> : question.cqParts.ka.text}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold shrink-0">{formatNumeral(question.cqParts.ka.marks || 1, layout.numeralSystem)}</span>
                </div>
              )}

              {/* Part Kha (অনুধাবন) — rich */}
              {question.cqParts.kha?.text && (
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-foreground">({cqLabels.kha})</span>
                    <span className="text-foreground">{renderRichText(question.cqParts.kha.text) ? <span dangerouslySetInnerHTML={renderRichText(question.cqParts.kha.text)!} /> : question.cqParts.kha.text}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold shrink-0">{formatNumeral(question.cqParts.kha.marks || 2, layout.numeralSystem)}</span>
                </div>
              )}

              {/* Part Ga (প্রয়োগ) — rich */}
              {question.cqParts.ga?.text && (
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-foreground">({cqLabels.ga})</span>
                    <span className="text-foreground">{renderRichText(question.cqParts.ga.text) ? <span dangerouslySetInnerHTML={renderRichText(question.cqParts.ga.text)!} /> : question.cqParts.ga.text}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold shrink-0">{formatNumeral(question.cqParts.ga.marks || 3, layout.numeralSystem)}</span>
                </div>
              )}

              {/* Part Gha (উচ্চতর দক্ষতা) — rich */}
              {question.cqParts.gha?.text && (
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-foreground">({cqLabels.gha})</span>
                    <span className="text-foreground">{renderRichText(question.cqParts.gha.text) ? <span dangerouslySetInnerHTML={renderRichText(question.cqParts.gha.text)!} /> : question.cqParts.gha.text}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold shrink-0">{formatNumeral(question.cqParts.gha.marks || 4, layout.numeralSystem)}</span>
                </div>
              )}
            </div>
          )}

          {/* Polynomial MCQ Multi-Statements (i, ii, iii) */}
          {question.type === 'mcq-polynomial' && question.polynomialStatements && (
            <div className="pl-4 space-y-0.5 text-xs text-foreground">
              {question.polynomialStatements.map((stmt, idx) => (
                <div key={idx} className="flex items-baseline gap-1.5">
                  <span className="font-serif font-medium">
                    {['i.', 'ii.', 'iii.'][idx] || `${idx + 1}.`}
                  </span>
                  <span>{stmt}</span>
                </div>
              ))}
              {question.polynomialQuestionText && (
                <div className="font-medium pt-1 text-[13px]">
                  {question.polynomialQuestionText}
                </div>
              )}
            </div>
          )}

          {/* Standard Multiple Choice Options (4 options) */}
          {(question.type === 'mcq' || question.type === 'mcq-polynomial') &&
            question.mcqOptions &&
            question.mcqOptions.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[12.5px]">
                {question.mcqOptions.map((opt, optIdx) => (
                  <div
                    key={optIdx}
                    className={`flex items-baseline gap-1.5 ${
                      layout.showTeacherNotes && question.mcqCorrectIndex === optIdx
                        ? 'font-bold text-emerald-600 dark:text-emerald-400'
                        : 'text-foreground'
                    }`}
                  >
                    <span className="font-semibold select-none">
                      {getOptionLabel(optIdx, layout.numeralSystem)}
                    </span>
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            )}

          {/* Column Matching Layout (বাম-ডান মিলকরণ) */}
          {question.type === 'matching' && question.matchingColumns && (
            <div className="grid grid-cols-2 gap-4 my-2 p-2 border border-border rounded text-xs">
              <div className="space-y-1">
                <div className="font-semibold text-muted-foreground border-b border-border pb-1">
                  {colALabel}
                </div>
                {question.matchingColumns.left.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span className="font-bold text-muted-foreground">
                      ({cqLabels.ka ? Object.values(cqLabels)[idx] || idx + 1 : idx + 1})
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-muted-foreground border-b border-border pb-1">
                  {colBLabel}
                </div>
                {question.matchingColumns.right.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span className="font-bold text-muted-foreground">
                      ({formatNumeral(idx + 1, layout.numeralSystem)})
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fill In Blanks Clue Box */}
          {question.type === 'fill-blanks' &&
            question.fillBlanksOptions &&
            question.fillBlanksOptions.length > 0 && (
              <div className="my-2 p-2 bg-muted/40 border border-border border-dashed rounded text-xs flex flex-wrap gap-2 justify-center">
                {question.fillBlanksOptions.map((clue, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-card border border-border rounded text-foreground font-medium"
                  >
                    {clue}
                  </span>
                ))}
              </div>
            )}

          {/* Optional 'OR' Alternative Question (অথবা) — rich */}
          {question.orAlternative && (
            <div className="mt-3 pt-2 border-t border-dashed border-border space-y-2">
              <div className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">{orText}</div>
              <div className="text-[13px] font-medium text-foreground">
                {renderRichText(question.orAlternative.questionText) ? <span dangerouslySetInnerHTML={renderRichText(question.orAlternative.questionText)!} /> : question.orAlternative.questionText}
              </div>
            </div>
          )}

          {/* Teacher Solution & Marking Notes (Hidden from Student Print) — rich */}
          {layout.showTeacherNotes && question.notesForExaminer && (
            <div className="no-print mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 border-l-2 border-amber-500 text-[11px] text-amber-800 dark:text-amber-200">
              <span className="font-bold">Marking Scheme / Notes: </span>
              {renderRichText(question.notesForExaminer) ? <span dangerouslySetInnerHTML={renderRichText(question.notesForExaminer)!} /> : question.notesForExaminer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
