"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Bell,
  Pin,
  Plus,
  Search,
  Calendar,
  Eye,
  AlertTriangle,
  FileText,
  Trash2,
  Edit2,
  BookOpen,
  GraduationCap,
  Megaphone,
  Filter,
  LayoutGrid,
  List,
} from "lucide-react";
import { CreateNoticeModal } from "@/components/notices/create-notice-modal";
import { NoticeDetailModal } from "@/components/notices/notice-detail-modal";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

const CATEGORY_TABS = [
  { value: "", key: "allNotices" },
  { value: "ACADEMIC", key: "academic" },
  { value: "EXAMINATION", key: "exams" },
  { value: "FEE_REMINDER", key: "fees" },
  { value: "HOLIDAY", key: "holidays" },
  { value: "EVENT", key: "events" },
  { value: "URGENT_ALERT", key: "urgentAlerts" },
];

export default function NoticesPage() {
  const t = useTranslations("notices");
  const common = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "notices", "read");
  const canWrite = hasPermission(perms, "notices", "write");
  const canManage = hasPermission(perms, "notices", "manage");
  const [notices, setNotices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<any>(null);
  const [viewingNotice, setViewingNotice] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const fetchNotices = async () => {
    setIsLoading(true);
    try {
      let url = `/api/notices?search=${encodeURIComponent(search)}`;
      if (activeCategory) url += `&category=${activeCategory}`;
      if (priorityFilter) url += `&priority=${priorityFilter}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setNotices(json.data || []);
      } else {
        toast.error(t("loadFailed"));
      }
    } catch {
      toast.error(t("networkLoad"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [activeCategory, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNotices();
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(t("confirmDelete"))) return;

    try {
      const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t("deleted"));
        fetchNotices();
      } else {
        toast.error(json.error?.message || t("deleteFailed"));
      }
    } catch {
      toast.error(t("networkDelete"));
    }
  };

  const handleTogglePin = async (notice: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !notice.isPinned }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(notice.isPinned ? t("unpinned") : t("pinned"));
        fetchNotices();
      }
    } catch {
      toast.error(t("pinError"));
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || "NORMAL").toUpperCase();
    if (p === "URGENT") {
      return (
        <Badge variant="destructive" className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold">
          {t("urgent")}
        </Badge>
      );
    }
    if (p === "HIGH") {
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
          {t("high")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-mono">
        {p}
      </Badge>
    );
  };

  const pinnedNotices = notices.filter((n) => n.isPinned);
  const totalCount = notices.length;
  const examAcademicCount = notices.filter((n) => n.category === "ACADEMIC" || n.category === "EXAMINATION").length;
  const urgentCount = notices.filter((n) => n.priority === "URGENT" || n.priority === "HIGH").length;

  const tableColumns: ColumnDef<any>[] = [
    {
      key: "title",
      header: t("noticeTitle"),
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          {row.isPinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
          <div>
            <p
              onClick={() => setViewingNotice(row)}
              className="text-xs font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
            >
              {row.title}
            </p>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{row.content}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: t("category"),
      cell: (row) => (
        <Badge variant="outline" className="text-[10px] uppercase font-mono">
          {row.category}
        </Badge>
      ),
    },
    {
      key: "priority",
      header: t("priority"),
      cell: (row) => getPriorityBadge(row.priority),
    },
    {
      key: "audience",
      header: t("audience"),
      cell: (row) => (
        <span className="text-xs text-muted-foreground font-mono">{row.audience}</span>
      ),
    },
    {
      key: "publishDate",
      header: t("date"),
      cell: (row) => (
        <span className="text-xs text-muted-foreground font-mono">
          {new Date(row.publishDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => handleTogglePin(row, e)}
              className="h-7 w-7 p-0"
              title={row.isPinned ? t("unpinNotice") : t("pinNotice")}
            >
              <Pin className={`h-3.5 w-3.5 ${row.isPinned ? "text-primary fill-primary" : "text-muted-foreground"}`} />
            </Button>
          )}
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingNotice(row);
                setIsCreateModalOpen(true);
              }}
              className="h-7 w-7 p-0"
              title={t("editNotice")}
            >
              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => handleDelete(row.id, e)}
              className="h-7 w-7 p-0 text-destructive"
              title={t("deleteNotice")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title={t("pageTitle")}
          description={t("pageDescription")}
          icon={Megaphone}
        />
        {canWrite && (
          <Button
            onClick={() => {
              setEditingNotice(null);
              setIsCreateModalOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs h-9 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            {t("publish")}
          </Button>
        )}
      </div>

      {!canRead && !isAuthLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{common("noPermission")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("activeNotices")}
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Bell className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{totalCount}</h3>
            <p className="text-[11px] text-muted-foreground">{t("publishedOnBoard")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("pinnedCirculars")}
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Pin className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{pinnedNotices.length}</h3>
            <p className="text-[11px] text-muted-foreground">{t("topPriority")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("academicsExams")}
              </span>
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <GraduationCap className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{examAcademicCount}</h3>
            <p className="text-[11px] text-muted-foreground">{t("academicAnnouncements")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("urgentCampus")}
              </span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{urgentCount}</h3>
            <p className="text-[11px] text-muted-foreground">{t("highUrgent")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar: Categories & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveCategory(tab.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t(tab.key)}
            </button>
          ))}
        </div>

        {/* Search, Filter & View Mode */}
        <div className="flex items-center gap-2 shrink-0">
          <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </form>

          <div className="flex items-center rounded-lg border border-border p-0.5 bg-card">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title={t("gridView")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title={t("tableView")}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Cards View */}
      {viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
              {t("loading")}
            </div>
          ) : notices.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              {t("empty")}
            </div>
          ) : (
            notices.map((n) => {
              const isGlobal = n.scope === "GLOBAL";

              return (
                <Card
                  key={n.id}
                  onClick={() => setViewingNotice(n)}
                  className={`group relative border transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between ${
                    n.isPinned
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/80 bg-card hover:border-primary/40"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        {n.isPinned && (
                          <Badge className="bg-primary text-primary-foreground gap-1 text-[9px] px-1.5 py-0">
                            <Pin className="h-2.5 w-2.5" /> PINNED
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0">
                          {n.category}
                        </Badge>
                        {isGlobal && (
                          <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0">
                            PLATFORM
                          </Badge>
                        )}
                      </div>
                      {getPriorityBadge(n.priority)}
                    </div>

                    <CardTitle className="text-sm font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {n.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {n.content}
                    </p>

                    <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(n.publishDate).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {n.viewsCount || 0}
                        </span>
                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          {canManage && (
                            <button
                              onClick={(e) => handleTogglePin(n, e)}
                              className="p-1 text-muted-foreground hover:text-primary transition-colors"
                              title={n.isPinned ? t("unpin") : t("pin")}
                            >
                              <Pin className={`h-3 w-3 ${n.isPinned ? "text-primary fill-primary" : ""}`} />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNotice(n);
                                setIsCreateModalOpen(true);
                              }}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title={t("edit")}
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={(e) => handleDelete(n.id, e)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                              title={t("delete")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <ERPDataTable<any>
          title={t("directory")}
          subtitle={t("showing", { count: notices.length })}
          data={notices}
          columns={tableColumns}
          keyExtractor={(row) => row.id}
          searchPlaceholder={t("filterTable")}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}
        </>
      )}

      {/* Modals */}
      <CreateNoticeModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingNotice(null);
        }}
        onSuccess={fetchNotices}
        initialData={editingNotice}
      />

      <NoticeDetailModal
        isOpen={!!viewingNotice}
        onClose={() => setViewingNotice(null)}
        notice={viewingNotice}
      />
    </div>
  );
}
