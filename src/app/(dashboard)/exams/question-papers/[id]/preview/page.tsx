"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  FileDown,
  Edit3,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exportElementToHighResPDF, triggerPrintWindow } from "@/lib/question-paper-studio/pdf-export";
import { toast } from "sonner";

export default function QuestionPaperPreviewPage() {
  const t = useTranslations();
  const params = useParams();
  const id = params?.id as string;

  // Toggle between Student Exam Sheet and Teacher Solution Key
  const [showSolutions, setShowSolutions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch paper details with fully hydrated sections
  const { data: paperData, isLoading } = useQuery({
    queryKey: ["question-paper-preview", id],
    queryFn: async () => {
      const res = await fetch(`/api/question-papers/${id}`);
      if (!res.ok) throw new Error("Failed to fetch question paper");
      return res.json();
    },
    enabled: !!id,
  });

  const paper = paperData?.data;

  const handlePrint = () => {
    triggerPrintWindow("question-paper-print-sheet");
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const toastId = toast.loading("300 DPI হাই-রেজোলিউশন PDF প্রস্তুত হচ্ছে...");
    try {
      const sanitizedName = (paper?.title || "Exam-Paper").replace(/[^a-zA-Z0-9\u0980-\u09FF-]/g, "_");
      const result = await exportElementToHighResPDF("question-paper-print-sheet", {
        fileName: `${sanitizedName}.pdf`,
        paper: paperData?.data,
      });

      if (result.success) {
        toast.success(t("questionPapers.pdfDownloaded"), { id: toastId });
      } else {
        toast.error(result.error || t("questionPapers.pdfError"), { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || t("questionPapers.pdfExportError"), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        {t("questionPapers.loadingPreview")}
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        {t("questionPapers.previewNotFound")}
      </div>
    );
  }

  const tenant = paper.tenant || {};
  const sections = paper.hydratedSections || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-card rounded-lg border border-border shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/exams/question-papers">
            <Button variant="outline" size="sm" className="h-9 w-9 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              {paper.title}
              <Badge variant="outline" className="font-mono text-[10px]">
                {paper.code || paper.paperId}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              {paper.class?.name} • {paper.subject?.name} • {t("questionPapers.print.fullMarks")}: {paper.totalMarks}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {paper.isLocked && (
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 text-xs gap-1">
              <Lock className="h-3 w-3" />
              লক করা (Results Published)
            </Badge>
          )}

          {!paper.isLocked && (
            <Link href={`/exams/question-papers/${id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t("common.edit") || "সম্পাদনা"}
              </Button>
            </Link>
          )}

          <Button
            variant={showSolutions ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowSolutions(!showSolutions)}
            className="gap-1.5 text-xs font-semibold"
          >
            {showSolutions ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showSolutions ? t("questionPapers.hideSolutionKey") : t("questionPapers.teacherSolutionKey")}
          </Button>

          <Button onClick={handlePrint} size="sm" className="gap-2 font-bold shadow-md">
            <Printer className="h-4 w-4" />
            {t("questionPapers.print.printButton") || "প্রিন্ট / PDF"}
          </Button>
        </div>
      </div>

      {/* Official Examination Paper Sheet Container */}
      <div
        id="question-paper-print-sheet"
        className="bg-white text-black p-8 sm:p-12 rounded-lg border border-border shadow-lg print:border-none print:shadow-none print:p-0 print:m-0 font-serif leading-relaxed"
      >
        {/* School Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6 space-y-1">
          <h2 className="text-2xl font-bold uppercase tracking-wide text-black font-sans">
            {tenant.name || t("questionPapers.schoolExamFallback")}
          </h2>
          {tenant.address && (
            <p className="text-xs text-gray-700 font-sans">{tenant.address}</p>
          )}
          <div className="pt-2">
            <h3 className="text-lg font-bold uppercase tracking-wider underline text-black">
              {paper.title}
            </h3>
          </div>

          {/* Subject, Class, Marks, Time Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 text-xs font-sans font-semibold border-t border-gray-300 mt-3">
            <div className="text-left">
              <span className="text-gray-600">{t("questionPapers.print.class")}: </span>
              <span className="text-black">{paper.class?.name}</span>
            </div>
            <div className="text-left sm:text-center">
              <span className="text-gray-600">{t("questionPapers.print.subject")}: </span>
              <span className="text-black">{paper.subject?.name}</span>
            </div>
            <div className="text-left sm:text-center">
              <span className="text-gray-600">{t("questionPapers.timeAllowed")}: </span>
              <span className="text-black">
                {Math.floor(paper.durationMinutes / 60)}h {paper.durationMinutes % 60}m
              </span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-gray-600">{t("questionPapers.print.fullMarks")}: </span>
              <span className="text-black font-bold font-mono">{paper.totalMarks}</span>
            </div>
          </div>

          {/* Student Fill-in Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 text-xs font-sans text-left">
            <div>
              <span>{t("questionPapers.studentNameLine")}</span>
            </div>
            <div className="sm:text-right">
              <span>{t("questionPapers.rollNoSectionLine")}</span>
            </div>
          </div>
        </div>

        {/* General Instructions */}
        {paper.instructions && (
          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded text-xs font-sans italic">
            <strong className="not-italic uppercase font-bold block mb-1">
              {t("questionPapers.generalInstructions")}
            </strong>
            <div className="whitespace-pre-line text-gray-800">{paper.instructions}</div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((sec: any) => {
            const questions = sec.questions || [];

            return (
              <div key={sec.sectionId || sec.id} className="space-y-4">
                {/* Section Title & Marks */}
                <div className="border-b border-gray-400 pb-1 flex justify-between items-baseline">
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wide font-sans">
                      {sec.title}
                    </h4>
                    {(sec.subTitle || sec.instructions) && (
                      <p className="text-xs text-gray-700 font-sans italic pt-0.5">
                        {sec.subTitle || sec.instructions}
                      </p>
                    )}
                  </div>
                  {sec.totalMarks !== undefined && (
                    <span className="font-mono text-xs font-bold font-sans">
                      [{sec.totalMarks} {t("questionPapers.print.marks")}]
                    </span>
                  )}
                </div>

                {/* Section Questions */}
                <div className="space-y-5">
                  {questions.map((q: any, qIdx: number) => (
                    <div key={q.id || qIdx} className="space-y-2 text-xs leading-relaxed">
                      {/* Stimulus Passage if present */}
                      {q.stimulus && (
                        <div className="p-3 bg-gray-50 border-l-2 border-black text-xs italic font-serif my-2 text-gray-900">
                          <span className="font-bold uppercase not-italic text-[10px] text-gray-600 block mb-1">
                            {t("questionPapers.context")}
                          </span>
                          {q.stimulus}
                        </div>
                      )}

                      {/* Main Question Line */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <span className="font-bold font-sans mr-2">{q.qNumber || qIdx + 1}.</span>
                          <span className="font-medium text-black text-sm">{q.questionText}</span>
                        </div>
                        {q.marks !== undefined && (
                          <span className="font-mono text-xs font-bold shrink-0">
                            [{q.marks}]
                          </span>
                        )}
                      </div>

                      {/* MCQ Options Display */}
                      {Array.isArray(q.mcqOptions) && q.mcqOptions.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6 pt-1 font-sans text-xs">
                          {q.mcqOptions.map((opt: string, optIdx: number) => (
                            <div
                              key={optIdx}
                              className={`p-1.5 rounded flex items-center gap-1.5 ${
                                showSolutions && q.mcqCorrectIndex === optIdx
                                  ? "bg-emerald-100 text-emerald-900 font-bold border border-emerald-400"
                                  : "text-gray-900"
                              }`}
                            >
                              <span className="font-bold font-mono">
                                ({['ক', 'খ', 'গ', 'ঘ'][optIdx] || optIdx + 1})
                              </span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Legacy Options Array */}
                      {!q.mcqOptions && Array.isArray(q.options) && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6 pt-1 font-sans text-xs">
                          {q.options.map((opt: any) => (
                            <div
                              key={opt.id}
                              className={`p-1.5 rounded flex items-center gap-1.5 ${
                                showSolutions && opt.isCorrect
                                  ? "bg-emerald-100 text-emerald-900 font-bold border border-emerald-400"
                                  : "text-gray-900"
                              }`}
                            >
                              <span className="font-bold font-mono">({opt.id})</span>
                              <span>{opt.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Polynomial Statements */}
                      {Array.isArray(q.polynomialStatements) && (
                        <div className="pl-6 space-y-0.5 text-xs text-gray-900">
                          {q.polynomialStatements.map((stmt: string, sIdx: number) => (
                            <div key={sIdx} className="flex items-baseline gap-1.5">
                              <span className="font-serif font-medium">{['i.', 'ii.', 'iii.'][sIdx] || `${sIdx + 1}.`}</span>
                              <span>{stmt}</span>
                            </div>
                          ))}
                          {q.polynomialQuestionText && (
                            <div className="font-medium pt-1">{q.polynomialQuestionText}</div>
                          )}
                        </div>
                      )}

                      {/* NCTB Creative (CQ) Sub-Questions Display */}
                      {q.cqParts && (
                        <div className="space-y-1.5 pl-6 pt-1">
                          {q.cqParts.ka?.text && (
                            <div className="flex justify-between items-baseline text-xs text-gray-900">
                              <div>
                                <span className="font-bold mr-2">(ক)</span>
                                <span>{q.cqParts.ka.text}</span>
                              </div>
                              <span className="font-mono font-semibold text-[11px]">
                                [{q.cqParts.ka.marks || 1}]
                              </span>
                            </div>
                          )}
                          {q.cqParts.kha?.text && (
                            <div className="flex justify-between items-baseline text-xs text-gray-900">
                              <div>
                                <span className="font-bold mr-2">(খ)</span>
                                <span>{q.cqParts.kha.text}</span>
                              </div>
                              <span className="font-mono font-semibold text-[11px]">
                                [{q.cqParts.kha.marks || 2}]
                              </span>
                            </div>
                          )}
                          {q.cqParts.ga?.text && (
                            <div className="flex justify-between items-baseline text-xs text-gray-900">
                              <div>
                                <span className="font-bold mr-2">(গ)</span>
                                <span>{q.cqParts.ga.text}</span>
                              </div>
                              <span className="font-mono font-semibold text-[11px]">
                                [{q.cqParts.ga.marks || 3}]
                              </span>
                            </div>
                          )}
                          {q.cqParts.gha?.text && (
                            <div className="flex justify-between items-baseline text-xs text-gray-900">
                              <div>
                                <span className="font-bold mr-2">(ঘ)</span>
                                <span>{q.cqParts.gha.text}</span>
                              </div>
                              <span className="font-mono font-semibold text-[11px]">
                                [{q.cqParts.gha.marks || 4}]
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Legacy subQuestions */}
                      {!q.cqParts && Array.isArray(q.subQuestions) && (
                        <div className="space-y-1.5 pl-6 pt-1">
                          {q.subQuestions.map((sq: any) => (
                            <div
                              key={sq.label}
                              className="flex justify-between items-baseline text-xs text-gray-900"
                            >
                              <div>
                                <span className="font-bold font-mono mr-2">({sq.label})</span>
                                <span>{sq.text}</span>
                              </div>
                              <span className="font-mono font-semibold text-[11px]">
                                [{sq.marks}]
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Teacher Solution Key Overlay */}
                      {showSolutions && (
                        <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded text-xs font-sans text-emerald-950 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t("questionPapers.solutionKeyAnswer")} {q.correctAnswer || q.notesForExaminer || t("questionPapers.referTextbook")}
                          </div>
                          {q.explanation && (
                            <div className="text-[11px] text-emerald-900 italic">
                              {t("questionPapers.note")} {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Paper End Mark */}
        <div className="text-center pt-12 pb-4 text-xs uppercase font-sans font-bold tracking-widest text-gray-500 border-t border-gray-300 mt-12">
          {t("questionPapers.endOfQuestionPaper")}
        </div>
      </div>
    </div>
  );
}
