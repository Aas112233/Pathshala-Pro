"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  ArrowLeft,
  FileCheck,
  Eye,
  EyeOff,
  Clock,
  Award,
  BookOpen,
  School,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function QuestionPaperPreviewPage() {
  const t = useTranslations();
  const params = useParams();
  const id = params?.id as string;

  // Toggle between Student Exam Sheet and Teacher Solution Key
  const [showSolutions, setShowSolutions] = useState(false);

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
    window.print();
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        Loading Question Paper...
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        Question paper not found.
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
              {paper.class?.name} • {paper.subject?.name} • Full Marks: {paper.totalMarks}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showSolutions ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowSolutions(!showSolutions)}
            className="gap-1.5 text-xs font-semibold"
          >
            {showSolutions ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showSolutions ? "Hide Solution Key" : "Teacher Solution Key"}
          </Button>

          <Button onClick={handlePrint} size="sm" className="gap-2 font-bold shadow-md">
            <Printer className="h-4 w-4" />
            {t("questionPapers.print.printButton")}
          </Button>
        </div>
      </div>

      {/* Official Examination Paper Sheet Container */}
      <div className="bg-white text-black p-8 sm:p-12 rounded-lg border border-border shadow-lg print:border-none print:shadow-none print:p-0 print:m-0 font-serif leading-relaxed">
        {/* School Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6 space-y-1">
          <h2 className="text-2xl font-bold uppercase tracking-wide text-black font-sans">
            {tenant.name || "School / College Examination"}
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
              <span className="text-gray-600">Class: </span>
              <span className="text-black">{paper.class?.name}</span>
            </div>
            <div className="text-left sm:text-center">
              <span className="text-gray-600">Subject: </span>
              <span className="text-black">{paper.subject?.name}</span>
            </div>
            <div className="text-left sm:text-center">
              <span className="text-gray-600">Time Allowed: </span>
              <span className="text-black">
                {Math.floor(paper.durationMinutes / 60)}h {paper.durationMinutes % 60}m
              </span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-gray-600">Full Marks: </span>
              <span className="text-black font-bold font-mono">{paper.totalMarks}</span>
            </div>
          </div>

          {/* Student Fill-in Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 text-xs font-sans text-left">
            <div>
              <span>Student Name: _________________________________________</span>
            </div>
            <div className="sm:text-right">
              <span>Roll No: _______________ Section: ________</span>
            </div>
          </div>
        </div>

        {/* General Instructions */}
        {paper.instructions && (
          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded text-xs font-sans italic">
            <strong className="not-italic uppercase font-bold block mb-1">
              General Instructions:
            </strong>
            <div className="whitespace-pre-line text-gray-800">{paper.instructions}</div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((sec: any, sIdx: number) => {
            const questions = sec.questions || [];

            return (
              <div key={sec.id} className="space-y-4">
                {/* Section Title & Marks */}
                <div className="border-b border-gray-400 pb-1 flex justify-between items-baseline">
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wide font-sans">
                      {sec.title}
                    </h4>
                    {sec.instructions && (
                      <p className="text-xs text-gray-700 font-sans italic pt-0.5">
                        {sec.instructions}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold font-sans">
                    [{sec.totalMarks} Marks]
                  </span>
                </div>

                {/* Section Questions */}
                <div className="space-y-5">
                  {questions.map((q: any, qIdx: number) => (
                    <div key={q.id} className="space-y-2 text-xs leading-relaxed">
                      {/* Stimulus Passage if present */}
                      {q.stimulus && (
                        <div className="p-3 bg-gray-50 border-l-2 border-black text-xs italic font-serif my-2 text-gray-900">
                          <span className="font-bold uppercase not-italic text-[10px] text-gray-600 block mb-1">
                            উদ্দীপক / Context:
                          </span>
                          {q.stimulus}
                        </div>
                      )}

                      {/* Main Question Line */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <span className="font-bold font-sans mr-2">Q{qIdx + 1}.</span>
                          <span className="font-medium text-black text-sm">{q.questionText}</span>
                        </div>
                        <span className="font-mono text-xs font-bold shrink-0">
                          [{q.marks}]
                        </span>
                      </div>

                      {/* MCQ Options Display */}
                      {q.type === "MCQ" && Array.isArray(q.options) && (
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

                      {/* NCTB Creative (CQ) Sub-Questions Display */}
                      {q.type === "CREATIVE_NCTB" && Array.isArray(q.subQuestions) && (
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
                            Solution Key / Answer: {q.correctAnswer || "Refer to standard textbook"}
                          </div>
                          {q.explanation && (
                            <div className="text-[11px] text-emerald-900 italic">
                              Note: {q.explanation}
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
          *** END OF QUESTION PAPER ***
        </div>
      </div>
    </div>
  );
}
