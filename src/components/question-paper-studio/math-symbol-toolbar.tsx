'use client';

import { useState } from 'react';
import { MATH_SYMBOL_GROUPS } from '@/lib/question-paper-studio/math-symbols';
import { Pi, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between rounded-none bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/70"
      >
        <div className="flex items-center gap-1.5 text-foreground">
          <Pi className="w-3.5 h-3.5 text-primary" />
          <span>গণিত ও বিজ্ঞান সমীকরণ প্রতীক (Math & Science Symbols)</span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <span>{isOpen ? 'টুলবার লুকান' : 'প্রতীক সিলেক্টর খুলুন'}</span>
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </Button>

      {/* Expanded Palette */}
      {isOpen && (
        <div className="p-2.5 space-y-2 border-t border-border bg-card">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {MATH_SYMBOL_GROUPS.map((group) => (
              <Button
                key={group.category}
                type="button"
                size="xs"
                variant={activeCategory === group.category ? 'default' : 'ghost'}
                onClick={() => setActiveCategory(group.category)}
                className={
                  activeCategory === group.category
                    ? 'whitespace-nowrap text-[10px] font-semibold'
                    : 'whitespace-nowrap bg-muted/60 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              >
                {group.category.split(' (')[0]}
              </Button>
            ))}
          </div>

          {/* Symbol Buttons Grid */}
          <div className="flex flex-wrap gap-1 pt-1">
            {currentGroup.symbols.map((sym, idx) => (
              <Button
                key={idx}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onInsertSymbol(sym.value)}
                title={sym.tooltip || sym.label}
                className="min-w-[28px] font-mono text-xs font-bold active:scale-95 hover:border-primary/50 hover:bg-primary/10"
              >
                {sym.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
