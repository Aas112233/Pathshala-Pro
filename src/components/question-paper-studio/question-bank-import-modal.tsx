'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QuestionItem, ExamSection } from '@/types/exam-studio';
import {
  Search,
  BookOpen,
  Filter,
  Plus,
  Check,
  X,
  Layers,
  Loader2,
  FileQuestion,
  Sparkles,
} from 'lucide-react';

interface QuestionBankImportModalProps {
  isOpen: boolean;
  sections: ExamSection[];
  initialSectionId?: string;
  classId?: string;
  subjectId?: string;
  onClose: () => void;
  onImportQuestions: (questions: QuestionItem[], sectionId: string) => void;
}

export function QuestionBankImportModal({
  isOpen,
  sections,
  initialSectionId,
  classId,
  subjectId,
  onClose,
  onImportQuestions,
}: QuestionBankImportModalProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    initialSectionId || sections[0]?.sectionId || 'sec-default'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterDifficulty, setFilterDifficulty] = useState('ALL');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Fetch questions from Question Bank API
  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['question-bank-for-studio', classId, subjectId, filterType, filterDifficulty, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (classId) params.append('classId', classId);
      if (subjectId) params.append('subjectId', subjectId);
      if (filterType !== 'ALL') params.append('type', filterType);
      if (filterDifficulty !== 'ALL') params.append('difficulty', filterDifficulty);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '100');

      const res = await fetch(`/api/questions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch questions from bank');
      return res.json();
    },
    enabled: isOpen,
  });

  const questionPool: any[] = questionsData?.data || [];

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedQuestionIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedQuestionIds(next);
  };

  const handleSelectAll = () => {
    if (selectedQuestionIds.size === questionPool.length) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(questionPool.map((q) => q.id)));
    }
  };

  const handleImport = () => {
    const selectedQuestions = questionPool.filter((q) => selectedQuestionIds.has(q.id));
    if (selectedQuestions.length === 0) return;

    const formatted: QuestionItem[] = selectedQuestions.map((q, idx) => {
      let type: any = 'short';
      if (q.type === 'MCQ') type = 'mcq';
      else if (q.type === 'CREATIVE_NCTB') type = 'cq';
      else if (q.type === 'DESCRIPTIVE') type = 'descriptive';
      else if (q.type === 'FILL_BLANK') type = 'fill-blanks';

      // Format CQ parts if present in subQuestions
      let cqParts: any = undefined;
      if (type === 'cq' && Array.isArray(q.subQuestions)) {
        cqParts = {
          ka: { text: q.subQuestions.find((sq: any) => sq.label === 'a' || sq.label === 'ক')?.text || '', marks: 1 },
          kha: { text: q.subQuestions.find((sq: any) => sq.label === 'b' || sq.label === 'খ')?.text || '', marks: 2 },
          ga: { text: q.subQuestions.find((sq: any) => sq.label === 'c' || sq.label === 'গ')?.text || '', marks: 3 },
          gha: { text: q.subQuestions.find((sq: any) => sq.label === 'd' || sq.label === 'ঘ')?.text || '', marks: 4 },
        };
      }

      // Format MCQ options if present
      let mcqOptions: string[] | undefined = undefined;
      let mcqCorrectIndex: number | undefined = undefined;
      if (type === 'mcq' && Array.isArray(q.options)) {
        mcqOptions = q.options.map((opt: any) => opt.text);
        mcqCorrectIndex = q.options.findIndex((opt: any) => opt.isCorrect);
        if (mcqCorrectIndex === -1) mcqCorrectIndex = 0;
      }

      return {
        id: `q-imported-${Date.now()}-${idx}`,
        type,
        qNumber: String(idx + 1),
        stimulus: q.stimulus || '',
        questionText: q.questionText,
        marks: q.marks || (type === 'cq' ? 10 : 1),
        cognitiveLevel: q.bloomLevel === 'REMEMBERING' ? 'জ্ঞান' : q.bloomLevel === 'UNDERSTANDING' ? 'অনুধাবন' : q.bloomLevel === 'APPLYING' ? 'প্রয়োগ' : 'উচ্চতর দক্ষতা',
        cqParts,
        mcqOptions,
        mcqCorrectIndex,
        notesForExaminer: q.explanation || q.correctAnswer,
      };
    });

    onImportQuestions(formatted, selectedSectionId);
    setSelectedQuestionIds(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground border border-border w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 text-primary rounded-md">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                প্রশ্ন ব্যাংক থেকে ইমপোর্ট করুন (Import from Question Bank)
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Browse and select pre-authored institutional questions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-border bg-muted/20 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="প্রশ্ন, অধ্যায় বা টপিক দিয়ে খুঁজুন..."
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Type Filter */}
            <div>
              <select
                aria-label="Filter by Question Type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="ALL">সকল ধরন (All Types)</option>
                <option value="CREATIVE_NCTB">সৃজনশীল (CQ)</option>
                <option value="MCQ">বহুনির্বাচনী (MCQ)</option>
                <option value="SHORT">সংক্ষিপ্ত প্রশ্ন</option>
                <option value="DESCRIPTIVE">বর্ণনামূলক প্রশ্ন</option>
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <select
                aria-label="Filter by Difficulty Level"
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-background border border-input rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="ALL">সকল কাঠিন্য (Difficulty)</option>
                <option value="EASY">সহজ (Easy)</option>
                <option value="MEDIUM">পরিমিত (Medium)</option>
                <option value="HARD">কঠিন (Hard)</option>
              </select>
            </div>
          </div>

          {/* Target Section Selector */}
          <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">
                টার্গেট বিভাগ (Target Section):
              </span>
              <select
                aria-label="Target Examination Section"
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="px-2.5 py-1 bg-background border border-input rounded text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              >
                {sections.map((sec) => (
                  <option key={sec.sectionId} value={sec.sectionId}>
                    {sec.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] text-primary hover:underline font-semibold"
              >
                {selectedQuestionIds.size === questionPool.length && questionPool.length > 0
                  ? 'সবগুলো বাতিল করুন'
                  : 'সবগুলো সিলেক্ট করুন'}
              </button>
            </div>
          </div>
        </div>

        {/* Question Pool List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>প্রশ্ন ব্যাংক থেকে ডেটা লোড হচ্ছে...</span>
            </div>
          ) : questionPool.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <FileQuestion className="w-8 h-8 mx-auto opacity-40" />
              <p>কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
            </div>
          ) : (
            questionPool.map((q) => {
              const isSelected = selectedQuestionIds.has(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => handleToggleSelect(q.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by container onClick
                      className="mt-0.5 rounded border-input text-primary focus:ring-primary"
                    />

                    <div className="flex-1 space-y-1">
                      {/* Chapter & Tags */}
                      <div className="flex items-center gap-2 flex-wrap text-[10px]">
                        <span className="px-1.5 py-0.5 bg-muted rounded font-semibold text-muted-foreground">
                          {q.type}
                        </span>
                        {q.chapter && (
                          <span className="text-muted-foreground">
                            অধ্যায়: <span className="font-medium text-foreground">{q.chapter}</span>
                          </span>
                        )}
                        <span className="font-mono text-primary font-bold">
                          [{q.marks} নম্বর]
                        </span>
                      </div>

                      {/* Stimulus */}
                      {q.stimulus && (
                        <div className="p-2 bg-muted/40 border-l-2 border-primary rounded text-[11px] italic text-muted-foreground line-clamp-2">
                          {q.stimulus}
                        </div>
                      )}

                      {/* Question Text */}
                      <div className="font-semibold text-foreground text-xs leading-snug">
                        {q.questionText}
                      </div>

                      {/* Options / Subquestions preview */}
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1">
                          {q.options.slice(0, 4).map((opt: any, idx: number) => (
                            <div key={idx} className="truncate">
                              ({opt.id || idx + 1}) {opt.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/40 flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-medium">
            {selectedQuestionIds.size}টি প্রশ্ন নির্বাচিত হয়েছে
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-input hover:bg-muted text-foreground rounded text-xs font-semibold transition-colors"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedQuestionIds.size === 0}
              className="px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>প্রশ্নপত্রে যুক্ত করুন ({selectedQuestionIds.size})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
