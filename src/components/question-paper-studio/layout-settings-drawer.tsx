'use client';

import React from 'react';
import {
  ExamPaperStudioModel as ExamPaper,
  LayoutSettings,
  BengaliFontFamily,
  NumeralSystem,
  PageFormat,
  ColumnLayout,
  HeaderStyle,
  BorderStyle,
  MarksPosition,
  NumberingStyle,
} from '@/types/exam-studio';
import { AppDropdown } from '@/components/ui/app-dropdown';
import {
  X,
  Sliders,
  Type,
  Layout,
  Grid,
  Sparkles,
  FileText,
  AlignLeft,
  CheckSquare,
  Shield,
  Layers,
} from 'lucide-react';

interface LayoutSettingsDrawerProps {
  isOpen: boolean;
  paper: ExamPaper;
  onClose: () => void;
  onUpdatePaper: (updated: ExamPaper) => void;
}

export function LayoutSettingsDrawer({
  isOpen,
  paper,
  onClose,
  onUpdatePaper,
}: LayoutSettingsDrawerProps) {
  if (!isOpen) return null;

  const layout = paper.layout;

  const updateLayout = (partial: Partial<LayoutSettings>) => {
    onUpdatePaper({
      ...paper,
      layout: {
        ...paper.layout,
        ...partial,
      },
      lastModified: new Date().toISOString(),
    });
  };

  const updateHeader = (field: string, value: any) => {
    onUpdatePaper({
      ...paper,
      header: {
        ...paper.header,
        [field]: value,
      },
      lastModified: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-card text-card-foreground border-l border-border shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/40">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-md">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  লেআউট ও প্রশ্নপত্র কাস্টমাইজেশন
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Header Styles, Borders, Typography & Student Slip
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

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
            {/* 1. Header Layout Styles */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider">
                হেডার লেআউট স্টাইল (Header Style)
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { id: 'classic-center', name: 'ক্লাসিক বোর্ড সেন্টার (Classic Center)', desc: 'বোর্ড পরীক্ষার সনাতন কেন্দ্রিক শিরোনাম' },
                  { id: 'modern-dual', name: 'মডার্ন ডুয়েল কলাম (Modern Dual / Logo)', desc: 'বাম পাশে লোগো ও ডান পাশে পরীক্ষার তথ্য' },
                  { id: 'cambridge-grid', name: 'কেমব্রিজ গ্রিড ফরম্যাট (Cambridge Grid)', desc: 'আন্তর্জাতিক স্ট্যান্ডার্ড বক্সড হেডার' },
                  { id: 'madrasah-ornate', name: 'মাদরাসা বিসমিল্লাহ ডাবল ফ্রেম (Madrasah Ornate)', desc: 'ক্যালিগ্রাফিক বিসমিল্লাহ ও নকশাদার ফ্রেম' },
                  { id: 'minimal-left', name: 'ইউনিভার্সিটি মিনিমাল (Minimal Left)', desc: 'বিশ্ববিদ্যালয় ও কলেজ টার্ম ফাইনাল ফরম্যাট' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateLayout({ headerStyle: item.id as HeaderStyle })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      layout.headerStyle === item.id
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-2xs'
                        : 'border-border bg-card text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-foreground">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Border & Frame Styles */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider">
                পৃষ্ঠার ফ্রেম ও বর্ডার (Border Style)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'none', label: 'বর্ডারহীন (None)' },
                  { id: 'solid', label: 'সলিড বক্স (Solid)' },
                  { id: 'double', label: 'ডাবল লাইন (Double)' },
                  { id: 'dashed', label: 'ড্যাশড (Dashed)' },
                  { id: 'dotted', label: 'ডটেড (Dotted)' },
                  { id: 'ornamental', label: 'নকশাদার (Ornate)' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => updateLayout({ borderStyle: b.id as BorderStyle, showBorder: b.id !== 'none' })}
                    className={`px-2 py-1.5 rounded border text-center font-medium transition-all ${
                      layout.borderStyle === b.id
                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-2xs'
                        : 'border-border bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Student Information Slip & Tear-off Box */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-bold text-foreground block">
                    শিক্ষার্থীর তথ্য বক্স (Student Info Box)
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    নাম, রোল, শাখা, রেজিস্ট্রেশন ও পরিদর্শকের স্বাক্ষর বক্স
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={layout.studentInfoBox || false}
                  onChange={(e) => updateLayout({ studentInfoBox: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
              </div>

              {/* Dotted Answer Lines */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-bold text-foreground block">
                    উত্তরের জন্য ডটেড লাইন (Dotted Answer Lines)
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    ওয়ার্কশিট ও ছোটদের জন্য লেখার ফাঁকা ডট লাইন
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={layout.showDottedAnswerLines || false}
                  onChange={(e) => updateLayout({ showDottedAnswerLines: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
              </div>

              {/* Cut Line */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-bold text-foreground block">
                    কাট লাইন / ছেঁড়ার নির্দেশক (Perforated Cut Line)
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    ওএমআর বা ক্লাস টেস্টের মাঝে কাঁচির প্রতীকযুক্ত ড্যাশ লাইন
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={layout.showHeaderCutLine || false}
                  onChange={(e) => updateLayout({ showHeaderCutLine: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
              </div>

              {/* OMR Grid */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-bold text-foreground block">
                    ওএমআর বৃত্ত গ্রিড (OMR Bubble Sheet Preview)
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    MCQ পরীক্ষার নিচে উত্তর ভরাট করার বৃত্ত তালিকা
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={layout.showOMRGrid || false}
                  onChange={(e) => updateLayout({ showOMRGrid: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            {/* 4. Column Layout */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider">
                কলাম বিন্যাস (Column Layout)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'single', label: 'একক কলাম (১-কলাম ফুল)' },
                  { id: 'two-column', label: 'দ্বি-কলাম বোর্ড প্রিন্ট (২-কলাম)' },
                ].map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => updateLayout({ columnLayout: col.id as ColumnLayout })}
                    className={`px-3 py-1.5 rounded border text-center font-medium transition-all ${
                      layout.columnLayout === col.id
                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-2xs'
                        : 'border-border bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Typography & Bengali Fonts */}
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider">
                বাংলা ফন্ট ও টাইপোগ্রাফি (Bengali Fonts)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'hind', label: 'Hind Siliguri (প্রমিত)', fontClass: 'font-hind' },
                  { id: 'tiro', label: 'Tiro Bangla (বই মুদ্রণ)', fontClass: 'font-tiro' },
                  { id: 'noto', label: 'Noto Serif (সেরিফ ক্লাসিক)', fontClass: 'font-noto' },
                  { id: 'anek', label: 'Anek Bangla (আধুনিক)', fontClass: 'font-anek' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => updateLayout({ fontBengali: f.id as BengaliFontFamily })}
                    className={`px-3 py-2 rounded border text-center transition-all ${f.fontClass} ${
                      layout.fontBengali === f.id
                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                        : 'border-border bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Numbering Format */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                    সংখ্যা পদ্ধতি (Numerals)
                  </label>
                  <AppDropdown
                    value={layout.numeralSystem}
                    onChange={(v) => updateLayout({ numeralSystem: v as NumeralSystem })}
                    options={[
                      { value: "bengali", label: "বাংলা (১, ২, ৩...)" },
                      { value: "english", label: "ইংরেজি (1, 2, 3...)" },
                      { value: "arabic", label: "আরবি (١, ٢, ٣...)" },
                    ]}
                    triggerClassName="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                    নম্বর প্রদর্শন (Marks Display)
                  </label>
                  <AppDropdown
                    value={layout.marksPosition || 'right-bracket'}
                    onChange={(v) => updateLayout({ marksPosition: v as MarksPosition })}
                    options={[
                      { value: "right-bracket", label: "ডান পাশে [১০]" },
                      { value: "inline-parentheses", label: "লাইনের শেষে (১০)" },
                      { value: "hidden", label: "লুকিয়ে রাখুন (Hidden)" },
                    ]}
                    triggerClassName="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 6. Spacing, Margins & Font Sizing */}
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider">
                সাইজ ও ফাঁকা মার্জিন (Spacing & Sizing)
              </label>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                    ফন্ট সাইজ
                  </label>
                  <AppDropdown
                    value={layout.fontSize}
                    onChange={(v) => updateLayout({ fontSize: v as any })}
                    options={[
                      { value: "compact", label: "কম্প্যাক্ট (ছোট)" },
                      { value: "sm", label: "পরিমিত (Small)" },
                      { value: "md", label: "স্ট্যান্ডার্ড (Medium)" },
                      { value: "lg", label: "বড় (Large)" },
                      { value: "xl", label: "খুব বড় (Primary)" },
                    ]}
                    triggerClassName="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                    লাইন ব্যবধান
                  </label>
                  <AppDropdown
                    value={layout.lineSpacing}
                    onChange={(v) => updateLayout({ lineSpacing: v as any })}
                    options={[
                      { value: "tight", label: "ঘন (Tight)" },
                      { value: "normal", label: "সাধারণ (Normal)" },
                      { value: "relaxed", label: "স্বস্তিকর (Relaxed)" },
                      { value: "spacious", label: "প্রশস্ত (Spacious)" },
                    ]}
                    triggerClassName="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                    মার্জিন সাইজ
                  </label>
                  <AppDropdown
                    value={layout.marginSize || 'standard'}
                    onChange={(v) => updateLayout({ marginSize: v as any })}
                    options={[
                      { value: "compact", label: "কম্প্যাক্ট (১০ মিমি)" },
                      { value: "standard", label: "স্ট্যান্ডার্ড (১৫ মিমি)" },
                      { value: "wide", label: "প্রশস্ত (২০ মিমি)" },
                    ]}
                    triggerClassName="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 7. Watermark Settings */}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-bold text-foreground block">
                    জলছাপ / ওয়াটারমার্ক (Watermark)
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    প্রশ্নের পটভূমিতে প্রতিষ্ঠানের নাম বা জলছাপ
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={layout.showWatermark || false}
                  onChange={(e) => updateLayout({ showWatermark: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
              </div>

              {layout.showWatermark && (
                <div className="space-y-2 p-3 bg-muted/30 border border-border rounded-lg">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      ওয়াটারমার্ক টেক্সট (Watermark Text)
                    </label>
                    <input
                      type="text"
                      value={layout.watermarkText || ''}
                      onChange={(e) => updateLayout({ watermarkText: e.target.value })}
                      placeholder="প্রতিষ্ঠানের নাম বা পরীক্ষার নাম"
                      className="w-full px-2.5 py-1 bg-background border border-input rounded text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>স্বচ্ছতা (Opacity): {Math.round((layout.watermarkOpacity || 0.08) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.02"
                      max="0.25"
                      step="0.01"
                      value={layout.watermarkOpacity || 0.08}
                      onChange={(e) => updateLayout({ watermarkOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border bg-muted/40 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-xs font-semibold shadow-xs transition-colors"
            >
              সম্পন্ন (Apply Settings)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
