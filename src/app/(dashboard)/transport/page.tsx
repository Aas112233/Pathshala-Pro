"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
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
  useVehiclesViewModel,
  useRoutesViewModel,
  useAllocationsViewModel,
} from "@/viewmodels/transport/use-transport-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { usePDFExport, type TransportManifestPDFData, type ManifestStudent } from "@/hooks/use-pdf-export";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bus,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Users,
  Search,
  Route,
  UserPlus,
  Printer,
  ArrowRight,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

export default function TransportPage() {
  const t = useTranslations("transport");
  const tCommon = useTranslations("common");
  const common = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "transport", "read");
  const canWrite = hasPermission(perms, "transport", "write");
  const canManage = hasPermission(perms, "transport", "manage");
  const { exportTransportManifestPDF } = usePDFExport();

  const [activeTab, setActiveTab] = useState("vehicles");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [routeSearch, setRouteSearch] = useState("");
  const [routeSearchInput, setRouteSearchInput] = useState("");
  const [routePage, setRoutePage] = useState(1);
  const [allocSearch, setAllocSearch] = useState("");
  const [allocSearchInput, setAllocSearchInput] = useState("");
  const [allocPage, setAllocPage] = useState(1);

  // Vehicle form
  const [isVehicleSheetOpen, setIsVehicleSheetOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNo: "",
    type: "BUS",
    capacity: 40,
    driverName: "",
    driverPhone: "",
  });
  const [vehicleErrors, setVehicleErrors] = useState<Record<string, string>>({});

  // Route form
  const [isRouteSheetOpen, setIsRouteSheetOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [routeForm, setRouteForm] = useState({
    name: "",
    stopsText: "",
    vehicleId: "",
    monthlyFee: 0,
  });
  const [routeErrors, setRouteErrors] = useState<Record<string, string>>({});

  // Allocation form
  const [isAllocSheetOpen, setIsAllocSheetOpen] = useState(false);
  const [allocForm, setAllocForm] = useState({
    studentProfileId: "",
    routeId: "",
    stopName: "",
  });
  const [allocErrors, setAllocErrors] = useState<Record<string, string>>({});
  const { run: runTransportSubmit, isPending: isGuardedTransport } = useSubmitGuard();

  const {
    vehicles,
    pagination,
    isLoading,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    isMutating: isVehicleMutating,
  } = useVehiclesViewModel(search, page);

  const {
    routes,
    pagination: routePagination,
    isLoading: isRouteLoading,
    createRoute,
    updateRoute,
    deleteRoute,
    isMutating: isRouteMutating,
  } = useRoutesViewModel(routeSearch, routePage);

  const {
    allocations,
    pagination: allocPagination,
    isLoading: isAllocLoading,
    createAllocation,
  } = useAllocationsViewModel(allocSearch, "", allocPage);

  const { data: studentsData } = useQuery({
    queryKey: ["students-transport"],
    queryFn: async () => {
      const r = await fetch("/api/students?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const students = (studentsData as any)?.data ?? [];

  // Vehicle handlers
  const openAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm({
      vehicleNo: "",
      type: "BUS",
      capacity: 40,
      driverName: "",
      driverPhone: "",
    });
    setVehicleErrors({});
    setIsVehicleSheetOpen(true);
  };

  const openEditVehicle = (v: any) => {
    setEditingVehicle(v);
    setVehicleForm({
      vehicleNo: v.vehicleNo,
      type: v.type,
      capacity: v.capacity,
      driverName: v.driverName || "",
      driverPhone: v.driverPhone || "",
    });
    setVehicleErrors({});
    setIsVehicleSheetOpen(true);
  };

  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!vehicleForm.vehicleNo.trim()) errs.vehicleNo = tCommon("required");
    if (!vehicleForm.capacity || vehicleForm.capacity < 1) errs.capacity = tCommon("required");
    setVehicleErrors(errs);
    if (Object.keys(errs).length) { toast.error(tCommon("pleaseFillRequired")); return; }
    void runTransportSubmit(async () => {
      try {
        const payload: any = {
          ...vehicleForm,
          capacity: Number(vehicleForm.capacity),
          driverName: vehicleForm.driverName || null,
          driverPhone: vehicleForm.driverPhone || null,
        };
        if (editingVehicle) await updateVehicle(editingVehicle.id, payload);
        else await createVehicle(payload);
        setIsVehicleSheetOpen(false);
      } catch {}
    });
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm(t("confirmDeleteVehicle"))) return;
    try {
      await deleteVehicle(id);
    } catch {}
  };

  // Route handlers
  const openAddRoute = () => {
    setEditingRoute(null);
    setRouteForm({ name: "", stopsText: "", vehicleId: "", monthlyFee: 0 });
    setRouteErrors({});
    setIsRouteSheetOpen(true);
  };

  const openEditRoute = (r: any) => {
    setEditingRoute(r);
    setRouteForm({
      name: r.name,
      stopsText: (r.stops || []).join(", "),
      vehicleId: r.vehicleId || "",
      monthlyFee: r.monthlyFee || 0,
    });
    setRouteErrors({});
    setIsRouteSheetOpen(true);
  };

  const handleRouteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!routeForm.name.trim()) errs.name = tCommon("required");
    const stops = routeForm.stopsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (stops.length === 0) errs.stopsText = tCommon("required");
    setRouteErrors(errs);
    if (Object.keys(errs).length) { toast.error(tCommon("pleaseFillRequired")); return; }
    void runTransportSubmit(async () => {
      try {
        const payload: any = {
          name: routeForm.name.trim(),
          stops,
          vehicleId: routeForm.vehicleId || null,
          monthlyFee: Number(routeForm.monthlyFee) || 0,
        };
        if (editingRoute) await updateRoute(editingRoute.id, payload);
        else await createRoute(payload);
        setIsRouteSheetOpen(false);
      } catch {}
    });
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm(t("confirmDeleteRoute"))) return;
    try {
      await deleteRoute(id);
    } catch {}
  };

  // Passenger Manifest Print Handler
  const handlePrintManifest = (route: any) => {
    const routeAllocs = (allocations || []).filter(
      (a: any) => a.routeId === route.id || a.route?.id === route.id
    );

    const manifestStudents: ManifestStudent[] = routeAllocs.map((a: any) => ({
      rollNumber: a.studentProfile?.rollNumber || "—",
      studentName:
        `${a.studentProfile?.firstName || ""} ${a.studentProfile?.lastName || ""}`.trim() ||
        a.borrowerName ||
        "Student",
      className: a.studentProfile?.class?.name || "General",
      sectionName: a.studentProfile?.section?.name,
      stopName: a.stopName || "Main Gate",
      guardianName: a.studentProfile?.guardianName,
      guardianPhone: a.studentProfile?.guardianContact,
    }));

    const manifestData: TransportManifestPDFData = {
      schoolName: "Pathshala Pro Academy",
      routeName: route.name,
      vehicleNo: route.vehicle?.vehicleNo || "Unassigned",
      vehicleType: route.vehicle?.type || "BUS",
      driverName: route.vehicle?.driverName,
      driverPhone: route.vehicle?.driverPhone,
      totalAllocated: routeAllocs.length,
      capacity: route.vehicle?.capacity || 40,
      stops: route.stops || [],
      students: manifestStudents,
      generatedDate: new Date().toLocaleDateString(),
    };

    exportTransportManifestPDF(manifestData);
    toast.success(`Generated Passenger Manifest for ${route.name}`);
  };

  // Allocation handlers
  const openAlloc = () => {
    setAllocForm({ studentProfileId: "", routeId: "", stopName: "" });
    setAllocErrors({});
    setIsAllocSheetOpen(true);
  };

  const handleAllocSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!allocForm.studentProfileId) errs.studentProfileId = tCommon("required");
    if (!allocForm.routeId) errs.routeId = tCommon("required");
    if (!allocForm.stopName) errs.stopName = tCommon("required");
    setAllocErrors(errs);
    if (Object.keys(errs).length) { toast.error(tCommon("pleaseFillRequired")); return; }
    void runTransportSubmit(async () => {
      try {
        await createAllocation({
          studentProfileId: allocForm.studentProfileId,
          routeId: allocForm.routeId,
          stopName: allocForm.stopName,
        });
        setIsAllocSheetOpen(false);
      } catch {}
    });
  };

  const vehicleColumns: ColumnDef<any>[] = [
    {
      accessorKey: "vehicleNo",
      header: t("vehicleNo"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bus className="h-4 w-4" />
          </div>
          <span className="font-mono text-sm font-bold text-foreground">
            {row.original.vehicleNo}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: t("type"),
      cell: ({ getValue }) => (
        <Badge variant="outline" className="text-xs font-semibold">
          {String(getValue())}
        </Badge>
      ),
    },
    {
      accessorKey: "capacity",
      header: t("capacity"),
      cell: ({ row }) => (
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold">{row.original.capacity} Seats</span>
        </div>
      ),
    },
    {
      accessorKey: "driverName",
      header: t("driverName"),
      cell: ({ row }) => (
        <div>
          <p className="text-xs font-semibold text-foreground">
            {row.original.driverName || "Unassigned"}
          </p>
          {row.original.driverPhone && (
            <p className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> {row.original.driverPhone}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openEditVehicle(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => handleDeleteVehicle(row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const routeColumns: ColumnDef<any>[] = [
    {
      accessorKey: "name",
      header: t("routeName"),
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-sm text-foreground">{row.original.name}</span>
          <p className="text-[11px] text-muted-foreground">
            {(row.original.stops || []).length} Scheduled Stops
          </p>
        </div>
      ),
    },
    {
      accessorKey: "stops",
      header: t("stops"),
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1 max-w-[340px]">
          {(row.original.stops || []).map((s: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 text-[11px]">
              <Badge variant="secondary" className="text-[10px] font-medium gap-0.5">
                <MapPin className="h-2.5 w-2.5 text-primary" />
                {s}
              </Badge>
              {i < (row.original.stops || []).length - 1 && (
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
              )}
            </span>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "vehicle",
      header: t("assignedVehicle"),
      cell: ({ row }) =>
        row.original.vehicle?.vehicleNo ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs font-mono font-bold">
              {row.original.vehicle.vehicleNo}
            </Badge>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      accessorKey: "monthlyFee",
      header: t("monthlyFee"),
      cell: ({ getValue }) => (
        <span className="font-mono font-bold text-xs">
          ${(getValue() as number) || 0}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:bg-primary/10"
            onClick={() => handlePrintManifest(row.original)}
            title="Download Driver Passenger Manifest (PDF)"
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openEditRoute(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => handleDeleteRoute(row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
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
            <span className="text-sm font-bold text-foreground">
              {s.firstName} {s.lastName}
            </span>
            <p className="text-[11px] font-mono text-muted-foreground">
              Roll #{s.rollNumber || "—"} • {s.class?.name || "Class"}
            </p>
          </div>
        ) : (
          <span className="text-sm">{row.original.borrowerName || "—"}</span>
        );
      },
    },
    {
      accessorKey: "route",
      header: t("allocatedRoute"),
      cell: ({ row }) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
          {row.original.route?.name || "—"}
        </span>
      ),
    },
    {
      accessorKey: "stopName",
      header: t("stopName"),
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          <MapPin className="h-3 w-3" />
          {String(getValue())}
        </span>
      ),
    },
    {
      accessorKey: "monthlyFee",
      header: t("monthlyFee"),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-bold">${(getValue() as number) || 0}</span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        canManage ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (!confirm(t("confirmDeleteAllocation"))) return;
              try {
                const r = await fetch(`/api/transport/allocations/${row.original.id}`, {
                  method: "DELETE",
                  credentials: "include",
                });
                const j = await r.json();
                if (!r.ok) throw new Error(j.message);
                window.location.reload();
              } catch {}
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null
      ),
    },
  ];

  const totalVehicles = (pagination as any)?.totalCount ?? vehicles.length;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={Bus}>
        {activeTab === "vehicles" && canWrite && (
          <Button onClick={openAddVehicle} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("addVehicle")}
          </Button>
        )}
        {activeTab === "routes" && canWrite && (
          <Button onClick={openAddRoute} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("addRoute")}
          </Button>
        )}
        {activeTab === "allocations" && canWrite && (
          <Button onClick={openAlloc} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t("allocateStudent")}
          </Button>
        )}
      </PageHeader>

      {!canRead && !isAuthLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{common("noPermission")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-xs border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-lg">
              <Bus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalVehicles}</p>
              <p className="text-xs text-muted-foreground font-medium">{t("totalVehicles")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg">
              <Route className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">
                {(routePagination as any)?.totalCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{t("totalRoutes")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {(allocPagination as any)?.totalCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                {t("totalAllocations")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="vehicles" className="gap-2">
            <Bus className="h-4 w-4" />
            {t("vehiclesTab")}
          </TabsTrigger>
          <TabsTrigger value="routes" className="gap-2">
            <Route className="h-4 w-4" />
            {t("routesTab")}
          </TabsTrigger>
          <TabsTrigger value="allocations" className="gap-2">
            <Users className="h-4 w-4" />
            {t("allocationsTab")}
          </TabsTrigger>
        </TabsList>

        {/* Vehicles Tab */}
        <TabsContent value="vehicles" className="space-y-4 mt-4">
          <Card className="shadow-xs border-border">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (setSearch(searchInput), setPage(1))
                    }
                    placeholder={t("searchVehicles")}
                    className="pl-9 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch(searchInput);
                    setPage(1);
                  }}
                  className="h-9 text-xs"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <DataTable
            columns={vehicleColumns as any}
            data={vehicles}
            pagination={pagination}
            onPageChange={setPage}
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            isLoading={isLoading}
            searchPlaceholder={t("searchVehicles")}
          />
        </TabsContent>

        {/* Routes Tab */}
        <TabsContent value="routes" className="space-y-4 mt-4">
          <Card className="shadow-xs border-border">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={routeSearchInput}
                    onChange={(e) => setRouteSearchInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (setRouteSearch(routeSearchInput), setRoutePage(1))
                    }
                    placeholder={t("searchRoutes")}
                    className="pl-9 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRouteSearch(routeSearchInput);
                    setRoutePage(1);
                  }}
                  className="h-9 text-xs"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <DataTable
            columns={routeColumns as any}
            data={routes}
            pagination={routePagination}
            onPageChange={setRoutePage}
            onSearch={(v) => {
              setRouteSearch(v);
              setRoutePage(1);
            }}
            isLoading={isRouteLoading}
            searchPlaceholder={t("searchRoutes")}
          />
        </TabsContent>

        {/* Allocations Tab */}
        <TabsContent value="allocations" className="space-y-4 mt-4">
          <Card className="shadow-xs border-border">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={allocSearchInput}
                    onChange={(e) => setAllocSearchInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (setAllocSearch(allocSearchInput), setAllocPage(1))
                    }
                    placeholder={t("searchAllocations")}
                    className="pl-9 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAllocSearch(allocSearchInput);
                    setAllocPage(1);
                  }}
                  className="h-9 text-xs"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <DataTable
            columns={allocColumns as any}
            data={allocations}
            pagination={allocPagination}
            onPageChange={setAllocPage}
            onSearch={(v) => {
              setAllocSearch(v);
              setAllocPage(1);
            }}
            isLoading={isAllocLoading}
            searchPlaceholder={t("searchAllocations")}
          />
        </TabsContent>
      </Tabs>
        </>
      )}

      {/* Vehicle Sheet */}
      <TopSheet
        isOpen={isVehicleSheetOpen}
        onClose={() => setIsVehicleSheetOpen(false)}
        title={editingVehicle ? t("editVehicle") : t("addVehicle")}
        description={t("description")}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsVehicleSheetOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form="vehicle-form"
              disabled={isVehicleMutating || isGuardedTransport}
              aria-busy={isVehicleMutating || isGuardedTransport || undefined}
            >
              {isVehicleMutating || isGuardedTransport ? "Saving..." : t("save")}
            </Button>
          </div>
        }
      >
        <form id="vehicle-form" onSubmit={handleVehicleSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField
                label={t("vehicleNo")}
                required
                error={vehicleErrors.vehicleNo}
              >
                <Input
                  value={vehicleForm.vehicleNo}
                  onChange={(e) =>
                    setVehicleForm((p) => ({ ...p, vehicleNo: e.target.value }))
                  }
                  placeholder="e.g. BUS-402"
                />
              </ERPFormField>
              <ERPFormField label={t("type")}>
                <AppDropdown
                  value={vehicleForm.type}
                  onChange={(v) => setVehicleForm((p) => ({ ...p, type: v }))}
                  options={[
                    { value: "BUS", label: t("bus") },
                    { value: "VAN", label: t("van") },
                    { value: "MINI_BUS", label: t("miniBus") },
                    { value: "OTHER", label: t("other") },
                  ]}
                />
              </ERPFormField>
              <ERPFormField
                label={t("capacity")}
                required
                error={vehicleErrors.capacity}
              >
                <Input
                  type="number"
                  min={1}
                  value={vehicleForm.capacity}
                  onChange={(e) =>
                    setVehicleForm((p) => ({
                      ...p,
                      capacity: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </ERPFormField>
              <ERPFormField label={t("driverName")}>
                <Input
                  value={vehicleForm.driverName}
                  onChange={(e) =>
                    setVehicleForm((p) => ({ ...p, driverName: e.target.value }))
                  }
                  placeholder="Driver Full Name"
                />
              </ERPFormField>
              <ERPFormField label={t("driverPhone")}>
                <Input
                  value={vehicleForm.driverPhone}
                  onChange={(e) =>
                    setVehicleForm((p) => ({ ...p, driverPhone: e.target.value }))
                  }
                  placeholder="+880 1700-000000"
                />
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Route Sheet */}
      <TopSheet
        isOpen={isRouteSheetOpen}
        onClose={() => setIsRouteSheetOpen(false)}
        title={editingRoute ? t("editRoute") : t("addRoute")}
        description={t("description")}
        maxWidth="2xl"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsRouteSheetOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form="route-form"
              disabled={isRouteMutating || isGuardedTransport}
              aria-busy={isRouteMutating || isGuardedTransport || undefined}
            >
              {isRouteMutating || isGuardedTransport ? "Saving..." : t("save")}
            </Button>
          </div>
        }
      >
        <form id="route-form" onSubmit={handleRouteSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("routeName")} required error={routeErrors.name}>
                <Input
                  value={routeForm.name}
                  onChange={(e) => setRouteForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Route A (Dhanmondi to Campus)"
                />
              </ERPFormField>
              <ERPFormField label={t("assignedVehicle")}>
                <AppDropdown
                  value={routeForm.vehicleId}
                  onChange={(v) =>
                    setRouteForm((p) => ({ ...p, vehicleId: v }))
                  }
                  options={[
                    { value: "", label: "—" },
                    ...vehicles.map((v: any) => ({
                      value: v.id,
                      label: `${v.vehicleNo} (${v.type})`,
                    })),
                  ]}
                  placeholder={t("selectVehicle")}
                />
              </ERPFormField>
              <div className="col-span-2">
                <ERPFormField
                  label={t("stops")}
                  required
                  error={routeErrors.stopsText}
                >
                  <Input
                    value={routeForm.stopsText}
                    onChange={(e) =>
                      setRouteForm((p) => ({ ...p, stopsText: e.target.value }))
                    }
                    placeholder="Mirpur-10, Kazipara, Shewrapara, Agargaon, Campus"
                  />
                </ERPFormField>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Enter comma-separated stop names in pickup sequence order.
                </p>
              </div>
              <ERPFormField label={t("monthlyFee")}>
                <Input
                  type="number"
                  min={0}
                  value={routeForm.monthlyFee}
                  onChange={(e) =>
                    setRouteForm((p) => ({
                      ...p,
                      monthlyFee: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </ERPFormField>
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
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsAllocSheetOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form="alloc-form"
              disabled={isGuardedTransport}
              aria-busy={isGuardedTransport || undefined}
            >
              {isGuardedTransport ? "Saving..." : t("save")}
            </Button>
          </div>
        }
      >
        <form id="alloc-form" onSubmit={handleAllocSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField
                label={t("student")}
                required
                error={allocErrors.studentProfileId}
              >
                <AppDropdown
                  value={allocForm.studentProfileId}
                  onChange={(v) =>
                    setAllocForm((p) => ({ ...p, studentProfileId: v }))
                  }
                  options={students.map((s: any) => ({
                    value: s.id,
                    label: `${s.firstName} ${s.lastName} (${s.rollNumber})`,
                  }))}
                  placeholder={t("selectStudent")}
                  searchable
                />
              </ERPFormField>
              <ERPFormField
                label={t("allocatedRoute")}
                required
                error={allocErrors.routeId}
              >
                <AppDropdown
                  value={allocForm.routeId}
                  onChange={(v) =>
                    setAllocForm((p) => ({ ...p, routeId: v, stopName: "" }))
                  }
                  options={routes.map((r: any) => ({
                    value: r.id,
                    label: r.name,
                  }))}
                  placeholder={t("selectRoute")}
                />
              </ERPFormField>
              <div className="col-span-2">
                <ERPFormField
                  label={t("stopName")}
                  required
                  error={allocErrors.stopName}
                >
                  <AppDropdown
                    value={allocForm.stopName}
                    onChange={(v) =>
                      setAllocForm((p) => ({ ...p, stopName: v }))
                    }
                    options={(
                      routes.find((r: any) => r.id === allocForm.routeId)?.stops || []
                    ).map((s: string) => ({ value: s, label: s }))}
                    placeholder={t("selectStop")}
                    disabled={!allocForm.routeId}
                  />
                </ERPFormField>
              </div>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
