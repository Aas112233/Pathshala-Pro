'use client';

import React, { useState } from 'react';
import { MATH_SYMBOL_GROUPS } from '@/lib/question-paper-studio/math-symbols';
import { Pi, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface MathSymbolToolbarProps {
  onInsertSymbol: (symbol: string) => void;
}

export function MathSymbolToolbar({ onInsertSymbol }: MathSymbolToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(MATH_SYMBOL_GROUPS[0].category);

  const currentGroup = MATH_SYMBOL_GROUPS.find((g) => g.category === activeCategory) || MATH_SYMBOL_GROUPS[0];

  return (
    <div className="border border-border bg-muted/20 rounded-lg overflow-hidden text-xs">
      {/* Header Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-1.5 bg-muted/40 hover:bg-muted/70 flex items-center justify-between text-[11px] font-semibold text-muted-foreground transition-colors"
      >
        <div className="flex items-center gap-1.5 text-foreground">
          <Pi className="w-3.5 h-3.5 text-primary" />
          <span>গণিত ও বিজ্ঞান সমীকরণ প্রতীক (Math & Science Symbols)</span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <span>{isOpen ? 'টুলবার লুকান' : 'প্রতীক সিলেক্টর খুলুন'}</span>
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </button>

      {/* Expanded Palette */}
      {isOpen && (
        <div className="p-2.5 space-y-2 border-t border-border bg-card">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {MATH_SYMBOL_GROUPS.map((group) => (
              <button
                key={group.category}
                type="button"
                onClick={() => setActiveCategory(group.category)}
                className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-medium transition-colors ${
                  activeCategory === group.category
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {group.category.split(' (')[0]}
              </button>
            ))}
          </div>

          {/* Symbol Buttons Grid */}
          <div className="flex flex-wrap gap-1 pt-1">
            {currentGroup.symbols.map((sym, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onInsertSymbol(sym.value)}
                title={sym.tooltip || sym.label}
                className="px-2 py-1 bg-background hover:bg-primary/10 hover:border-primary/50 text-foreground border border-input rounded text-xs font-mono font-bold transition-all shadow-2xs active:scale-95 min-w-[28px] text-center"
              >
                {sym.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
