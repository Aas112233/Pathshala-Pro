'use client';

import React, { useState } from 'react';
import { QuestionItem, QuestionType, SubQuestion } from '@/types/exam-studio';
import { MathSymbolToolbar } from '@/components/question-paper-studio/math-symbol-toolbar';
import { RichTextField } from '@/components/ui/rich-text-field';
import {
  X,
  Plus,
  Trash2,
  Check,
  AlignLeft,
  Columns,
  ListOrdered,
  HelpCircle,
  BookOpen,
  Sigma,
  FileSpreadsheet,
} from 'lucide-react';

interface QuestionEditorModalProps {
  isOpen: boolean;
  question: QuestionItem | null;
  sectionId: string;
  onClose: () => void;
  onSave: (updatedQuestion: QuestionItem, sectionId: string) => void;
}

export function QuestionEditorModal({
  isOpen,
  question,
  sectionId,
  onClose,
  onSave,
}: QuestionEditorModalProps) {
  if (!isOpen) return null;

  return (
    <QuestionEditorDialog
      key={question?.id || 'new-question'}
      question={question}
      sectionId={sectionId}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function QuestionEditorDialog({
  question,
  sectionId,
  onClose,
  onSave,
}: {
  question: QuestionItem | null;
  sectionId: string;
  onClose: () => void;
  onSave: (updatedQuestion: QuestionItem, sectionId: string) => void;
}) {
  const [activeField, setActiveField] = useState<string>('questionText');

  const [formData, setFormData] = useState<QuestionItem>(() => {
    if (question) {
      return JSON.parse(JSON.stringify(question));
    }
    return {
      id: `q-custom-${Date.now()}`,
      type: 'cq',
      qNumber: '১',
      questionText: 'উদ্দীপকটি পড়ে নিচের প্রশ্নগুলোর উত্তর দাও:',
      marks: 10,
      stimulus: '',
      cqParts: {
        ka: { text: '', marks: 1 },
        kha: { text: '', marks: 2 },
        ga: { text: '', marks: 3 },
        gha: { text: '', marks: 4 },
      },
    };
  });

  const handleInsertSymbol = (sym: string) => {
    if (activeField === 'stimulus') {
      setFormData((prev) => ({ ...prev, stimulus: (prev.stimulus || '') + sym }));
    } else if (activeField === 'questionText') {
      setFormData((prev) => ({ ...prev, questionText: (prev.questionText || '') + sym }));
    } else if (activeField === 'notes') {
      setFormData((prev) => ({ ...prev, notesForExaminer: (prev.notesForExaminer || '') + sym }));
    } else if (['ka', 'kha', 'ga', 'gha'].includes(activeField)) {
      setFormData((prev) => {
        if (!prev.cqParts) return prev;
        const partKey = activeField as 'ka' | 'kha' | 'ga' | 'gha';
        const currentPart = prev.cqParts[partKey];
        return {
          ...prev,
          cqParts: {
            ...prev.cqParts,
            [partKey]: {
              ...currentPart,
              text: (currentPart?.text || '') + sym,
            },
          },
        };
      });
    }
  };

  const handleTypeChange = (newType: QuestionType) => {
    const updated = { ...formData, type: newType };

    if (newType === 'cq') {
      updated.cqParts = updated.cqParts || {
        ka: { text: '', marks: 1 },
        kha: { text: '', marks: 2 },
        ga: { text: '', marks: 3 },
        gha: { text: '', marks: 4 },
      };
      updated.marks = 10;
      if (!updated.questionText) {
        updated.questionText = 'উদ্দীপকটি পড়ে নিচের প্রশ্নগুলোর উত্তর দাও:';
      }
    } else if (newType === 'mcq') {
      updated.mcqOptions = updated.mcqOptions?.length ? updated.mcqOptions : ['', '', '', ''];
      updated.mcqCorrectIndex = updated.mcqCorrectIndex ?? 0;
      updated.marks = 1;
    } else if (newType === 'mcq-polynomial') {
      updated.polynomialStatements = updated.polynomialStatements?.length
        ? updated.polynomialStatements
        : ['', '', ''];
      updated.polynomialQuestionText = updated.polynomialQuestionText || 'নিচের কোনটি সঠিক?';
      updated.mcqOptions = updated.mcqOptions?.length
        ? updated.mcqOptions
        : ['i ও ii', 'i ও iii', 'ii ও iii', 'i, ii ও iii'];
      updated.mcqCorrectIndex = updated.mcqCorrectIndex ?? 0;
      updated.marks = 1;
    } else if (newType === 'matching') {
      updated.matchingColumns = updated.matchingColumns || {
        left: ['', '', '', ''],
        right: ['', '', '', ''],
      };
      updated.marks = 4;
    } else if (newType === 'fill-blanks') {
      updated.fillBlanksOptions = updated.fillBlanksOptions || ['', '', '', ''];
      updated.marks = 5;
    } else if (newType === 'arabic-hadith') {
      updated.isRTL = true;
      updated.marks = updated.marks || 10;
    } else if (newType === 'worksheet-trace') {
      updated.dottedLinesCount = updated.dottedLinesCount || 3;
      updated.marks = updated.marks || 5;
    } else if (newType === 'short' || newType === 'descriptive') {
      updated.marks = updated.marks || 5;
    }

    setFormData(updated);
  };

  const handleSave = () => {
    onSave(formData, sectionId);
    onClose();
  };

  // Sub-questions handler for Structured/Descriptive
  const handleAddSubQuestion = () => {
    const subQs = formData.subQuestions || [];
    const labels = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'];
    const nextLabel = labels[subQs.length] || `(${subQs.length + 1})`;
    const newSubQ: SubQuestion = {
      id: `sub-${Date.now()}`,
      label: nextLabel,
      text: '',
      marks: 2,
    };
    setFormData({
      ...formData,
      subQuestions: [...subQs, newSubQ],
    });
  };

  const handleUpdateSubQuestion = (idx: number, partial: Partial<SubQuestion>) => {
    const subQs = [...(formData.subQuestions || [])];
    if (subQs[idx]) {
      subQs[idx] = { ...subQs[idx], ...partial };
      setFormData({ ...formData, subQuestions: subQs });
    }
  };

  const handleDeleteSubQuestion = (idx: number) => {
    const subQs = (formData.subQuestions || []).filter((_, i) => i !== idx);
    setFormData({ ...formData, subQuestions: subQs });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground border border-border w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/40">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {question ? 'প্রশ্ন সম্পাদনা করুন (Edit Question)' : 'নতুন প্রশ্ন তৈরি করুন (Create Question)'}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              ফর্মটি স্বয়ংক্রিয়ভাবে প্রশ্নের ধরন অনুসারে সজ্জিত হয়েছে
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 1. Question Type Switcher */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              প্রশ্নের ধরন (Question Style)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'cq', label: 'সৃজনশীল (CQ 10 Marks)' },
                { type: 'mcq', label: 'বহুনির্বাচনী (MCQ)' },
                { type: 'mcq-polynomial', label: 'বহুপদী MCQ' },
                { type: 'short', label: 'সংক্ষিপ্ত / স্ট্রাকচার্ড' },
                { type: 'matching', label: 'বাম-ডান মিলকরণ' },
                { type: 'fill-blanks', label: 'শূন্যস্থান পূরণ' },
                { type: 'arabic-hadith', label: 'মাদরাসা / আরবি (RTL)' },
                { type: 'worksheet-trace', label: 'ওয়ার্কশিট / ট্রেসিং' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleTypeChange(item.type as QuestionType)}
                  className={`px-2.5 py-1.5 rounded border text-left text-xs font-medium transition-all ${
                    formData.type === item.type
                      ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'border-border bg-card text-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Math and Science Symbols Palette */}
          <MathSymbolToolbar onInsertSymbol={handleInsertSymbol} />

          {/* 3. Number, Marks & Cognitive Level */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                ক্রমিক নম্বর (Q. Number)
              </label>
              <input
                type="text"
                value={formData.qNumber}
                onChange={(e) => setFormData({ ...formData, qNumber: e.target.value })}
                className="w-full px-3 py-1.5 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder="১, 2, Q-1"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                পূর্ণমান (Total Marks)
              </label>
              <input
                type="number"
                value={formData.marks || ''}
                onChange={(e) =>
                  setFormData({ ...formData, marks: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-1.5 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                placeholder="10"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                দক্ষতা স্তর (Cognitive Level)
              </label>
              <select
                value={formData.cognitiveLevel || 'জ্ঞান'}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cognitiveLevel: e.target.value as any,
                  })
                }
                className="w-full px-3 py-1.5 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="জ্ঞান">জ্ঞানমূলক (Knowledge)</option>
                <option value="অনুধাবন">অনুধাবনমূলক (Comprehension)</option>
                <option value="প্রয়োগ">প্রয়োগমূলক (Application)</option>
                <option value="উচ্চতর দক্ষতা">উচ্চতর দক্ষতা (Higher Order)</option>
                <option value="সমন্বিত">সমন্বিত (Integrated CQ)</option>
              </select>
            </div>
          </div>

          {/* ======================================================== */}
          {/* DYNAMIC FORM LAYOUT SECTION BY QUESTION TYPE             */}
          {/* ======================================================== */}

          {/* A. Creative Question (CQ) Layout */}
          {formData.type === 'cq' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  উদ্দীপক / অনুচ্ছেদ (Context / Stimulus Passage) *
                </label>
                <RichTextField
                  value={formData.stimulus || ''}
                  onChange={(v) => setFormData({ ...formData, stimulus: v })}
                  onFocus={() => setActiveField('stimulus')}
                  placeholder="উদ্দীপকের মূল পাঠ্য লিখুন..."
                  minHeight="80px"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  মূল নির্দেশক টেক্সট (Question Intro)
                </label>
                <input
                  type="text"
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  onFocus={() => setActiveField('questionText')}
                  className="w-full px-3 py-1.5 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="উদ্দীপকটি পড়ে নিচের প্রশ্নগুলোর উত্তর দাও:"
                />
              </div>

              {/* CQ 4 Parts: ক, খ, গ, ঘ */}
              <div className="space-y-2.5 bg-muted/20 p-3.5 rounded-lg border border-border">
                <div className="text-[11px] font-bold text-foreground">
                  সৃজনশীল ৪টি অংশ (ক, খ, গ, ঘ)
                </div>

                {[
                  { key: 'ka', label: 'ক (জ্ঞানমূলক)', marks: 1 },
                  { key: 'kha', label: 'খ (অনুধাবনমূলক)', marks: 2 },
                  { key: 'ga', label: 'গ (প্রয়োগমূলক)', marks: 3 },
                  { key: 'gha', label: 'ঘ (উচ্চতর দক্ষতা)', marks: 4 },
                ].map((part) => {
                  const partKey = part.key as 'ka' | 'kha' | 'ga' | 'gha';
                  const partVal = formData.cqParts?.[partKey];
                  return (
                    <div key={part.key} className="flex items-center gap-2">
                      <span className="font-bold text-xs w-28 shrink-0 text-foreground">
                        {part.label}:
                      </span>
                      <input
                        type="text"
                        value={partVal?.text || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            cqParts: {
                              ...prev.cqParts!,
                              [partKey]: {
                                text: val,
                                marks: partVal?.marks || part.marks,
                              },
                            },
                          }));
                        }}
                        onFocus={() => setActiveField(partKey)}
                        placeholder={`প্রশ্নের পাঠ্য লিখুন...`}
                        className="flex-1 px-3 py-1 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                      <span className="text-[11px] font-mono font-bold text-muted-foreground w-12 text-right">
                        [{partVal?.marks || part.marks}]
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* B. Multiple Choice Question (MCQ) Layout */}
          {formData.type === 'mcq' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  প্রশ্নটির বিবরণ (MCQ Question Text) *
                </label>
                <RichTextField
                  value={formData.questionText}
                  onChange={(v) => setFormData({ ...formData, questionText: v })}
                  onFocus={() => setActiveField('questionText')}
                  placeholder="বহুনির্বাচনী প্রশ্নটি লিখুন..."
                  minHeight="60px"
                />
              </div>

              {/* 4 Options Grid */}
              <div className="space-y-2 bg-muted/20 p-3.5 rounded-lg border border-border">
                <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                  <span>৪টি বিকল্প অপশন (Options)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    সঠিক উত্তরের পাশের বৃত্তে ক্লিক করুন
                  </span>
                </div>

                {['ক (A)', 'খ (B)', 'গ (C)', 'ঘ (D)'].map((optLabel, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, mcqCorrectIndex: optIdx })}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-colors ${
                        formData.mcqCorrectIndex === optIdx
                          ? 'border-emerald-600 bg-emerald-600 text-white font-bold'
                          : 'border-input hover:border-border text-muted-foreground'
                      }`}
                      title="সঠিক উত্তর হিসেবে চিহ্নিত করুন"
                    >
                      {formData.mcqCorrectIndex === optIdx ? <Check className="w-3.5 h-3.5" /> : optIdx + 1}
                    </button>
                    <span className="w-12 text-[11px] font-semibold text-muted-foreground">
                      {optLabel}:
                    </span>
                    <input
                      type="text"
                      value={formData.mcqOptions?.[optIdx] || ''}
                      onChange={(e) => {
                        const newOpts = [...(formData.mcqOptions || ['', '', '', ''])];
                        newOpts[optIdx] = e.target.value;
                        setFormData({ ...formData, mcqOptions: newOpts });
                      }}
                      placeholder={`অপশন ${optIdx + 1} লিখুন...`}
                      className="flex-1 px-3 py-1 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* C. Polynomial MCQ Layout */}
          {formData.type === 'mcq-polynomial' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  উদ্দীপক বা মূল বাক্য (Stimulus / Stem)
                </label>
                <input
                  type="text"
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  placeholder="যেমন: কোনো গতিশীল বস্তুর ক্ষেত্রে—"
                  className="w-full px-3 py-1.5 bg-background border border-input rounded text-xs"
                />
              </div>

              {/* 3 Statements */}
              <div className="space-y-2 bg-muted/20 p-3 rounded-lg border border-border">
                <div className="text-[11px] font-bold text-foreground">
                  ৩টি তথ্য বা বিবৃতি (Statements i, ii, iii)
                </div>
                {['i.', 'ii.', 'iii.'].map((stLabel, stIdx) => (
                  <div key={stIdx} className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs w-6 text-primary">{stLabel}</span>
                    <input
                      type="text"
                      value={formData.polynomialStatements?.[stIdx] || ''}
                      onChange={(e) => {
                        const stmts = [...(formData.polynomialStatements || ['', '', ''])];
                        stmts[stIdx] = e.target.value;
                        setFormData({ ...formData, polynomialStatements: stmts });
                      }}
                      placeholder={`বিবৃতি ${stIdx + 1} লিখুন...`}
                      className="flex-1 px-3 py-1 bg-background border border-input rounded text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  বিকল্প সমন্বয় তালিকা (Combinations)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['ক', 'খ', 'গ', 'ঘ'].map((optLabel, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, mcqCorrectIndex: optIdx })}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                          formData.mcqCorrectIndex === optIdx
                            ? 'border-emerald-600 bg-emerald-600 text-white font-bold'
                            : 'border-input text-muted-foreground'
                        }`}
                      >
                        {formData.mcqCorrectIndex === optIdx ? <Check className="w-3.5 h-3.5" /> : optLabel}
                      </button>
                      <input
                        type="text"
                        value={formData.mcqOptions?.[optIdx] || ''}
                        onChange={(e) => {
                          const newOpts = [...(formData.mcqOptions || ['', '', '', ''])];
                          newOpts[optIdx] = e.target.value;
                          setFormData({ ...formData, mcqOptions: newOpts });
                        }}
                        className="flex-1 px-2.5 py-1 bg-background border border-input rounded text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* D. Matching Columns Layout (বাম-ডান মিলকরণ) */}
          {formData.type === 'matching' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  নির্দেশক টেক্সট (Instruction)
                </label>
                <input
                  type="text"
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  placeholder="বাম পাশের বাক্যাংশের সাথে ডান পাশের বাক্যাংশ মিল কর:"
                  className="w-full px-3 py-1.5 bg-background border border-input rounded text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg border border-border">
                {/* Left Column */}
                <div className="space-y-2">
                  <div className="font-bold text-xs text-foreground">কলাম ‘ক’ (Left Column)</div>
                  {(formData.matchingColumns?.left || ['', '', '', '']).map((leftVal, lIdx) => (
                    <div key={lIdx} className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground w-4">{lIdx + 1}.</span>
                      <input
                        type="text"
                        value={leftVal}
                        onChange={(e) => {
                          const lefts = [...(formData.matchingColumns?.left || [])];
                          lefts[lIdx] = e.target.value;
                          setFormData({
                            ...formData,
                            matchingColumns: {
                              left: lefts,
                              right: formData.matchingColumns?.right || [],
                            },
                          });
                        }}
                        placeholder={`তথ্য ${lIdx + 1}`}
                        className="flex-1 px-2.5 py-1 bg-background border border-input rounded text-xs"
                      />
                    </div>
                  ))}
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                  <div className="font-bold text-xs text-foreground">কলাম ‘খ’ (Right Column)</div>
                  {(formData.matchingColumns?.right || ['', '', '', '']).map((rightVal, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground w-4">
                        {String.fromCharCode(65 + rIdx)}.
                      </span>
                      <input
                        type="text"
                        value={rightVal}
                        onChange={(e) => {
                          const rights = [...(formData.matchingColumns?.right || [])];
                          rights[rIdx] = e.target.value;
                          setFormData({
                            ...formData,
                            matchingColumns: {
                              left: formData.matchingColumns?.left || [],
                              right: rights,
                            },
                          });
                        }}
                        placeholder={`মিলকরণ ${rIdx + 1}`}
                        className="flex-1 px-2.5 py-1 bg-background border border-input rounded text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* E. Fill in Blanks Layout (শূন্যস্থান পূরণ) */}
          {formData.type === 'fill-blanks' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  শূন্যস্থানযুক্ত বাক্য বা অনুচ্ছেদ (Use `_____` for blanks) *
                </label>
                <RichTextField
                  value={formData.questionText}
                  onChange={(v) => setFormData({ ...formData, questionText: v })}
                  placeholder="ঢাকা বাংলাদেশের _____। কাজী নজরুল ইসলাম আমাদের _____ কবি।"
                  minHeight="70px"
                />
              </div>

              {/* Clues Box */}
              <div className="space-y-2 bg-muted/20 p-3 rounded-lg border border-border">
                <label className="block text-[11px] font-bold text-foreground">
                  ক্লু বক্সের শব্দাবলি (Word Bank / Clue Options)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(formData.fillBlanksOptions || ['', '', '', '']).map((clue, cIdx) => (
                    <input
                      key={cIdx}
                      type="text"
                      value={clue}
                      onChange={(e) => {
                        const clues = [...(formData.fillBlanksOptions || [])];
                        clues[cIdx] = e.target.value;
                        setFormData({ ...formData, fillBlanksOptions: clues });
                      }}
                      placeholder={`ক্লু ${cIdx + 1}`}
                      className="px-2.5 py-1 bg-background border border-input rounded text-xs"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* F. Short / Structured / Descriptive / Worksheet Layout */}
          {(formData.type === 'short' ||
            formData.type === 'descriptive' ||
            formData.type === 'arabic-hadith' ||
            formData.type === 'worksheet-trace') && (
            <div className="space-y-4 pt-2 border-t border-border">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  {formData.type === 'arabic-hadith'
                    ? 'হাদিস বা আরবি পাঠ্য (Arabic Text RTL) *'
                    : 'প্রশ্ন বা সমস্যার বিস্তারিত বিবরণ (Question Text) *'}
                </label>
                <RichTextField
                  value={formData.questionText}
                  onChange={(v) => setFormData({ ...formData, questionText: v })}
                  onFocus={() => setActiveField('questionText')}
                  placeholder="প্রশ্নের মূল বিবরণ লিখুন..."
                  minHeight="80px"
                />
              </div>

              {/* Dotted Lines Slider for Worksheets */}
              <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-lg">
                <div>
                  <label className="text-[11px] font-bold text-foreground block">
                    উত্তরের জন্য ডটেড ফাঁকা লাইন (Blank Answer Lines)
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    শিক্ষার্থীদের উত্তর লেখার জন্য ডট লাইন সংখ্যা
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={formData.dottedLinesCount || 0}
                    onChange={(e) =>
                      setFormData({ ...formData, dottedLinesCount: parseInt(e.target.value) || 0 })
                    }
                    className="w-28 accent-primary"
                  />
                  <span className="font-mono font-bold text-xs text-primary w-6 text-right">
                    {formData.dottedLinesCount || 0}টি
                  </span>
                </div>
              </div>

              {/* Sub-questions breakdown list */}
              <div className="space-y-2 bg-muted/20 p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">
                    উপ-প্রশ্নসমূহ (Structured Sub-Questions)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSubQuestion}
                    className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>উপ-প্রশ্ন যোগ</span>
                  </button>
                </div>

                {formData.subQuestions?.map((subQ, sIdx) => (
                  <div key={subQ.id} className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs w-8 text-muted-foreground">
                      {subQ.label}
                    </span>
                    <input
                      type="text"
                      value={subQ.text}
                      onChange={(e) => handleUpdateSubQuestion(sIdx, { text: e.target.value })}
                      placeholder="উপ-প্রশ্নের টেক্সট..."
                      className="flex-1 px-2.5 py-1 bg-background border border-input rounded text-xs"
                    />
                    <input
                      type="number"
                      value={subQ.marks}
                      onChange={(e) =>
                        handleUpdateSubQuestion(sIdx, { marks: parseFloat(e.target.value) || 0 })
                      }
                      className="w-14 px-2 py-1 bg-background border border-input rounded text-xs font-mono text-center"
                      placeholder="মান"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteSubQuestion(sIdx)}
                      className="p-1 text-muted-foreground hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Examiner Notes */}
          <div className="pt-2 border-t border-border">
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
              পরীক্ষকের জন্য নির্দেশিকা বা নমুনা উত্তর (Optional Solution Key / Notes)
            </label>
            <input
              type="text"
              value={formData.notesForExaminer || ''}
              onChange={(e) => setFormData({ ...formData, notesForExaminer: e.target.value })}
              onFocus={() => setActiveField('notes')}
              placeholder="শিক্ষক সমাধান বা নম্বর বণ্টনের নিয়মাবলী..."
              className="w-full px-3 py-1 bg-background border border-input rounded text-xs"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-border text-foreground hover:bg-muted rounded text-xs font-medium transition-colors"
          >
            বাতিল (Cancel)
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>সংরক্ষণ করুন (Apply)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
