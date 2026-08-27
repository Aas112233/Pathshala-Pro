"use client";

import { useState, useEffect } from "react";
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

const CATEGORY_TABS = [
  { value: "", label: "All Notices" },
  { value: "ACADEMIC", label: "Academic" },
  { value: "EXAMINATION", label: "Exams" },
  { value: "FEE_REMINDER", label: "Fees" },
  { value: "HOLIDAY", label: "Holidays" },
  { value: "EVENT", label: "Events" },
  { value: "URGENT_ALERT", label: "Urgent Alerts" },
];

export default function NoticesPage() {
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
        toast.error("Failed to load school notices");
      }
    } catch {
      toast.error("Network error loading noticeboard");
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
    if (!confirm("Are you sure you want to delete this notice?")) return;

    try {
      const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Notice deleted");
        fetchNotices();
      } else {
        toast.error(json.error?.message || "Failed to delete notice");
      }
    } catch {
      toast.error("Network error deleting notice");
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
        toast.success(notice.isPinned ? "Notice unpinned" : "Notice pinned to top");
        fetchNotices();
      }
    } catch {
      toast.error("Error updating pin state");
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || "NORMAL").toUpperCase();
    if (p === "URGENT") {
      return (
        <Badge variant="destructive" className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold">
          URGENT
        </Badge>
      );
    }
    if (p === "HIGH") {
      return (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
          HIGH
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
      header: "NOTICE & TITLE",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          {row.isPinned && <Pin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
          <div>
            <p
              onClick={() => setViewingNotice(row)}
              className="text-xs font-bold text-foreground hover:text-indigo-600 cursor-pointer transition-colors"
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
      header: "CATEGORY",
      cell: (row) => (
        <Badge variant="outline" className="text-[10px] uppercase font-mono">
          {row.category}
        </Badge>
      ),
    },
    {
      key: "priority",
      header: "PRIORITY",
      cell: (row) => getPriorityBadge(row.priority),
    },
    {
      key: "audience",
      header: "AUDIENCE",
      cell: (row) => (
        <span className="text-xs text-muted-foreground font-mono">{row.audience}</span>
      ),
    },
    {
      key: "publishDate",
      header: "DATE",
      cell: (row) => (
        <span className="text-xs text-muted-foreground font-mono">
          {new Date(row.publishDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "ACTIONS",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => handleTogglePin(row, e)}
            className="h-7 w-7 p-0"
            title={row.isPinned ? "Unpin notice" : "Pin notice"}
          >
            <Pin className={`h-3.5 w-3.5 ${row.isPinned ? "text-indigo-600 fill-indigo-600" : "text-muted-foreground"}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingNotice(row);
              setIsCreateModalOpen(true);
            }}
            className="h-7 w-7 p-0"
            title="Edit notice"
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => handleDelete(row.id, e)}
            className="h-7 w-7 p-0 text-destructive"
            title="Delete notice"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="School Noticeboard & Circulars"
          description="Institutional announcements, academic notices, examination schedules & circulars."
          icon={Megaphone}
        />
        <Button
          onClick={() => {
            setEditingNotice(null);
            setIsCreateModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm text-xs h-9 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Publish Notice
        </Button>
      </div>

      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Active Notices
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Bell className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{totalCount}</h3>
            <p className="text-[11px] text-muted-foreground">Published on noticeboard</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Pinned Circulars
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Pin className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{pinnedNotices.length}</h3>
            <p className="text-[11px] text-muted-foreground">Top-priority pinned</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Academics & Exams
              </span>
              <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <GraduationCap className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{examAcademicCount}</h3>
            <p className="text-[11px] text-muted-foreground">Academic announcements</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Urgent Campus Alerts
              </span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{urgentCount}</h3>
            <p className="text-[11px] text-muted-foreground">High/Urgent priority</p>
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
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search, Filter & View Mode */}
        <div className="flex items-center gap-2 shrink-0">
          <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search circulars..."
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
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
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
              Loading noticeboard...
            </div>
          ) : notices.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
              No notices published in this category.
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
                      ? "border-indigo-500/40 bg-indigo-50/10 dark:bg-indigo-950/20 shadow-xs"
                      : "border-border/80 bg-card hover:border-primary/40"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        {n.isPinned && (
                          <Badge className="bg-indigo-600 text-white gap-1 text-[9px] px-1.5 py-0">
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

                    <CardTitle className="text-sm font-bold text-foreground line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
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
                          <button
                            onClick={(e) => handleTogglePin(n, e)}
                            className="p-1 text-muted-foreground hover:text-indigo-600 transition-colors"
                            title={n.isPinned ? "Unpin" : "Pin"}
                          >
                            <Pin className={`h-3 w-3 ${n.isPinned ? "text-indigo-600 fill-indigo-600" : ""}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNotice(n);
                              setIsCreateModalOpen(true);
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(n.id, e)}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
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
          title="Notice Directory"
          subtitle={`Showing ${notices.length} published notices`}
          data={notices}
          columns={tableColumns}
          keyExtractor={(row) => row.id}
          searchPlaceholder="Filter notice table..."
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
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
