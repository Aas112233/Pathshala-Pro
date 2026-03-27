"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
}

const ANIMATION_DURATION = 200; // ms — matches the Dialog component

export function AppModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'md'
}: AppModalProps) {
  // Controls whether the modal is mounted in the DOM at all
  const [isMounted, setIsMounted] = useState(false);
  // Controls the CSS animation state (open vs closing)
  const [animationState, setAnimationState] = useState<'entering' | 'open' | 'exiting' | 'closed'>('closed');
  const backdropRef = useRef<HTMLDivElement>(null);

  // Open animation
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      // Force a reflow before adding the 'open' class so the animation plays
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationState('entering');
          // After the animation finishes, mark as fully open
          const timer = setTimeout(() => setAnimationState('open'), ANIMATION_DURATION);
          return () => clearTimeout(timer);
        });
      });
      document.body.style.overflow = 'hidden';
    } else if (isMounted) {
      // Close animation
      setAnimationState('exiting');
      const timer = setTimeout(() => {
        setAnimationState('closed');
        setIsMounted(false);
        document.body.style.overflow = 'unset';
      }, ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isMounted || typeof document === 'undefined') return null;

  const isVisible = animationState === 'entering' || animationState === 'open';

  const maxWidthClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    'full': 'max-w-[95vw]',
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Animated Backdrop — fade in/out */}
      <div
        ref={backdropRef}
        className={cn(
          "fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity",
          isVisible
            ? "opacity-100 duration-200 ease-out"
            : "opacity-0 duration-200 ease-in"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Animated Modal Content — fade + zoom + slide */}
      <div
        role="dialog"
        aria-modal
        aria-labelledby="app-modal-title"
        aria-describedby={description ? "app-modal-description" : undefined}
        className={cn(
          "relative z-50 w-full rounded-xl border border-border bg-background p-6 shadow-xl shadow-black/10 overflow-hidden",
          // Animation transition properties
          "transition-all",
          isVisible
            ? "duration-200 ease-out opacity-100 scale-100 translate-y-0"
            : "duration-200 ease-in opacity-0 scale-95 -translate-y-2",
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <h2 id="app-modal-title" className="text-xl font-semibold leading-none tracking-tight">{title}</h2>
            {description && (
              <p id="app-modal-description" className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 -mt-2 -mr-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-[70vh] overflow-y-auto px-1 -mx-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
