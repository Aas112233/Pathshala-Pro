'use client';

import React, { useMemo } from 'react';
import { ExamPaperStudioModel as ExamPaper } from '@/types/exam-studio';
import { Award, CheckCircle2, AlertTriangle, PieChart, Sparkles, X } from 'lucide-react';

interface CognitiveBalanceMeterProps {
  paper: ExamPaper;
  isOpen: boolean;
  onClose: () => void;
}

export function CognitiveBalanceMeter({ paper, isOpen, onClose }: CognitiveBalanceMeterProps) {
  const stats = useMemo(() => {
    const allQuestions = paper.sections.flatMap((s) => s.questions);
    const totalCount = allQuestions.length;

    let totalMarks = 0;
    const cognitiveCounts: Record<string, number> = {
      'জ্ঞান': 0,
      'অনুধাবন': 0,
      'প্রয়োগ': 0,
      'উচ্চতর দক্ষতা': 0,
      'সমন্বিত': 0,
    };

    const difficultyCounts: Record<string, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    allQuestions.forEach((q) => {
      const numericMarks = typeof q.marks === 'number' ? q.marks : parseFloat(String(q.marks)) || 1;
      totalMarks += numericMarks;

      const level = q.cognitiveLevel || 'জ্ঞান';
      cognitiveCounts[level] = (cognitiveCounts[level] || 0) + 1;

      const diff = q.difficulty || 'medium';
      difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
    });

    const targetMarks = parseFloat(paper.header.totalMarks) || 100;
    const isMarksBalanced = Math.abs(totalMarks - targetMarks) < 0.1;

    return {
      totalCount,
      totalMarks,
      targetMarks,
      isMarksBalanced,
      cognitive: {
        knowledge: totalCount ? Math.round(((cognitiveCounts['জ্ঞান'] || 0) / totalCount) * 100) : 0,
        comprehension: totalCount ? Math.round(((cognitiveCounts['অনুধাবন'] || 0) / totalCount) * 100) : 0,
        application: totalCount ? Math.round(((cognitiveCounts['প্রয়োগ'] || 0) / totalCount) * 100) : 0,
        higherOrder: totalCount ? Math.round(((cognitiveCounts['উচ্চতর দক্ষতা'] || 0) / totalCount) * 100) : 0,
        integrated: totalCount ? Math.round(((cognitiveCounts['সমন্বিত'] || 0) / totalCount) * 100) : 0,
      },
      difficulty: {
        easy: totalCount ? Math.round((difficultyCounts.easy / totalCount) * 100) : 0,
        medium: totalCount ? Math.round((difficultyCounts.medium / totalCount) * 100) : 0,
        hard: totalCount ? Math.round((difficultyCounts.hard / totalCount) * 100) : 0,
      },
    };
  }, [paper]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-card text-card-foreground border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 text-primary rounded-md">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                ব্লুমস ট্যাক্সনমি ও মান ভারসাম্য (Cognitive Balance)
              </h2>
              <p className="text-[11px] text-muted-foreground">
                NCTB Examination Standards & Difficulty Distribution
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
        <div className="p-5 space-y-5 text-xs overflow-y-auto max-h-[80vh]">
          {/* Marks Budget Summary */}
          <div className="p-3.5 bg-muted/30 border border-border rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block">
                নম্বর বাজেট স্থিতি (Marks Budget)
              </span>
              <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                {stats.totalMarks} / {stats.targetMarks} Marks
              </div>
            </div>
            <div>
              {stats.isMarksBalanced ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full font-semibold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>সঠিকভাবে বণ্টিত</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full font-semibold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>
                    {stats.totalMarks > stats.targetMarks
                      ? `+${stats.totalMarks - stats.targetMarks} নম্বর অতিরিক্ত`
                      : `${stats.targetMarks - stats.totalMarks} নম্বর ঘাটতি`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bloom's Taxonomy Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <Award className="w-3.5 h-3.5 text-primary" />
                <span>জ্ঞানীয় দক্ষতার অনুপাত (Cognitive Levels)</span>
              </h3>
              <span className="text-[10px] text-muted-foreground font-medium">NCTB প্রমিত অনুপাত</span>
            </div>

            <div className="space-y-2">
              {/* Knowledge */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-foreground">জ্ঞানমূলক (Knowledge) — ৪০% টার্গেট</span>
                  <span className="font-mono font-bold text-foreground">{stats.cognitive.knowledge}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.cognitive.knowledge}%` }}
                    className="h-full bg-blue-500 rounded-full transition-all"
                  />
                </div>
              </div>

              {/* Comprehension */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-foreground">অনুধাবনমূলক (Comprehension) — ৩০% টার্গেট</span>
                  <span className="font-mono font-bold text-foreground">{stats.cognitive.comprehension}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.cognitive.comprehension}%` }}
                    className="h-full bg-emerald-500 rounded-full transition-all"
                  />
                </div>
              </div>

              {/* Application */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-foreground">প্রয়োগমূলক (Application) — ২০% টার্গেট</span>
                  <span className="font-mono font-bold text-foreground">{stats.cognitive.application}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.cognitive.application}%` }}
                    className="h-full bg-amber-500 rounded-full transition-all"
                  />
                </div>
              </div>

              {/* Higher Order */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-medium text-foreground">উচ্চতর দক্ষতা (Higher Order) — ১০% টার্গেট</span>
                  <span className="font-mono font-bold text-foreground">{stats.cognitive.higherOrder}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    style={{ width: `${stats.cognitive.higherOrder}%` }}
                    className="h-full bg-purple-500 rounded-full transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Difficulty Breakdown */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h3 className="font-bold text-foreground text-xs">
              কাঠিন্যের ভারসাম্য (Difficulty Split)
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  সহজ (Easy)
                </div>
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                  {stats.difficulty.easy}%
                </div>
              </div>

              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  পরিমিত (Medium)
                </div>
                <div className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                  {stats.difficulty.medium}%
                </div>
              </div>

              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                  কঠিন (Hard)
                </div>
                <div className="text-base font-bold text-rose-700 dark:text-rose-300 font-mono mt-0.5">
                  {stats.difficulty.hard}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/40 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-xs font-semibold shadow-xs transition-colors"
          >
            ঠিক আছে (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
