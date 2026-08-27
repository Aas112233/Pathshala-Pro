"use client";

import { useCallback, useRef, useState } from "react";

/**
 * useSubmitGuard — global duplicate press / double-submit prevention.
 *
 * Uses a synchronous ref (not just state) so a rapid double-click is blocked
 * even before React re-renders with the disabled state. Every async handler
 * wrapped with `run()` is guaranteed to execute at most once at a time.
 *
 * Usage:
 *   const { run, isPending } = useSubmitGuard();
 *
 *   const onSubmit = (data: StudentForm) =>
 *     run(async () => {
 *       await createStudent(data);   // duplicate presses are ignored
 *       toast.success("Student created");
 *     });
 *
 *   <LoadingButton loading={isPending} loadingText="Saving...">Save</LoadingButton>
 *
 * Returns `undefined` when a duplicate invocation is blocked, so callers can
 * distinguish "skipped" from a real result if needed.
 */
export function useSubmitGuard() {
    const pendingRef = useRef(false);
    const [isPending, setIsPending] = useState(false);

    const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
        // Re-entry guard: a second press while pending is silently ignored.
        if (pendingRef.current) return undefined;

        pendingRef.current = true;
        setIsPending(true);
        try {
            return await fn();
        } finally {
            pendingRef.current = false;
            setIsPending(false);
        }
    }, []);

    return { run, isPending, pendingRef };
}