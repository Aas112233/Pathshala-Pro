/**
 * Pagination + full-set collection helpers for report screens.
 *
 * WHY `collectAllReportRows` EXISTS
 * Once a report table paginates, every consumer of the row array has to be
 * re-examined. A PDF/Excel export that still reads the on-screen array silently
 * exports only the current page — the same class of "looks right, is wrong"
 * defect as a filter that never reaches the query. Exports therefore re-fetch
 * the whole filtered set explicitly instead of trusting what is displayed.
 */

/** Page sizes offered by the report table footer (AGENTS.md §2). */
export const REPORT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Page size used when assembling a full set for export. */
export const REPORT_EXPORT_PAGE_SIZE = 100;

/**
 * Upper bound on rows pulled for a single export. A hard ceiling keeps a
 * mis-clicked export from issuing unbounded queries; callers surface
 * `truncated` to the user rather than silently exporting a partial document.
 */
export const REPORT_EXPORT_MAX_ROWS = 20000;

export interface ReportPageResponse<T> {
  rows: T[];
  totalCount: number;
}

export interface CollectedReportRows<T> {
  rows: T[];
  truncated: boolean;
}

/**
 * Walks the report endpoint page by page until every row for the current filter
 * has been collected.
 *
 * Stops early when a page comes back empty (guards against a totalCount that
 * drifts while the export runs) and caps at `maxRows`.
 */
export async function collectAllReportRows<T>(
  fetchPage: (page: number, pageSize: number) => Promise<ReportPageResponse<T>>,
  pageSize: number = REPORT_EXPORT_PAGE_SIZE,
  maxRows: number = REPORT_EXPORT_MAX_ROWS,
): Promise<CollectedReportRows<T>> {
  const first = await fetchPage(1, pageSize);
  const rows: T[] = [...first.rows];
  const totalCount = first.totalCount;

  let page = 2;
  while (rows.length < totalCount && rows.length < maxRows) {
    const next = await fetchPage(page, pageSize);
    if (next.rows.length === 0) break;
    rows.push(...next.rows);
    page += 1;
  }

  return {
    rows: rows.slice(0, maxRows),
    truncated: totalCount > maxRows,
  };
}
