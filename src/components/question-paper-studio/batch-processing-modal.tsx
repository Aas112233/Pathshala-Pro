'use client';

import React, { useState } from 'react';
import { ExamPaperStudioModel as ExamPaper, QuestionItem } from '@/types/exam-studio';
import { Layers, Shuffle, Check, X, FileText, Copy } from 'lucide-react';
import confetti from 'canvas-confetti';

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
  const [selectedSets, setSelectedSets] = useState<string[]>([
    'ক-সেট (পদ্মা)',
    'খ-সেট (মেঘনা)',
    'গ-সেট (যমুনা)',
  ]);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleMCQOptions, setShuffleMCQOptions] = useState(true);
  const [generateTeacherKey, setGenerateTeacherKey] = useState(true);

  if (!isOpen) return null;

  const toggleSet = (setName: string) => {
    if (selectedSets.includes(setName)) {
      setSelectedSets(selectedSets.filter((s) => s !== setName));
    } else {
      setSelectedSets([...selectedSets, setName]);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 text-primary rounded-md">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                মাল্টিপল সেট ও শাফলিং ইঞ্জিন (Batch Sets)
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Generate Question Sets with Shuffled Orders & Teacher Keys
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

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Shuffling Options */}
          <div className="space-y-2 p-3 bg-muted/30 border border-border rounded-lg">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Shuffle className="w-3.5 h-3.5 text-primary" />
              <span>শাফলিং কনফিগারেশন (Randomization Rules)</span>
            </div>

            <label className="flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <span>প্রশ্নের ক্রম এলোমেলো করুন (Shuffle Question Order)</span>
            </label>

            <label className="flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleMCQOptions}
                onChange={(e) => setShuffleMCQOptions(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <span>MCQ বিকল্প (ক, খ, গ, ঘ) অদলবদল করুন (Shuffle MCQ Options)</span>
            </label>
          </div>

          {/* Quick Apply Set Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              তাত্ক্ষণিক সেট রূপান্তর (Apply Shuffled Set)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['ক-সেট (পদ্মা)', 'খ-সেট (মেঘনা)', 'গ-সেট (যমুনা)'].map((setName) => (
                <button
                  key={setName}
                  type="button"
                  onClick={() => handleApplySingleSet(setName)}
                  className="p-2.5 border border-border hover:border-primary bg-card hover:bg-primary/5 rounded-lg text-left transition-all group"
                >
                  <div className="font-semibold text-foreground group-hover:text-primary">
                    {setName}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    র‍্যান্ডম প্রশ্ন সেট চালু করুন
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Teacher Solution Sheet Generator */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleGenerateTeacherKey}
              className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>শিক্ষক কপি ও উত্তরমালা ভিউ চালু করুন (Teacher Answer Key)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/40 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-input hover:bg-muted text-foreground rounded text-xs font-semibold transition-colors"
          >
            বন্ধ করুন (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
