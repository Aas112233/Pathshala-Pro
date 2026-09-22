'use client';

import { useMemo } from 'react';
import { ExamPaperStudioModel as ExamPaper } from '@/types/exam-studio';
import { Award, CheckCircle2, AlertTriangle, PieChart } from 'lucide-react';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';

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

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="ব্লুমস ট্যাক্সনমি ও মান ভারসাম্য (Cognitive Balance)"
      description="NCTB Examination Standards & Difficulty Distribution"
      icon={<PieChart className="h-4 w-4" />}
      maxWidth="lg"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>ঠিক আছে (Close)</Button>
        </div>
      }
    >
      <div className="space-y-5 text-xs">
        {/* Marks Budget Summary */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3.5">
          <div>
            <span className="block text-[11px] font-semibold text-muted-foreground">
              নম্বর বাজেট স্থিতি (Marks Budget)
            </span>
            <div className="mt-0.5 font-mono text-lg font-bold text-foreground">
              {stats.totalMarks} / {stats.targetMarks} Marks
            </div>
          </div>
          <div>
            {stats.isMarksBalanced ? (
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--status-success-text)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>সঠিকভাবে বণ্টিত</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--status-warning-text)]">
                <AlertTriangle className="h-3.5 w-3.5" />
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
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Award className="h-3.5 w-3.5 text-primary" />
              <span>জ্ঞানীয় দক্ষতার অনুপাত (Cognitive Levels)</span>
            </h3>
            <span className="text-[10px] font-medium text-muted-foreground">NCTB প্রমিত অনুপাত</span>
          </div>

          <div className="space-y-2">
            {/* Knowledge */}
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-medium text-foreground">জ্ঞানমূলক (Knowledge) — ৪০% টার্গেট</span>
                <span className="font-mono font-bold text-foreground">{stats.cognitive.knowledge}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  style={{ width: `${stats.cognitive.knowledge}%` }}
                  className="h-full rounded-full bg-[var(--metric-indigo)] transition-all"
                />
              </div>
            </div>

            {/* Comprehension */}
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-medium text-foreground">অনুধাবনমূলক (Comprehension) — ৩০% টার্গেট</span>
                <span className="font-mono font-bold text-foreground">{stats.cognitive.comprehension}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  style={{ width: `${stats.cognitive.comprehension}%` }}
                  className="h-full rounded-full bg-[var(--metric-emerald)] transition-all"
                />
              </div>
            </div>

            {/* Application */}
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-medium text-foreground">প্রয়োগমূলক (Application) — ২০% টার্গেট</span>
                <span className="font-mono font-bold text-foreground">{stats.cognitive.application}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  style={{ width: `${stats.cognitive.application}%` }}
                  className="h-full rounded-full bg-[var(--metric-amber)] transition-all"
                />
              </div>
            </div>

            {/* Higher Order */}
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-medium text-foreground">উচ্চতর দক্ষতা (Higher Order) — ১০% টার্গেট</span>
                <span className="font-mono font-bold text-foreground">{stats.cognitive.higherOrder}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  style={{ width: `${stats.cognitive.higherOrder}%` }}
                  className="h-full rounded-full bg-[var(--metric-purple)] transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Difficulty Breakdown */}
        <div className="space-y-3 border-t border-border pt-3">
          <h3 className="text-xs font-bold text-foreground">
            কাঠিন্যের ভারসাম্য (Difficulty Split)
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-2.5">
              <div className="text-[10px] font-semibold text-[var(--status-success-text)]">
                সহজ (Easy)
              </div>
              <div className="mt-0.5 font-mono text-base font-bold text-[var(--status-success-text)]">
                {stats.difficulty.easy}%
              </div>
            </div>

            <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-2.5">
              <div className="text-[10px] font-semibold text-[var(--status-warning-text)]">
                পরিমিত (Medium)
              </div>
              <div className="mt-0.5 font-mono text-base font-bold text-[var(--status-warning-text)]">
                {stats.difficulty.medium}%
              </div>
            </div>

            <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-2.5">
              <div className="text-[10px] font-semibold text-[var(--status-error-text)]">
                কঠিন (Hard)
              </div>
              <div className="mt-0.5 font-mono text-base font-bold text-[var(--status-error-text)]">
                {stats.difficulty.hard}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppModal>
  );
}
