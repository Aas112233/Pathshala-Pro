"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("systemAdminPages");
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
        toast.error(t("loadBroadcastsFailed"));
      }
    } catch {
      toast.error(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDeleteBroadcast"))) return;

    try {
      const res = await fetch(`/api/system-admin/notices/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(t("broadcastRemoved"));
        fetchBroadcasts();
      } else {
        toast.error(json.error?.message || t("removeBroadcastFailed"));
      }
    } catch {
      toast.error(t("deleteBroadcastError"));
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
        toast.success(broadcast.isPublished ? t("broadcastDeactivated") : t("broadcastActivated"));
        fetchBroadcasts();
      }
    } catch {
      toast.error(t("updateBroadcastError"));
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
      header: t("announcementDetails"),
      cell: (row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground">{row.title}</span>
            {row.isPinned && (
              <Badge className="bg-primary text-primary-foreground text-[9px] px-1 py-0">{t("pinned")}</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{row.content}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: t("type"),
      cell: (row) => (
        <Badge variant="outline" className="text-[10px] font-mono uppercase">
          {row.category}
        </Badge>
      ),
    },
    {
      key: "priority",
      header: t("severity"),
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
      header: t("targetSchools"),
      cell: (row) => (
        <div className="flex items-center gap-1 text-xs">
          {row.audience === "ALL_SCHOOLS" ? (
            <span className="flex items-center gap-1 text-primary font-semibold">
              <Globe2 className="h-3.5 w-3.5" /> {t("allSchools")}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground font-mono">
              <Building2 className="h-3.5 w-3.5" /> {row.targetTenants?.length || 0} {t("schools")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "isPublished",
      header: t("broadcastStatus"),
      cell: (row) => (
        <button
          onClick={() => handleTogglePublished(row)}
          className="cursor-pointer"
          title={t("toggleBroadcast")}
        >
          <ERPStatusPill
            status={row.isPublished ? t("broadcasting") : t("draft")}
            variant={row.isPublished ? "emerald" : "subtle"}
          />
        </button>
      ),
    },
    {
      key: "publishDate",
      header: t("published"),
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingBroadcast(row);
              setIsModalOpen(true);
            }}
            className="h-7 w-7 p-0"
            title={t("edit")}
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(row.id)}
            className="h-7 w-7 p-0 text-destructive"
            title={t("delete")}
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
          title={t("platformTitle")}
          description={t("platformDescription")}
          icon={Radio}
        />
        <Button
          onClick={() => {
            setEditingBroadcast(null);
            setIsModalOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs h-9 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          {t("newBroadcast")}
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("activeBroadcasts")}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Radio className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{metrics.activeBroadcasts}</h3>
            <p className="text-[11px] text-muted-foreground">{t("liveTenantApps")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("urgentBanners")}
              </span>
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{metrics.urgentAlerts}</h3>
            <p className="text-[11px] text-muted-foreground">{t("emergencyRibbons")}</p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                {t("totalTransmissions")}
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Megaphone className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <h3 className="text-2xl font-extrabold text-foreground">{metrics.totalBroadcasts}</h3>
            <p className="text-[11px] text-muted-foreground">{t("platformAnnouncements")}</p>
          </CardContent>
        </Card>
      </div>

      <ERPDataTable<any>
        title={t("broadcastTableTitle")}
        subtitle={t("broadcastTableDescription")}
        data={broadcasts}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchPlaceholder={t("filterBroadcasts")}
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
