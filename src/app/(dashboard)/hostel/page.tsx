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
import { hasPermission } from "@/lib/permissions";
import type { ColumnDef } from "@tanstack/react-table";
import { BedDouble, Plus, Pencil, Trash2, Search, Building2, Users, DoorOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function HostelPage() {
  const t = useTranslations("hostel");
  const { user } = useAuth();
  const canManage = user?.role === "SUPER_ADMIN" || (!!user && hasPermission(user.permissions, "hostel", "write"));

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
  const handleHostelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!hostelForm.name.trim()) errs.name = "Required";
    setHostelErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const payload: any = { ...hostelForm, capacity: Number(hostelForm.capacity) || 0, wardenName: hostelForm.wardenName || null, wardenPhone: hostelForm.wardenPhone || null, address: hostelForm.address || null };
      if (editingHostel) await updateHostel(editingHostel.id, payload);
      else await createHostel(payload);
      setIsHostelSheetOpen(false);
    } catch {}
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
  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!roomForm.hostelId) errs.hostelId = "Required";
    if (!roomForm.roomNumber.trim()) errs.roomNumber = "Required";
    setRoomErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const payload: any = { ...roomForm, floor: Number(roomForm.floor), capacity: Number(roomForm.capacity) };
      if (editingRoom) await updateRoom(editingRoom.id, payload);
      else await createRoom(payload);
      setIsRoomSheetOpen(false);
    } catch {}
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
  const handleAllocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!allocForm.hostelId) errs.hostelId = "Required";
    if (!allocForm.roomId) errs.roomId = "Required";
    if (!allocForm.studentProfileId) errs.studentProfileId = "Required";
    setAllocErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await createAllocation({ hostelId: allocForm.hostelId, roomId: allocForm.roomId, studentProfileId: allocForm.studentProfileId, bedNumber: allocForm.bedNumber || null });
      setIsAllocSheetOpen(false);
    } catch {}
  };

  const hostelColumns: ColumnDef<any>[] = [
    {
      accessorKey: "name",
      header: t("hostelName"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-4 w-4 text-primary" /></div>
          <div>
            <p className="font-medium text-sm">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.type} {row.original.wardenName ? `· ${row.original.wardenName}` : ""}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: "type", header: t("type"), cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{String(getValue())}</Badge> },
    { accessorKey: "capacity", header: t("capacity") },
    {
      id: "occupancy",
      header: t("occupancy"),
      cell: ({ row }) => {
        const total = row.original._count?.rooms ?? 0;
        return <span className="text-sm">{total} rooms</span>;
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditHostel(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteHostel(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  const roomColumns: ColumnDef<any>[] = [
    { accessorKey: "roomNumber", header: t("roomNumber"), cell: ({ row }) => <span className="font-mono text-sm font-semibold">{row.original.roomNumber}</span> },
    { accessorKey: "hostel", header: t("hostel"), cell: ({ row }) => row.original.hostel?.name || "—" },
    { accessorKey: "floor", header: t("floor") },
    { accessorKey: "capacity", header: t("capacity") },
    {
      accessorKey: "occupancy",
      header: t("occupancy"),
      cell: ({ row }) => {
        const occ = row.original.occupancy ?? row.original._count?.allocations ?? 0;
        const cap = row.original.capacity;
        const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
        return <span className={`text-xs font-semibold ${pct >= 90 ? "text-destructive" : pct >= 70 ? "text-amber-600" : "text-emerald-600"}`}>{occ}/{cap} ({pct}%)</span>;
      },
    },
    { accessorKey: "roomType", header: t("roomType"), cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{String(getValue())}</Badge> },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRoom(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteRoom(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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
        return s ? <span className="text-sm font-medium">{s.firstName} {s.lastName} <span className="text-xs text-muted-foreground">({s.rollNumber})</span></span> : "—";
      },
    },
    { accessorKey: "hostel", header: t("hostel"), cell: ({ row }) => row.original.hostel?.name || "—" },
    { accessorKey: "room", header: t("room"), cell: ({ row }) => row.original.room?.roomNumber || "—" },
    { accessorKey: "bedNumber", header: t("bedNumber"), cell: ({ getValue }) => (getValue() as string) || "—" },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => { if (!confirm(t("confirmDeleteAllocation"))) return; try { const r = await fetch(`/api/hostel-allocations/${row.original.id}`, { method: "DELETE", credentials: "include" }); const j = await r.json(); if (!r.ok) throw new Error(j.message); window.location.reload(); } catch {} }}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={BedDouble}>
        {activeTab === "hostels" && canManage && <Button onClick={openAddHostel} className="gap-2"><Plus className="h-4 w-4" />{t("addHostel")}</Button>}
        {activeTab === "rooms" && canManage && <Button onClick={openAddRoom} className="gap-2"><Plus className="h-4 w-4" />{t("addRoom")}</Button>}
        {activeTab === "allocations" && canManage && <Button onClick={openAlloc} className="gap-2"><Plus className="h-4 w-4" />{t("allocateStudent")}</Button>}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg"><Building2 className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{(pagination as any)?.totalCount ?? 0}</p><p className="text-xs text-muted-foreground">{t("totalHostels")}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg"><DoorOpen className="h-5 w-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-600">{(roomPagination as any)?.totalCount ?? 0}</p><p className="text-xs text-emerald-600">{t("totalRooms")}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-blue-500/10 rounded-lg"><Users className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold text-blue-600">{(allocPagination as any)?.totalCount ?? 0}</p><p className="text-xs text-blue-600">{t("totalAllocations")}</p></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="hostels" className="gap-2"><Building2 className="h-4 w-4" />{t("hostelsTab")}</TabsTrigger>
          <TabsTrigger value="rooms" className="gap-2"><DoorOpen className="h-4 w-4" />{t("roomsTab")}</TabsTrigger>
          <TabsTrigger value="allocations" className="gap-2"><Users className="h-4 w-4" />{t("allocationsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="hostels" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))} placeholder={t("searchHostels")} className="pl-9" />
                </div>
                <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={hostelColumns as any} data={hostels} pagination={pagination} onPageChange={setPage} onSearch={(v) => { setSearch(v); setPage(1); }} isLoading={isLoading} searchPlaceholder={t("searchHostels")} />
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={roomSearchInput} onChange={(e) => setRoomSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setRoomSearch(roomSearchInput), setRoomPage(1))} placeholder={t("searchRooms")} className="pl-9" />
                </div>
                <Button variant="outline" onClick={() => { setRoomSearch(roomSearchInput); setRoomPage(1); }}><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={roomColumns as any} data={rooms} pagination={roomPagination} onPageChange={setRoomPage} onSearch={(v) => { setRoomSearch(v); setRoomPage(1); }} isLoading={isRoomLoading} searchPlaceholder={t("searchRooms")} />
        </TabsContent>

        <TabsContent value="allocations" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={allocSearchInput} onChange={(e) => setAllocSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setAllocSearch(allocSearchInput), setAllocPage(1))} placeholder={t("searchAllocations")} className="pl-9" />
                </div>
                <Button variant="outline" onClick={() => { setAllocSearch(allocSearchInput); setAllocPage(1); }}><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={allocColumns as any} data={allocations} pagination={allocPagination} onPageChange={setAllocPage} onSearch={(v) => { setAllocSearch(v); setAllocPage(1); }} isLoading={isAllocLoading} searchPlaceholder={t("searchAllocations")} />
        </TabsContent>
      </Tabs>

      {/* Hostel Sheet */}
      <TopSheet isOpen={isHostelSheetOpen} onClose={() => setIsHostelSheetOpen(false)} title={editingHostel ? t("editHostel") : t("addHostel")} description={t("description")} maxWidth="2xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsHostelSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="hostel-form" disabled={isHostelMutating}>{t("save")}</Button></div>}>
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
      <TopSheet isOpen={isRoomSheetOpen} onClose={() => setIsRoomSheetOpen(false)} title={editingRoom ? t("editRoom") : t("addRoom")} description={t("description")} maxWidth="2xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsRoomSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="room-form" disabled={isRoomMutating}>{t("save")}</Button></div>}>
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
      <TopSheet isOpen={isAllocSheetOpen} onClose={() => setIsAllocSheetOpen(false)} title={t("allocateStudent")} description={t("description")} maxWidth="xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsAllocSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="alloc-form2">{t("save")}</Button></div>}>
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
