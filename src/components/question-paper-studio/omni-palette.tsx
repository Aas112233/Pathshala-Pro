'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  BookOpen,
  Printer,
  Settings,
  Plus,
  Shuffle,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OmniPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionId: string) => void;
}

export function OmniPalette({ isOpen, onClose, onSelectAction }: OmniPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Lock background scroll while the palette is open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onSelectAction('toggle-omni');
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSelectAction]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'question-bank-import',
      title: 'প্রশ্ন ব্যাংক থেকে প্রশ্ন ইমপোর্ট করুন (Import from Question Bank)',
      category: 'Question Bank',
      icon: BookOpen,
      shortcut: 'Alt+B',
    },
    {
      id: 'cognitive-balance',
      title: 'ব্লুমস ট্যাক্সনমি ও মান ভারসাম্য মিটার (Cognitive Balance)',
      category: 'Analytics',
      icon: Settings,
      shortcut: 'Alt+M',
    },
    {
      id: 'layout-settings',
      title: 'লেআউট, বাংলা ফন্ট ও বর্ডার কনফিগার করুন (Layout Drawer)',
      category: 'Design',
      icon: Settings,
      shortcut: 'Alt+L',
    },
    {
      id: 'open-print',
      title: 'প্রশ্নপত্র প্রিন্ট বা PDF হিসেবে সংরক্ষণ করুন (Print / PDF)',
      category: 'Export',
      icon: Printer,
      shortcut: 'Ctrl+P',
    },
    {
      id: 'batch-sets',
      title: 'মাল্টিপল সেট ও শাফলিং তৈরি করুন (Set A, B, C)',
      category: 'Batch',
      icon: Shuffle,
      shortcut: 'Alt+S',
    },
    {
      id: 'add-cq-question',
      title: 'সৃজনশীল প্রশ্ন যুক্ত করুন (Add Creative Question)',
      category: 'Editor',
      icon: Plus,
      shortcut: 'Alt+Q',
    },
    {
      id: 'add-mcq-question',
      title: 'বহুনির্বাচনী প্রশ্ন যুক্ত করুন (Add MCQ)',
      category: 'Editor',
      icon: Plus,
      shortcut: 'Alt+W',
    },
    {
      id: 'template-bangla-ssc',
      title: 'স্টাইল ১: বাংলা ১ম পত্র (SSC বোর্ড সৃজনশীল ও বহুনির্বাচনী)',
      category: 'Templates',
      icon: GraduationCap,
      shortcut: '1',
    },
    {
      id: 'template-cambridge-edexcel',
      title: 'স্টাইল ২: Cambridge / Edexcel Structured Exam (O/A Level)',
      category: 'Templates',
      icon: GraduationCap,
      shortcut: '2',
    },
    {
      id: 'template-cbse-icse',
      title: 'স্টাইল ৩: CBSE / ICSE Standard Examination Format',
      category: 'Templates',
      icon: GraduationCap,
      shortcut: '3',
    },
    {
      id: 'template-madrasah-dakhil',
      title: 'স্টাইল ৪: মাদরাসা শিক্ষা বোর্ড ও আরবি প্রশ্নপত্র (Dakhil RTL)',
      category: 'Templates',
      icon: GraduationCap,
      shortcut: '4',
    },
    {
      id: 'template-mcq-omr-speed',
      title: 'স্টাইল ৫: বহুনির্বাচনী ও অপটিক্যাল ওএমআর ফরম্যাট (2-Column MCQ)',
      category: 'Templates',
      icon: GraduationCap,
      shortcut: '5',
    },
    {
      id: 'template-primary-worksheet',
      title: 'স্টাইল ৬: প্রাথমিক ও কিন্ডারগার্টেন ওয়ার্কশিট (Primary / KG)',
      category: 'Templates',
      icon: GraduationCap,
      shortcut: '6',
    },
    {
      id: 'template-university-final',
      title: 'স্টাইল ৭: বিশ্ববিদ্যালয় ও সেমিস্টার ফাইনাল পরীক্ষা',
      category: 'Templates',
      icon: GraduationCap,
      shortcut: '7',
    },
    {
      id: 'template-class-test-slip',
      title: 'স্টাইল ৮: সাপ্তাহিক ক্লাস টেস্ট ও কুইজ স্লিপ (Class Test Slip)',
      category: 'Templates',
      icon: GraduationCap,
      shortcut: '8',
    },
  ];

  const filtered = actions.filter((act) =>
    act.title.toLowerCase().includes(query.toLowerCase()) ||
    act.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectAction(filtered[selectedIndex].id);
        onClose();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground border border-border w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="p-3 border-b border-border flex items-center gap-3 bg-muted/20">
          <Search className="w-4 h-4 text-muted-foreground ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="কমান্ড, টেমপ্লেট স্টাইল বা অ্যাকশন সার্চ করুন..."
            className="w-full bg-transparent border-0 text-sm focus:outline-none focus:ring-0 placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-card border border-border rounded text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Action Results */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              কোনো অ্যাকশন বা কমান্ড পাওয়া যায়নি।
            </div>
          ) : (
            filtered.map((act, index) => {
              const Icon = act.icon;
              const isSelected = index === selectedIndex;
              return (
                <Button
                  key={act.id}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onSelectAction(act.id);
                    onClose();
                  }}
                  className={cn(
                    'h-auto w-full justify-between p-2.5 text-left',
                    isSelected
                      ? 'bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0 opacity-80" />
                    <span className="truncate">{act.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {act.category}
                    </span>
                    {act.shortcut && (
                      <kbd
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isSelected ? 'border-primary-foreground/30 text-primary-foreground' : 'border-border bg-card text-muted-foreground'
                        }`}
                      >
                        {act.shortcut}
                      </kbd>
                    )}
                  </div>
                </Button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
