'use client';

import { useState } from 'react';
import { ExamPaperStudioModel as ExamPaper, QuestionItem } from '@/types/exam-studio';
import { Layers, Shuffle, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface BatchProcessingModalProps {
  isOpen: boolean;
  paper: ExamPaper;
  onClose: () => void;
  onApplySet: (updatedPaper: ExamPaper) => void;
}

export function BatchProcessingModal({
  isOpen,
  paper,
  onClose,
  onApplySet,
}: BatchProcessingModalProps) {
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleMCQOptions, setShuffleMCQOptions] = useState(true);

  // ponytail: Fisher-Yates unbiased vs sort(() => 0.5 - Math.random())
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const createShuffledSet = (setName: string, isTeacherCopy = false): ExamPaper => {
    const cloned = JSON.parse(JSON.stringify(paper)) as ExamPaper;
    cloned.header.examSet = setName;

    if (isTeacherCopy) {
      cloned.header.examSet = `${setName} [শিক্ষক কপি / উত্তরপত্র]`;
      cloned.layout.showWatermark = true;
      cloned.layout.watermarkText = 'TEACHER ANSWER KEY';
      cloned.layout.watermarkOpacity = 0.08;
    }

    cloned.sections = cloned.sections.map((section) => {
      let questionsCopy = [...section.questions];

      if (shuffleQuestions && !isTeacherCopy) {
        questionsCopy = shuffle(questionsCopy);
      }

      const renumbered = questionsCopy.map((q, idx) => {
        const item: QuestionItem = {
          ...q,
          qNumber: String(idx + 1),
        };

        if (shuffleMCQOptions && (item.type === 'mcq' || item.type === 'mcq-polynomial') && item.mcqOptions && !isTeacherCopy) {
          const originalOpts = [...item.mcqOptions];
          const ogCorrect = item.mcqCorrectIndex ?? 0;
          const correctText = originalOpts[ogCorrect];
          const shuffled = shuffle(originalOpts);
          item.mcqOptions = shuffled;
          // Remap correct index after shuffle so answer key stays correct
          item.mcqCorrectIndex = shuffled.findIndex((o) => o === correctText);
          if (item.mcqCorrectIndex < 0) item.mcqCorrectIndex = ogCorrect;
        }

        return item;
      });

      return {
        ...section,
        questions: renumbered,
      };
    });

    return cloned;
  };

  const handleApplySingleSet = (setName: string) => {
    const newSet = createShuffledSet(setName);
    onApplySet(newSet);
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // Confetti fallback
    }
    onClose();
  };

  const handleGenerateTeacherKey = () => {
    const teacherCopy = createShuffledSet(paper.header.examSet || 'মূল সেট', true);
    teacherCopy.layout.showTeacherNotes = true;
    onApplySet(teacherCopy);
    onClose();
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="মাল্টিপল সেট ও শাফলিং ইঞ্জিন (Batch Sets)"
      description="Generate Question Sets with Shuffled Orders & Teacher Keys"
      icon={<Layers className="h-4 w-4" />}
      maxWidth="lg"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            বন্ধ করুন (Close)
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Shuffling Options */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Shuffle className="h-3.5 w-3.5 text-primary" />
            <span>শাফলিং কনফিগারেশন (Randomization Rules)</span>
          </div>

          <label
            htmlFor="batch-shuffle-questions"
            className="flex cursor-pointer items-center gap-2 pt-1 text-muted-foreground hover:text-foreground"
          >
            <Checkbox
              id="batch-shuffle-questions"
              checked={shuffleQuestions}
              onCheckedChange={(checked) => setShuffleQuestions(checked === true)}
            />
            <span>প্রশ্নের ক্রম এলোমেলো করুন (Shuffle Question Order)</span>
          </label>

          <label
            htmlFor="batch-shuffle-mcq-options"
            className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Checkbox
              id="batch-shuffle-mcq-options"
              checked={shuffleMCQOptions}
              onCheckedChange={(checked) => setShuffleMCQOptions(checked === true)}
            />
            <span>MCQ বিকল্প (ক, খ, গ, ঘ) অদলবদল করুন (Shuffle MCQ Options)</span>
          </label>
        </div>

        {/* Quick Apply Set Selector */}
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            তাত্ক্ষণিক সেট রূপান্তর (Apply Shuffled Set)
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {['ক-সেট (পদ্মা)', 'খ-সেট (মেঘনা)', 'গ-সেট (যমুনা)'].map((setName) => (
              <Button
                key={setName}
                type="button"
                variant="outline"
                onClick={() => handleApplySingleSet(setName)}
                className="group h-auto flex-col items-start gap-0 whitespace-normal p-2.5 text-left hover:border-primary hover:bg-primary/5"
              >
                <div className="font-semibold text-foreground group-hover:text-primary">
                  {setName}
                </div>
                <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                  র‍্যান্ডম প্রশ্ন সেট চালু করুন
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Teacher Solution Sheet Generator */}
        <div className="border-t border-border pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateTeacherKey}
            className="w-full"
          >
            <FileText className="h-3.5 w-3.5 text-[var(--status-warning-text)]" />
            <span>শিক্ষক কপি ও উত্তরমালা ভিউ চালু করুন (Teacher Answer Key)</span>
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
