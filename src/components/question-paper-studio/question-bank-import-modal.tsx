'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QuestionItem, ExamSection } from '@/types/exam-studio';
import { AppDropdown } from '@/components/ui/app-dropdown';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search, BookOpen, Plus, Loader2, FileQuestion } from 'lucide-react';

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

  const allSelected = questionPool.length > 0 && selectedQuestionIds.size === questionPool.length;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="প্রশ্ন ব্যাংক থেকে ইমপোর্ট করুন (Import from Question Bank)"
      description="Browse and select pre-authored institutional questions"
      icon={<BookOpen className="h-4 w-4" />}
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            {selectedQuestionIds.size}টি প্রশ্ন নির্বাচিত হয়েছে
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              বাতিল (Cancel)
            </Button>
            <Button onClick={handleImport} disabled={selectedQuestionIds.size === 0}>
              <Plus className="h-3.5 w-3.5" />
              <span>প্রশ্নপত্রে যুক্ত করুন ({selectedQuestionIds.size})</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-xs">
        {/* Filter Controls Bar */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="প্রশ্ন, অধ্যায় বা টপিক দিয়ে খুঁজুন..."
                className="h-8 pl-8 pr-3 text-xs"
              />
            </div>

            {/* Type Filter */}
            <div>
              <AppDropdown
                value={filterType}
                onChange={setFilterType}
                options={[
                  { value: "ALL", label: "সকল ধরন (All Types)" },
                  { value: "CREATIVE_NCTB", label: "সৃজনশীল (CQ)" },
                  { value: "MCQ", label: "বহুনির্বাচনী (MCQ)" },
                  { value: "SHORT", label: "সংক্ষিপ্ত প্রশ্ন" },
                  { value: "DESCRIPTIVE", label: "বর্ণনামূলক প্রশ্ন" },
                ]}
                triggerClassName="text-xs"
              />
            </div>

            {/* Difficulty Filter */}
            <div>
              <AppDropdown
                value={filterDifficulty}
                onChange={setFilterDifficulty}
                options={[
                  { value: "ALL", label: "সকল কাঠিন্য (Difficulty)" },
                  { value: "EASY", label: "সহজ (Easy)" },
                  { value: "MEDIUM", label: "পরিমিত (Medium)" },
                  { value: "HARD", label: "কঠিন (Hard)" },
                ]}
                triggerClassName="text-xs"
              />
            </div>
          </div>

          {/* Target Section Selector */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">
                টার্গেট বিভাগ (Target Section):
              </span>
              <AppDropdown
                value={selectedSectionId}
                onChange={setSelectedSectionId}
                options={sections.map((sec) => ({ value: sec.sectionId, label: sec.title }))}
                triggerClassName="text-xs font-semibold"
              />
            </div>

            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleSelectAll}
              className="h-auto p-0 text-[11px]"
            >
              {allSelected ? 'সবগুলো বাতিল করুন' : 'সবগুলো সিলেক্ট করুন'}
            </Button>
          </div>
        </div>

        {/* Question Pool List */}
        <div className="space-y-2.5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>প্রশ্ন ব্যাংক থেকে ডেটা লোড হচ্ছে...</span>
            </div>
          ) : questionPool.length === 0 ? (
            <div className="space-y-2 py-16 text-center text-muted-foreground">
              <FileQuestion className="mx-auto h-8 w-8 opacity-40" />
              <p>কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
            </div>
          ) : (
            questionPool.map((q) => {
              const isSelected = selectedQuestionIds.has(q.id);
              return (
                <label
                  key={q.id}
                  htmlFor={`qbank-${q.id}`}
                  className={`block cursor-pointer rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`qbank-${q.id}`}
                      checked={isSelected}
                      onCheckedChange={() => handleToggleSelect(q.id)}
                      className="mt-0.5"
                    />

                    <div className="flex-1 space-y-1">
                      {/* Chapter & Tags */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
                          {q.type}
                        </span>
                        {q.chapter && (
                          <span className="text-muted-foreground">
                            অধ্যায়: <span className="font-medium text-foreground">{q.chapter}</span>
                          </span>
                        )}
                        <span className="font-mono font-bold text-primary">
                          [{q.marks} নম্বর]
                        </span>
                      </div>

                      {/* Stimulus */}
                      {q.stimulus && (
                        <div className="line-clamp-2 rounded border-l-2 border-primary bg-muted/40 p-2 text-[11px] italic text-muted-foreground">
                          {q.stimulus}
                        </div>
                      )}

                      {/* Question Text */}
                      <div className="text-xs font-semibold leading-snug text-foreground">
                        {q.questionText}
                      </div>

                      {/* Options / Subquestions preview */}
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] text-muted-foreground">
                          {q.options.slice(0, 4).map((opt: any, idx: number) => (
                            <div key={idx} className="truncate">
                              ({opt.id || idx + 1}) {opt.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </AppModal>
  );
}
