"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { DataTable } from "@/components/shared/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useHostelsViewModel,
  useHostelRoomsViewModel,
  useHostelAllocationsViewModel,
} from "@/viewmodels/hostel/use-hostel-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { usePDFExport, type HostelManifestPDFData, type HostelResident } from "@/hooks/use-pdf-export";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { BedDouble, Plus, Pencil, Trash2, Search, Building2, Users, DoorOpen, Printer, Download, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function HostelPage() {
  const t = useTranslations("hostel");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "hostel", "read");
  const canWrite = hasPermission(perms, "hostel", "write");
  const canManage = hasPermission(perms, "hostel", "manage");
  const { settings } = useTenantSettings();
  const { exportHostelManifestPDF } = usePDFExport();
  const { run: runHostelSubmit, isPending: isGuardedHostel } = useSubmitGuard();

  const [activeTab, setActiveTab] = useState("hostels");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [roomSearch, setRoomSearch] = useState("");
  const [roomSearchInput, setRoomSearchInput] = useState("");
  const [roomHostelFilter, setRoomHostelFilter] = useState("");
  const [roomPage, setRoomPage] = useState(1);
  const [allocSearch, setAllocSearch] = useState("");
  const [allocSearchInput, setAllocSearchInput] = useState("");
  const [allocPage, setAllocPage] = useState(1);

  // Hostel form
  const [isHostelSheetOpen, setIsHostelSheetOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<any | null>(null);
  const [hostelForm, setHostelForm] = useState({ name: "", type: "BOYS", wardenName: "", wardenPhone: "", address: "", capacity: 0 });
  const [hostelErrors, setHostelErrors] = useState<Record<string, string>>({});

  // Room form
  const [isRoomSheetOpen, setIsRoomSheetOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [roomForm, setRoomForm] = useState({ hostelId: "", roomNumber: "", floor: 1, capacity: 4, roomType: "GENERAL" });
  const [roomErrors, setRoomErrors] = useState<Record<string, string>>({});

  // Allocation form
  const [isAllocSheetOpen, setIsAllocSheetOpen] = useState(false);
  const [allocForm, setAllocForm] = useState({ hostelId: "", roomId: "", studentProfileId: "", bedNumber: "" });
  const [allocErrors, setAllocErrors] = useState<Record<string, string>>({});

  const { hostels, pagination, isLoading, createHostel, updateHostel, deleteHostel, isMutating: isHostelMutating } = useHostelsViewModel(search, page);
  const { rooms, pagination: roomPagination, isLoading: isRoomLoading, createRoom, updateRoom, deleteRoom, isMutating: isRoomMutating } = useHostelRoomsViewModel(roomHostelFilter, roomSearch, roomPage);
  const { allocations, pagination: allocPagination, isLoading: isAllocLoading, createAllocation, deleteAllocation } = useHostelAllocationsViewModel(allocSearch, "", allocPage);

  const { data: studentsData } = useQuery({
    queryKey: ["students-hostel"],
    queryFn: async () => {
      const r = await fetch("/api/students?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const students = (studentsData as any)?.data ?? [];

  const openAddHostel = () => {
    setEditingHostel(null);
    setHostelForm({ name: "", type: "BOYS", wardenName: "", wardenPhone: "", address: "", capacity: 0 });
    setHostelErrors({});
    setIsHostelSheetOpen(true);
  };
  const openEditHostel = (h: any) => {
    setEditingHostel(h);
    setHostelForm({ name: h.name, type: h.type, wardenName: h.wardenName || "", wardenPhone: h.wardenPhone || "", address: h.address || "", capacity: h.capacity || 0 });
    setHostelErrors({});
    setIsHostelSheetOpen(true);
  };
  const handleHostelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!hostelForm.name.trim()) errs.name = "Required";
    setHostelErrors(errs);
    if (Object.keys(errs).length) return;
    void runHostelSubmit(async () => {
      try {
        const payload: any = { ...hostelForm, capacity: Number(hostelForm.capacity) || 0, wardenName: hostelForm.wardenName || null, wardenPhone: hostelForm.wardenPhone || null, address: hostelForm.address || null };
        if (editingHostel) await updateHostel(editingHostel.id, payload);
        else await createHostel(payload);
        setIsHostelSheetOpen(false);
      } catch {}
    });
  };
  const handleDeleteHostel = async (id: string) => {
    if (!confirm(t("confirmDeleteHostel"))) return;
    try { await deleteHostel(id); } catch {}
  };

  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({ hostelId: "", roomNumber: "", floor: 1, capacity: 4, roomType: "GENERAL" });
    setRoomErrors({});
    setIsRoomSheetOpen(true);
  };
  const openEditRoom = (r: any) => {
    setEditingRoom(r);
    setRoomForm({ hostelId: r.hostelId, roomNumber: r.roomNumber, floor: r.floor, capacity: r.capacity, roomType: r.roomType });
    setRoomErrors({});
    setIsRoomSheetOpen(true);
  };
  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!roomForm.hostelId) errs.hostelId = "Required";
    if (!roomForm.roomNumber.trim()) errs.roomNumber = "Required";
    setRoomErrors(errs);
    if (Object.keys(errs).length) return;
    void runHostelSubmit(async () => {
      try {
        const payload: any = { ...roomForm, floor: Number(roomForm.floor), capacity: Number(roomForm.capacity) };
        if (editingRoom) await updateRoom(editingRoom.id, payload);
        else await createRoom(payload);
        setIsRoomSheetOpen(false);
      } catch {}
    });
  };
  const handleDeleteRoom = async (id: string) => {
    if (!confirm(t("confirmDeleteRoom"))) return;
    try { await deleteRoom(id); } catch {}
  };

  const openAlloc = () => {
    setAllocForm({ hostelId: "", roomId: "", studentProfileId: "", bedNumber: "" });
    setAllocErrors({});
    setIsAllocSheetOpen(true);
  };
  const handleAllocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!allocForm.hostelId) errs.hostelId = "Required";
    if (!allocForm.roomId) errs.roomId = "Required";
    if (!allocForm.studentProfileId) errs.studentProfileId = "Required";
    setAllocErrors(errs);
    if (Object.keys(errs).length) return;
    void runHostelSubmit(async () => {
      try {
        await createAllocation({ hostelId: allocForm.hostelId, roomId: allocForm.roomId, studentProfileId: allocForm.studentProfileId, bedNumber: allocForm.bedNumber || null });
        setIsAllocSheetOpen(false);
      } catch {}
    });
  };

  const handlePrintHostelManifest = (hostel: any) => {
    const hostelAllocs = (allocations || []).filter(
      (a: any) => a.hostelId === hostel.id || a.hostel?.id === hostel.id
    );
    const hostelRoomsList = (rooms || []).filter(
      (r: any) => r.hostelId === hostel.id
    );
    const totalCap = hostelRoomsList.reduce((s: number, r: any) => s + (r.capacity || 0), 0) || hostel.capacity || 0;

    const residents: HostelResident[] = hostelAllocs.map((a: any) => ({
      rollNumber: a.studentProfile?.rollNumber || "—",
      studentName: `${a.studentProfile?.firstName || ""} ${a.studentProfile?.lastName || ""}`.trim() || "Resident Student",
      className: a.studentProfile?.class?.name || "General",
      sectionName: a.studentProfile?.section?.name,
      roomNumber: a.room?.roomNumber || "—",
      bedNumber: a.bedNumber || "Bed",
      roomType: a.room?.roomType || "GENERAL",
      guardianName: a.studentProfile?.guardianName,
      guardianPhone: a.studentProfile?.guardianContact,
      allocationDate: new Date(a.createdAt || Date.now()).toLocaleDateString(),
    }));

    const manifestData: HostelManifestPDFData = {
      schoolName: settings?.name?.trim() || "Pathshala Pro Academy",
      hostelName: hostel.name,
      hostelType: hostel.type,
      wardenName: hostel.wardenName,
      wardenPhone: hostel.wardenPhone,
      address: hostel.address,
      totalCapacity: totalCap,
      totalOccupied: hostelAllocs.length,
      totalRooms: hostelRoomsList.length,
      generatedDate: new Date().toLocaleDateString(),
      residents,
    };

    exportHostelManifestPDF(manifestData);
    toast.success(`Generated Resident Manifest for ${hostel.name}`);
  };

  const totalCapacitySum = rooms.reduce((acc: number, r: any) => acc + (r.capacity || 0), 0);
  const totalAllocCount = (allocPagination as any)?.totalCount ?? allocations.length;

  const hostelColumns: ColumnDef<any>[] = [
    {
      accessorKey: "name",
      header: t("hostelName"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.type} {row.original.wardenName ? `· Warden: ${row.original.wardenName}` : ""}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: "type", header: t("type"), cell: ({ getValue }) => <Badge variant="outline" className="text-xs font-semibold">{String(getValue())}</Badge> },
    { accessorKey: "capacity", header: t("capacity"), cell: ({ row }) => <span className="font-semibold text-foreground">{row.original.capacity || "—"} beds</span> },
    {
      id: "occupancy",
      header: t("occupancy"),
      cell: ({ row }) => {
        const total = row.original._count?.rooms ?? 0;
        return <span className="text-xs font-medium text-muted-foreground">{total} rooms listed</span>;
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePrintHostelManifest(row.original)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            title="Download Evacuation & Resident Manifest (PDF)"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Manifest</span>
          </Button>
          {canWrite && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditHostel(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>}
          {canManage && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteHostel(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
        </div>
      ),
    },
  ];

  const roomColumns: ColumnDef<any>[] = [
    { accessorKey: "roomNumber", header: t("roomNumber"), cell: ({ row }) => <span className="font-mono text-sm font-bold text-foreground">Room {row.original.roomNumber}</span> },
    { accessorKey: "hostel", header: t("hostel"), cell: ({ row }) => <span className="font-medium text-sm text-foreground">{row.original.hostel?.name || "—"}</span> },
    { accessorKey: "floor", header: t("floor"), cell: ({ row }) => <span className="text-xs text-muted-foreground">Floor {row.original.floor}</span> },
    { accessorKey: "capacity", header: t("capacity"), cell: ({ row }) => <span className="text-xs font-semibold">{row.original.capacity} Beds</span> },
    {
      accessorKey: "occupancy",
      header: t("occupancy"),
      cell: ({ row }) => {
        const occ = row.original.occupancy ?? row.original._count?.allocations ?? 0;
        const cap = row.original.capacity;
        const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
            pct >= 100
              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
              : pct >= 70
              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}>
            {occ}/{cap} ({pct}%)
          </span>
        );
      },
    },
    { accessorKey: "roomType", header: t("roomType"), cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{String(getValue())}</Badge> },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {canWrite && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRoom(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>}
          {canManage && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteRoom(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
        </div>
      ),
    },
  ];

  const allocColumns: ColumnDef<any>[] = [
    {
      accessorKey: "studentProfile",
      header: t("student"),
      cell: ({ row }) => {
        const s = row.original.studentProfile;
        return s ? (
          <div>
            <p className="text-sm font-semibold text-foreground">{s.firstName} {s.lastName}</p>
            <p className="text-xs text-muted-foreground">Roll No: {s.rollNumber} {s.class?.name ? `· ${s.class.name}` : ""}</p>
          </div>
        ) : "—";
      },
    },
    { accessorKey: "hostel", header: t("hostel"), cell: ({ row }) => <span className="text-sm font-medium">{row.original.hostel?.name || "—"}</span> },
    { accessorKey: "room", header: t("room"), cell: ({ row }) => <span className="font-mono text-xs font-semibold">Room {row.original.room?.roomNumber || "—"}</span> },
    { accessorKey: "bedNumber", header: t("bedNumber"), cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{(getValue() as string) || "Bed"}</Badge> },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        canManage ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={async () => {
              if (!confirm(t("confirmDeleteAllocation"))) return;
              try {
                const r = await fetch(`/api/hostel-allocations/${row.original.id}`, { method: "DELETE", credentials: "include" });
                const j = await r.json();
                if (!r.ok) throw new Error(j.message);
                window.location.reload();
              } catch {}
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={BedDouble}>
        {activeTab === "hostels" && canWrite && <Button onClick={openAddHostel} className="gap-2"><Plus className="h-4 w-4" />{t("addHostel")}</Button>}
        {activeTab === "rooms" && canWrite && <Button onClick={openAddRoom} className="gap-2"><Plus className="h-4 w-4" />{t("addRoom")}</Button>}
        {activeTab === "allocations" && canWrite && <Button onClick={openAlloc} className="gap-2"><Plus className="h-4 w-4" />{t("allocateStudent")}</Button>}
      </PageHeader>

      {!canRead && !isAuthLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">You don&apos;t have permission to view hostel records.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Financial & Operational KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs border-border/80">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{(pagination as any)?.totalCount ?? hostels.length}</p>
              <p className="text-xs text-muted-foreground font-medium">{t("totalHostels")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg">
              <DoorOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{(roomPagination as any)?.totalCount ?? rooms.length}</p>
              <p className="text-xs text-muted-foreground font-medium">{t("totalRooms")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <BedDouble className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{totalCapacitySum}</p>
              <p className="text-xs text-muted-foreground font-medium">Total Beds Available</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{totalAllocCount}</p>
              <p className="text-xs text-muted-foreground font-medium">{t("totalAllocations")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="hostels" className="gap-2"><Building2 className="h-4 w-4" />{t("hostelsTab")}</TabsTrigger>
          <TabsTrigger value="rooms" className="gap-2"><DoorOpen className="h-4 w-4" />{t("roomsTab")}</TabsTrigger>
          <TabsTrigger value="allocations" className="gap-2"><Users className="h-4 w-4" />{t("allocationsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="hostels" className="space-y-4 mt-4">
          <Card className="shadow-xs border-border/80">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))} placeholder={t("searchHostels")} className="pl-9 text-xs" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSearch(searchInput); setPage(1); }} className="h-9 text-xs"><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={hostelColumns as any} data={hostels} pagination={pagination} onPageChange={setPage} onSearch={(v) => { setSearch(v); setPage(1); }} isLoading={isLoading} searchPlaceholder={t("searchHostels")} />
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4 mt-4">
          <Card className="shadow-xs border-border/80">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={roomSearchInput} onChange={(e) => setRoomSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setRoomSearch(roomSearchInput), setRoomPage(1))} placeholder={t("searchRooms")} className="pl-9 text-xs" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { setRoomSearch(roomSearchInput); setRoomPage(1); }} className="h-9 text-xs"><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={roomColumns as any} data={rooms} pagination={roomPagination} onPageChange={setRoomPage} onSearch={(v) => { setRoomSearch(v); setRoomPage(1); }} isLoading={isRoomLoading} searchPlaceholder={t("searchRooms")} />
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4 mt-4">
          <Card className="shadow-xs border-border/80">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={allocSearchInput} onChange={(e) => setAllocSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setAllocSearch(allocSearchInput), setAllocPage(1))} placeholder={t("searchAllocations")} className="pl-9 text-xs" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { setAllocSearch(allocSearchInput); setAllocPage(1); }} className="h-9 text-xs"><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={allocColumns as any} data={allocations} pagination={allocPagination} onPageChange={setAllocPage} onSearch={(v) => { setAllocSearch(v); setAllocPage(1); }} isLoading={isAllocLoading} searchPlaceholder={t("searchAllocations")} />
        </TabsContent>
      </Tabs>
        </>
      )}

      {/* Hostel Sheet */}
      <TopSheet
        isOpen={isHostelSheetOpen}
        onClose={() => setIsHostelSheetOpen(false)}
        title={editingHostel ? t("editHostel") : t("addHostel")}
        description={t("description")}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" type="button" onClick={() => setIsHostelSheetOpen(false)}>{t("cancel")}</Button>
            <Button
              type="submit"
              form="hostel-form"
              disabled={isHostelMutating || isGuardedHostel}
              aria-busy={isHostelMutating || isGuardedHostel || undefined}
            >
              {isHostelMutating || isGuardedHostel ? "Saving..." : t("save")}
            </Button>
          </div>
        }
      >
        <form id="hostel-form" onSubmit={handleHostelSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("hostelName")} required error={hostelErrors.name}><Input value={hostelForm.name} onChange={(e) => setHostelForm((p) => ({ ...p, name: e.target.value }))} placeholder={t("hostelName")} /></ERPFormField>
              <ERPFormField label={t("type")}><AppDropdown value={hostelForm.type} onChange={(v) => setHostelForm((p) => ({ ...p, type: v }))} options={[{ value: "BOYS", label: t("boys") }, { value: "GIRLS", label: t("girls") }, { value: "COMBINED", label: t("combined") }]} /></ERPFormField>
              <ERPFormField label={t("wardenName")}><Input value={hostelForm.wardenName} onChange={(e) => setHostelForm((p) => ({ ...p, wardenName: e.target.value }))} placeholder={t("wardenName")} /></ERPFormField>
              <ERPFormField label={t("wardenPhone")}><Input value={hostelForm.wardenPhone} onChange={(e) => setHostelForm((p) => ({ ...p, wardenPhone: e.target.value }))} placeholder={t("wardenPhone")} /></ERPFormField>
              <ERPFormField label={t("capacity")}><Input type="number" min={0} value={hostelForm.capacity} onChange={(e) => setHostelForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 0 }))} /></ERPFormField>
              <ERPFormField label={t("address")}><Input value={hostelForm.address} onChange={(e) => setHostelForm((p) => ({ ...p, address: e.target.value }))} placeholder={t("address")} /></ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Room Sheet */}
      <TopSheet
        isOpen={isRoomSheetOpen}
        onClose={() => setIsRoomSheetOpen(false)}
        title={editingRoom ? t("editRoom") : t("addRoom")}
        description={t("description")}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" type="button" onClick={() => setIsRoomSheetOpen(false)}>{t("cancel")}</Button>
            <Button
              type="submit"
              form="room-form"
              disabled={isRoomMutating || isGuardedHostel}
              aria-busy={isRoomMutating || isGuardedHostel || undefined}
            >
              {isRoomMutating || isGuardedHostel ? "Saving..." : t("save")}
            </Button>
          </div>
        }
      >
        <form id="room-form" onSubmit={handleRoomSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("hostel")} required error={roomErrors.hostelId}>
                <AppDropdown value={roomForm.hostelId} onChange={(v) => setRoomForm((p) => ({ ...p, hostelId: v }))} options={hostels.map((h: any) => ({ value: h.id, label: h.name }))} placeholder={t("selectHostel")} searchable />
              </ERPFormField>
              <ERPFormField label={t("roomNumber")} required error={roomErrors.roomNumber}><Input value={roomForm.roomNumber} onChange={(e) => setRoomForm((p) => ({ ...p, roomNumber: e.target.value }))} placeholder={t("roomNumber")} /></ERPFormField>
              <ERPFormField label={t("floor")}><Input type="number" min={0} value={roomForm.floor} onChange={(e) => setRoomForm((p) => ({ ...p, floor: parseInt(e.target.value) || 1 }))} /></ERPFormField>
              <ERPFormField label={t("capacity")} required><Input type="number" min={1} value={roomForm.capacity} onChange={(e) => setRoomForm((p) => ({ ...p, capacity: parseInt(e.target.value) || 4 }))} /></ERPFormField>
              <ERPFormField label={t("roomType")}><AppDropdown value={roomForm.roomType} onChange={(v) => setRoomForm((p) => ({ ...p, roomType: v }))} options={[{ value: "GENERAL", label: t("general") }, { value: "DELUXE", label: t("deluxe") }, { value: "DORMITORY", label: t("dormitory") }]} /></ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Allocation Sheet */}
      <TopSheet
        isOpen={isAllocSheetOpen}
        onClose={() => setIsAllocSheetOpen(false)}
        title={t("allocateStudent")}
        description={t("description")}
        maxWidth="xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" type="button" onClick={() => setIsAllocSheetOpen(false)}>{t("cancel")}</Button>
            <Button
              type="submit"
              form="alloc-form2"
              disabled={isGuardedHostel}
              aria-busy={isGuardedHostel || undefined}
            >
              {isGuardedHostel ? "Allocating..." : t("save")}
            </Button>
          </div>
        }
      >
        <form id="alloc-form2" onSubmit={handleAllocSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("student")} required error={allocErrors.studentProfileId}>
                <AppDropdown value={allocForm.studentProfileId} onChange={(v) => setAllocForm((p) => ({ ...p, studentProfileId: v }))} options={students.map((s: any) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.rollNumber})` }))} placeholder={t("selectStudent")} searchable />
              </ERPFormField>
              <ERPFormField label={t("hostel")} required error={allocErrors.hostelId}>
                <AppDropdown value={allocForm.hostelId} onChange={(v) => setAllocForm((p) => ({ ...p, hostelId: v, roomId: "" }))} options={hostels.map((h: any) => ({ value: h.id, label: h.name }))} placeholder={t("selectHostel")} />
              </ERPFormField>
              <ERPFormField label={t("room")} required error={allocErrors.roomId}>
                <AppDropdown value={allocForm.roomId} onChange={(v) => setAllocForm((p) => ({ ...p, roomId: v }))} options={rooms.filter((r: any) => !allocForm.hostelId || r.hostelId === allocForm.hostelId).map((r: any) => ({ value: r.id, label: `${r.roomNumber} (${r.capacity} beds)` }))} placeholder={t("selectRoom")} disabled={!allocForm.hostelId} />
              </ERPFormField>
              <ERPFormField label={t("bedNumber")}><Input value={allocForm.bedNumber} onChange={(e) => setAllocForm((p) => ({ ...p, bedNumber: e.target.value }))} placeholder={t("bedNumber")} /></ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
