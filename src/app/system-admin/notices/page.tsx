"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Radio,
  Globe2,
  Building2,
  AlertTriangle,
  Calendar,
  Trash2,
  Edit2,
  Eye,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { CreateBroadcastModal } from "@/components/system-admin/create-broadcast-modal";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";

export default function SystemAdminNoticesPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBroadcast, setEditingBroadcast] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const fetchBroadcasts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/system-admin/notices");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        toast.error("Failed to load platform broadcasts");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this broadcast?")) return;

    try {
      const res = await fetch(`/api/system-admin/notices/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Broadcast removed");
        fetchBroadcasts();
      } else {
        toast.error(json.error?.message || "Failed to remove broadcast");
      }
    } catch {
      toast.error("Error deleting broadcast");
    }
  };

  const handleTogglePublished = async (broadcast: any) => {
    try {
      const res = await fetch(`/api/system-admin/notices/${broadcast.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !broadcast.isPublished }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(broadcast.isPublished ? "Broadcast deactivated" : "Broadcast activated");
        fetchBroadcasts();
      }
    } catch {
      toast.error("Error updating broadcast state");
    }
  };

  const broadcasts = data?.broadcasts || [];
  const metrics = data?.metrics || {
    totalBroadcasts: 0,
    activeBroadcasts: 0,
    urgentAlerts: 0,
  };

  const columns: ColumnDef<any>[] = [
    {
      key: "title",
      header: "ANNOUNCEMENT & DETAILS",
      cell: (row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground">{row.title}</span>
            {row.isPinned && (
              <Badge className="bg-indigo-600 text-white text-[9px] px-1 py-0">PINNED</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{row.content}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "TYPE",
      cell: (row) => (
        <Badge variant="outline" className="text-[10px] font-mono uppercase">
          {row.category}
        </Badge>
      ),
    },
    {
      key: "priority",
      header: "SEVERITY",
      cell: (row) => {
        const variant =
          row.priority === "URGENT"
            ? "rose"
            : row.priority === "HIGH"
            ? "amber"
            : "indigo";
        return <ERPStatusPill status={row.priority} variant={variant} />;
      },
    },
    {
      key: "audience",
      header: "TARGET SCHOOLS",
      cell: (row) => (
        <div className="flex items-center gap-1 text-xs">
          {row.audience === "ALL_SCHOOLS" ? (
            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
              <Globe2 className="h-3.5 w-3.5" /> All Schools Globally
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground font-mono">
              <Building2 className="h-3.5 w-3.5" /> {row.targetTenants?.length || 0} Schools
            </span>
          )}
        </div>
      ),
    },
    {
      key: "isPublished",
      header: "STATUS",
      cell: (row) => (
        <button
          onClick={() => handleTogglePublished(row)}
          className="cursor-pointer"
          title="Click to toggle active broadcast"
        >
          <ERPStatusPill
            status={row.isPublished ? "BROADCASTING" : "DRAFT"}
            variant={row.isPublished ? "emerald" : "subtle"}
          />
        </button>
      ),
    },
    {
      key: "publishDate",
      header: "PUBLISHED",
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
            onClick={() => {
              setEditingBroadcast(row);
              setIsModalOpen(true);
            }}
            className="h-7 w-7 p-0"
            title="Edit"
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(row.id)}
            className="h-7 w-7 p-0 text-destructive"
            title="Delete"
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
          title="Platform Announcements & Global Broadcasts"
          description="Emergency banners, maintenance announcements, and system notices transmitted to all school instances."
          icon={Radio}
        />
        <Button
          onClick={() => {
            setEditingBroadcast(null);
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm text-xs h-9 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New Global Broadcast
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Active Broadcasts
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Radio className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{metrics.activeBroadcasts}</h3>
            <p className="text-[11px] text-muted-foreground">Currently live across tenant apps</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Urgent Banners
              </span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{metrics.urgentAlerts}</h3>
            <p className="text-[11px] text-muted-foreground">Top-of-screen emergency ribbons</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Total Transmissions
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <Megaphone className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{metrics.totalBroadcasts}</h3>
            <p className="text-[11px] text-muted-foreground">Platform announcements</p>
          </CardContent>
        </Card>
      </div>

      <ERPDataTable<any>
        title="Active Broadcast Transmissions"
        subtitle="Global platform messages sent to school ERP dashboards"
        data={broadcasts}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchPlaceholder="Filter broadcast notices by title or content..."
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <CreateBroadcastModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBroadcast(null);
        }}
        onSuccess={fetchBroadcasts}
        initialData={editingBroadcast}
      />
    </div>
  );
}
