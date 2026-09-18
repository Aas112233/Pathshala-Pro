import { redirect } from "next/navigation";

/**
 * Legacy marks-entry screen retired in favour of the unified /exam-results
 * page (results ledger + server-paginated filters + bulk-upsert marks entry
 * + gradebook matrix). The old page saved via POST-only, which rejected
 * every re-submission with duplicate errors, and loaded an unscoped student
 * list — any bookmarked link lands on the maintained screen instead.
 */
export default function LegacyExamResultsRedirectPage() {
  redirect("/exam-results");
}
