"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { academicYearsApi } from "@/lib/api-client";
import type {
  FeeBalancePolicy,
  RolloverCopyOptions,
  RolloverMode,
  RolloverPlan,
} from "@/lib/rollover-plan";

/**
 * The rollover wizard's data layer (roadmap item 16).
 *
 * ## The preview is a query, not a mutation
 *
 * A preview is a read — the server writes nothing for it — so it is cached,
 * refetched and invalidated like one. Making it a mutation would mean the
 * operator's "refresh" re-ran the whole plan from scratch with no cache entry to
 * fall back on, and would leave the component holding the last result in its own
 * state, which is exactly the shape that lets a preview go stale without anyone
 * noticing.
 *
 * ## Types are imported, not re-declared
 *
 * `RolloverPlan` comes from the pure module with `import type`, so it is erased
 * at compile time and the server's planner is not pulled into the browser
 * bundle. Re-declaring the shape here would be a second definition of a contract
 * that already has one home.
 */

export interface RolloverRequest {
  sourceAcademicYearId: string;
  mode: RolloverMode;
  /** `CREATE` only. */
  yearId?: string;
  /** `CREATE` only. */
  label?: string;
  /** `CREATE` only. */
  startDate?: string;
  /** `CREATE` only. */
  endDate?: string;
  /** `EXISTING` only. */
  academicYearId?: string;
  /**
   * All three flags are required. The server rejects a request that omits them,
   * and the UI must state what it is carrying rather than let a default decide.
   */
  copy: RolloverCopyOptions;
  /** Stated by the operator. The server refuses a request that omits it. */
  feeBalancePolicy: FeeBalancePolicy;
}

export interface RolloverApplication {
  academicYearId: string;
  academicYearRolloverId: string;
  created: number;
  updated: number;
}

export interface RolloverPreviewResponse {
  dryRun: true;
  plan: RolloverPlan;
}

export interface RolloverCommitResponse {
  plan: RolloverPlan;
  application: RolloverApplication;
}

/**
 * The plan for a request, without writing anything.
 *
 * `request` is `null` until the operator asks for a preview, so the wizard does
 * not scan a whole year's configuration on every keystroke. TanStack hashes an
 * object query key deterministically, so the same request re-uses one cache
 * entry and a changed request produces a new one.
 */
export function useRolloverPreview(request: RolloverRequest | null) {
  return useQuery({
    queryKey: ["academic-year-rollover-preview", request],
    queryFn: async () => {
      const response = await academicYearsApi.rolloverPreview(request);
      return (response.data as RolloverPreviewResponse).plan;
    },
    enabled: Boolean(request),
    // The plan is a snapshot of mutable configuration. Serving a cached one for
    // a while after the operator last looked is how a preview starts describing
    // a school that has since changed, so it is never treated as fresh.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useExecuteRollover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: RolloverRequest) => {
      const response = await academicYearsApi.rollover(request);
      return response.data as RolloverCommitResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
      // The plan described a target year that has just been written into.
      queryClient.invalidateQueries({ queryKey: ["academic-year-rollover-preview"] });
      // The class ladder, the rules and the fee structures the rest of the app
      // reads are all now one year out of date.
      queryClient.invalidateQueries({ queryKey: ["promotion-rules"] });
      queryClient.invalidateQueries({ queryKey: ["fee-structures"] });
      queryClient.invalidateQueries({ queryKey: ["academic-year-preflight"] });
    },
  });
}
