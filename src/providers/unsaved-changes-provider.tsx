'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  registerDirty: (id: string, isDirty: boolean) => void;
  confirmExit: (onProceed?: () => void) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  hasUnsavedChanges: false,
  registerDirty: () => {},
  confirmExit: () => true,
});

type GuardedHistoryState = Record<string, unknown> & { __unsavedChangesIndex?: number };

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  const dirtyRegistryRef = useRef<Set<string>>(new Set());
  const dirtyRef = useRef(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    dirtyRegistryRef.current.clear();
    dirtyRef.current = false;
    setHasUnsavedChanges(false);
  }, [pathname]);

  const registerDirty = useCallback((id: string, isDirty: boolean) => {
    if (isDirty) dirtyRegistryRef.current.add(id);
    else dirtyRegistryRef.current.delete(id);
    const next = dirtyRegistryRef.current.size > 0;
    dirtyRef.current = next;
    setHasUnsavedChanges(next);
  }, []);

  const confirmExit = useCallback((onProceed?: () => void) => {
    if (dirtyRegistryRef.current.size === 0) {
      onProceed?.();
      return true;
    }

    const confirmed = window.confirm(t('unsavedChanges'));
    if (!confirmed) return false;

    dirtyRegistryRef.current.clear();
    dirtyRef.current = false;
    setHasUnsavedChanges(false);
    onProceed?.();
    return true;
  }, [t]);

  // Browser refresh/tab close and browser history navigation.
  useEffect(() => {
    const initialState = (window.history.state || {}) as GuardedHistoryState;
    let currentIndex = initialState.__unsavedChangesIndex ?? 0;
    const currentUrl = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    let restoringPopState = false;

    originalReplaceState(
      { ...initialState, __unsavedChangesIndex: currentIndex },
      '',
      window.location.href,
    );

    const allowNavigation = (url: string | URL | null | undefined) => {
      if (!dirtyRef.current) return true;
      const nextUrl = new URL(url == null ? window.location.href : String(url), window.location.href);
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      return nextPath === currentUrl() || confirmExit();
    };

    window.history.pushState = ((state: unknown, title: string, url?: string | URL | null) => {
      const nextUrl = url == null ? window.location.href : String(url);
      if (!allowNavigation(nextUrl)) return;
      currentIndex += 1;
      originalPushState({ ...((state || {}) as GuardedHistoryState), __unsavedChangesIndex: currentIndex }, title, url);
    }) as typeof window.history.pushState;

    window.history.replaceState = ((state: unknown, title: string, url?: string | URL | null) => {
      const nextUrl = url == null ? window.location.href : String(url);
      if (!allowNavigation(nextUrl)) return;
      originalReplaceState({ ...((state || {}) as GuardedHistoryState), __unsavedChangesIndex: currentIndex }, title, url);
    }) as typeof window.history.replaceState;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = t('unsavedChanges');
    };

    const handlePopState = (event: PopStateEvent) => {
      if (restoringPopState || !dirtyRef.current) {
        const index = (event.state as GuardedHistoryState | null)?.__unsavedChangesIndex;
        if (typeof index === 'number') currentIndex = index;
        return;
      }

      const targetIndex = (event.state as GuardedHistoryState | null)?.__unsavedChangesIndex;
      if (typeof targetIndex === 'number' && targetIndex === currentIndex) return;

      if (confirmExit()) {
        if (typeof targetIndex === 'number') currentIndex = targetIndex;
        return;
      }

      // Undo the browser move when the user rejects the confirmation.
      const delta = typeof targetIndex === 'number' ? currentIndex - targetIndex : 1;
      restoringPopState = true;
      window.history.go(delta);
      window.setTimeout(() => {
        restoringPopState = false;
      }, 0);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [confirmExit, t]);

  // Capture ordinary internal links before Next.js handles them.
  useEffect(() => {
    const handleClickCapture = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      const nextUrl = new URL(href, window.location.href);
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath !== currentPath && !confirmExit()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('click', handleClickCapture, true);
    return () => document.removeEventListener('click', handleClickCapture, true);
  }, [confirmExit]);

  return (
    <UnsavedChangesContext.Provider value={{ hasUnsavedChanges, registerDirty, confirmExit }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges(isDirty: boolean, formId?: string) {
  const { registerDirty, confirmExit, hasUnsavedChanges } = useContext(UnsavedChangesContext);
  const idRef = useRef(formId || `form-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    const id = idRef.current;
    registerDirty(id, isDirty);
    return () => registerDirty(id, false);
  }, [isDirty, registerDirty]);

  return { confirmExit, hasUnsavedChanges };
}
