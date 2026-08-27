export type NotificationCategoryGroup = "ALL" | "ACADEMIC" | "FEES" | "URGENT" | "GENERAL";

export interface NoticeItem {
  id: string;
  tenantId: string;
  scope: string; // "GLOBAL" | "TENANT"
  title: string;
  content: string;
  category: string;
  priority: string; // "LOW" | "NORMAL" | "HIGH" | "URGENT"
  audience: string;
  targetClassId?: string | null;
  targetTenants?: string[];
  isPinned: boolean;
  isPublished: boolean;
  publishDate: string | Date;
  expiresAt?: string | Date | null;
  authorName?: string | null;
  authorRole?: string | null;
  attachmentUrl?: string | null;
  viewsCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export const NOTIFICATION_TABS: Array<{
  id: NotificationCategoryGroup;
  labelKey: string;
  fallbackLabel: string;
}> = [
  { id: "ALL", labelKey: "notifications.tabs.all", fallbackLabel: "All" },
  { id: "ACADEMIC", labelKey: "notifications.tabs.academic", fallbackLabel: "Academics & Exams" },
  { id: "FEES", labelKey: "notifications.tabs.fees", fallbackLabel: "Fee Alerts" },
  { id: "URGENT", labelKey: "notifications.tabs.urgent", fallbackLabel: "Urgent & Events" },
  { id: "GENERAL", labelKey: "notifications.tabs.general", fallbackLabel: "General" },
];

/**
 * Maps any notice category into one of the 5 top-level notification groups
 */
export function mapNoticeToGroup(notice: NoticeItem): NotificationCategoryGroup {
  const cat = (notice.category || "").toUpperCase();
  const priority = (notice.priority || "").toUpperCase();

  if (priority === "URGENT" || cat === "URGENT_ALERT") {
    return "URGENT";
  }

  if (cat === "ACADEMIC" || cat === "EXAMINATION" || cat === "EXAM") {
    return "ACADEMIC";
  }

  if (cat === "FEE_REMINDER" || cat === "FEE" || cat === "BILLING_ALERT") {
    return "FEES";
  }

  if (cat === "EVENT" || cat === "HOLIDAY") {
    return "URGENT";
  }

  return "GENERAL";
}

/**
 * Filters a list of notices by category group
 */
export function filterNoticesByCategory(
  notices: NoticeItem[],
  group: NotificationCategoryGroup
): NoticeItem[] {
  if (group === "ALL") return notices;
  return notices.filter((n) => mapNoticeToGroup(n) === group);
}

/**
 * Calculates unread counts across all category groups
 */
export function calculateNotificationCategoryCounts(
  notices: NoticeItem[],
  readIds: Set<string>
): Record<NotificationCategoryGroup, { total: number; unread: number }> {
  const counts: Record<NotificationCategoryGroup, { total: number; unread: number }> = {
    ALL: { total: notices.length, unread: notices.filter((n) => !readIds.has(n.id)).length },
    ACADEMIC: { total: 0, unread: 0 },
    FEES: { total: 0, unread: 0 },
    URGENT: { total: 0, unread: 0 },
    GENERAL: { total: 0, unread: 0 },
  };

  for (const notice of notices) {
    const group = mapNoticeToGroup(notice);
    counts[group].total += 1;
    if (!readIds.has(notice.id)) {
      counts[group].unread += 1;
    }
  }

  return counts;
}

const STORAGE_KEY_READ_NOTICES = "pathshala_read_notices";
const STORAGE_KEY_LOGIN_ACKNOWLEDGED = "pathshala_ack_login_announcements";

/**
 * Gets the set of read notice IDs from localStorage
 */
export function getReadNoticeIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const data = localStorage.getItem(STORAGE_KEY_READ_NOTICES);
    if (!data) return new Set();
    const arr = JSON.parse(data);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Marks a notice as read in localStorage
 */
export function markNoticeAsRead(noticeId: string): void {
  if (typeof window === "undefined" || !noticeId) return;
  try {
    const current = getReadNoticeIds();
    current.add(noticeId);
    localStorage.setItem(STORAGE_KEY_READ_NOTICES, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.warn("Failed to mark notice as read:", err);
  }
}

/**
 * Marks multiple notices as read in localStorage
 */
export function markAllNoticesAsRead(noticeIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = getReadNoticeIds();
    noticeIds.forEach((id) => current.add(id));
    localStorage.setItem(STORAGE_KEY_READ_NOTICES, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.warn("Failed to mark all notices as read:", err);
  }
}

/**
 * Checks if a specific notice ID has been read
 */
export function isNoticeRead(noticeId: string, readSet: Set<string>): boolean {
  return readSet.has(noticeId);
}

/**
 * Checks if user has already acknowledged login announcements in this session/device
 */
export function getAcknowledgedLoginAnnouncements(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const data = localStorage.getItem(STORAGE_KEY_LOGIN_ACKNOWLEDGED);
    if (!data) return new Set();
    const arr = JSON.parse(data);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * Records acknowledged login announcement IDs
 */
export function acknowledgeLoginAnnouncements(noticeIds: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = getAcknowledgedLoginAnnouncements();
    noticeIds.forEach((id) => current.add(id));
    localStorage.setItem(STORAGE_KEY_LOGIN_ACKNOWLEDGED, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.warn("Failed to save acknowledged login announcements:", err);
  }
}

/**
 * Format relative time for notifications
 */
export function formatNoticeRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "Recently";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
