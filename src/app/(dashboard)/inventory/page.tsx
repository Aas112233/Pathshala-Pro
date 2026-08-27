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
  useInventoryItemsViewModel,
  useInventoryTransactionsViewModel,
} from "@/viewmodels/inventory/use-inventory-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission } from "@/lib/permissions";
import type { ColumnDef } from "@tanstack/react-table";
import { Package, Plus, Pencil, Trash2, Search, AlertTriangle, Boxes, TrendingUp, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const CATEGORIES = ["GENERAL", "STATIONERY", "LAB", "SPORTS", "UNIFORM", "BOOKS", "FURNITURE", "ELECTRONICS"];
const UNITS = ["PCS", "BOX", "KG", "LTR", "SET", "DOZEN"];

export default function InventoryPage() {
  const t = useTranslations("inventory");
  const { user } = useAuth();
  const canManage = user?.role === "SUPER_ADMIN" || (!!user && hasPermission(user.permissions, "inventory", "write"));

  const [activeTab, setActiveTab] = useState("items");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [txSearch, setTxSearch] = useState("");
  const [txSearchInput, setTxSearchInput] = useState("");
  const [txPage, setTxPage] = useState(1);

  const [isItemSheetOpen, setIsItemSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemForm, setItemForm] = useState({ name: "", code: "", category: "GENERAL", unit: "PCS", quantity: 0, minStockLevel: 10, location: "", costPrice: 0 });
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const [isTxSheetOpen, setIsTxSheetOpen] = useState(false);
  const [txForm, setTxForm] = useState({ itemId: "", transactionType: "PURCHASE" as "PURCHASE" | "ISSUE" | "ADJUSTMENT" | "RETURN", quantity: 1, unitCost: 0, reference: "", notes: "" });
  const [txErrors, setTxErrors] = useState<Record<string, string>>({});

  const { items, pagination, isLoading, createItem, updateItem, deleteItem, isMutating: isItemMutating } = useInventoryItemsViewModel(search, categoryFilter, page);
  const { transactions, pagination: txPagination, isLoading: isTxLoading, createTransaction, deleteTransaction } = useInventoryTransactionsViewModel(txSearch, txPage);

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ name: "", code: "", category: "GENERAL", unit: "PCS", quantity: 0, minStockLevel: 10, location: "", costPrice: 0 });
    setItemErrors({});
    setIsItemSheetOpen(true);
  };
  const openEditItem = (it: any) => {
    setEditingItem(it);
    setItemForm({ name: it.name, code: it.code, category: it.category, unit: it.unit, quantity: it.quantity, minStockLevel: it.minStockLevel, location: it.location || "", costPrice: it.costPrice || 0 });
    setItemErrors({});
    setIsItemSheetOpen(true);
  };
  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!itemForm.name.trim()) errs.name = "Required";
    if (!itemForm.code.trim()) errs.code = "Required";
    setItemErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const payload: any = { ...itemForm, quantity: Number(itemForm.quantity), minStockLevel: Number(itemForm.minStockLevel), costPrice: Number(itemForm.costPrice), location: itemForm.location || null };
      if (editingItem) await updateItem(editingItem.id, payload);
      else await createItem(payload);
      setIsItemSheetOpen(false);
    } catch {}
  };
  const handleDeleteItem = async (id: string) => {
    if (!confirm(t("confirmDeleteItem"))) return;
    try { await deleteItem(id); } catch {}
  };

  const openTx = (type: "PURCHASE" | "ISSUE" | "ADJUSTMENT") => {
    setTxForm({ itemId: "", transactionType: type, quantity: 1, unitCost: 0, reference: "", notes: "" });
    setTxErrors({});
    setIsTxSheetOpen(true);
  };
  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!txForm.itemId) errs.itemId = "Required";
    if (!txForm.quantity || txForm.quantity < 1) errs.quantity = "Required";
    setTxErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await createTransaction({ itemId: txForm.itemId, transactionType: txForm.transactionType, quantity: Number(txForm.quantity), unitCost: txForm.unitCost ? Number(txForm.unitCost) : null, reference: txForm.reference || null, notes: txForm.notes || null });
      setIsTxSheetOpen(false);
    } catch {}
  };

  const lowStockCount = items.filter((it: any) => it.quantity <= it.minStockLevel && it.quantity > 0).length;
  const outOfStockCount = items.filter((it: any) => it.quantity === 0).length;
  const totalValue = items.reduce((s: number, it: any) => s + it.quantity * (it.costPrice || 0), 0);

  const itemColumns: ColumnDef<any>[] = [
    {
      accessorKey: "name",
      header: t("itemName"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Package className="h-4 w-4 text-primary" /></div>
          <div>
            <p className="font-medium text-sm">{row.original.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{row.original.code} · {row.original.category}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: "quantity", header: t("quantity"), cell: ({ row }) => {
      const it = row.original;
      const low = it.quantity <= it.minStockLevel;
      const out = it.quantity === 0;
      return <span className={`text-sm font-semibold ${out ? "text-destructive" : low ? "text-amber-600" : ""}`}>{it.quantity} {it.unit}</span>;
    }},
    { accessorKey: "minStockLevel", header: t("minStock") },
    { accessorKey: "location", header: t("location"), cell: ({ getValue }) => (getValue() as string) || "—" },
    { accessorKey: "costPrice", header: t("costPrice"), cell: ({ getValue }) => `৳${getValue() as number}` },
    {
      id: "status",
      header: t("isActive"),
      cell: ({ row }) => {
        const it = row.original;
        if (it.quantity === 0) return <Badge variant="destructive" className="text-xs">{t("outOfStock")}</Badge>;
        if (it.quantity <= it.minStockLevel) return <Badge className="bg-amber-500 text-white text-xs">{t("lowStock")}</Badge>;
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">{t("inStock")}</Badge>;
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditItem(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteItem(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  const txColumns: ColumnDef<any>[] = [
    { accessorKey: "item", header: t("itemName"), cell: ({ row }) => row.original.item?.name || "—" },
    { accessorKey: "transactionType", header: t("transactionType"), cell: ({ getValue }) => {
      const v = String(getValue());
      const color = v === "PURCHASE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : v === "ISSUE" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200";
      return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${color}`}>{v}</span>;
    }},
    { accessorKey: "quantity", header: t("quantity"), cell: ({ row }) => {
      const sign = row.original.transactionType === "ISSUE" ? "-" : "+";
      return <span className={`text-sm font-mono font-semibold ${sign === "-" ? "text-destructive" : "text-emerald-600"}`}>{sign}{row.original.quantity}</span>;
    }},
    { accessorKey: "reference", header: t("reference"), cell: ({ getValue }) => (getValue() as string) || "—" },
    { accessorKey: "createdAt", header: t("date"), cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => { if (!confirm(t("confirmDeleteTransaction"))) return; try { await deleteTransaction(row.original.id); } catch {} }}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={Package}>
        {activeTab === "items" && canManage && <Button onClick={openAddItem} className="gap-2"><Plus className="h-4 w-4" />{t("addItem")}</Button>}
        {activeTab === "transactions" && canManage && <Button onClick={() => openTx("PURCHASE")} className="gap-2"><Plus className="h-4 w-4" />{t("stockIn")}</Button>}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg"><Boxes className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{(pagination as any)?.totalCount ?? items.length}</p><p className="text-xs text-muted-foreground">{t("totalItems")}</p></div></CardContent></Card>
        <Card className={lowStockCount > 0 ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : ""}><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-amber-500/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold text-amber-600">{lowStockCount}</p><p className="text-xs text-amber-600">{t("lowStockItems")}</p></div></CardContent></Card>
        <Card className={outOfStockCount > 0 ? "border-rose-200 bg-rose-50/50 dark:bg-rose-950/20" : ""}><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-rose-500/10 rounded-lg"><TrendingUp className="h-5 w-5 text-rose-600" /></div><div><p className="text-2xl font-bold text-rose-600">{outOfStockCount}</p><p className="text-xs text-rose-600">{t("outOfStock")}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg"><Package className="h-5 w-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-600">৳{totalValue.toFixed(0)}</p><p className="text-xs text-emerald-600">{t("totalValue")}</p></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="items" className="gap-2"><Package className="h-4 w-4" />{t("itemsTab")}</TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2"><ArrowDownToLine className="h-4 w-4" />{t("transactionsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))} placeholder={t("searchItems")} className="pl-9" />
                </div>
                <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-4 w-4" /></Button>
                <Button variant="outline" onClick={() => openTx("ISSUE")} className="gap-2"><ArrowUpFromLine className="h-4 w-4" />{t("stockOut")}</Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={itemColumns as any} data={items} pagination={pagination} onPageChange={setPage} onSearch={(v) => { setSearch(v); setPage(1); }} isLoading={isLoading} searchPlaceholder={t("searchItems")} />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={txSearchInput} onChange={(e) => setTxSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setTxSearch(txSearchInput), setTxPage(1))} placeholder={t("searchTransactions")} className="pl-9" />
                </div>
                <Button variant="outline" onClick={() => { setTxSearch(txSearchInput); setTxPage(1); }}><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={txColumns as any} data={transactions} pagination={txPagination} onPageChange={setTxPage} onSearch={(v) => { setTxSearch(v); setTxPage(1); }} isLoading={isTxLoading} searchPlaceholder={t("searchTransactions")} />
        </TabsContent>
      </Tabs>

      {/* Item Sheet */}
      <TopSheet isOpen={isItemSheetOpen} onClose={() => setIsItemSheetOpen(false)} title={editingItem ? t("editItem") : t("addItem")} description={t("description")} maxWidth="2xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsItemSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="item-form" disabled={isItemMutating}>{t("save")}</Button></div>}>
        <form id="item-form" onSubmit={handleItemSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("itemName")} required error={itemErrors.name}><Input value={itemForm.name} onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))} placeholder={t("itemName")} /></ERPFormField>
              <ERPFormField label={t("code")} required error={itemErrors.code}><Input value={itemForm.code} onChange={(e) => setItemForm((p) => ({ ...p, code: e.target.value }))} placeholder={t("code")} /></ERPFormField>
              <ERPFormField label={t("category")}><AppDropdown value={itemForm.category} onChange={(v) => setItemForm((p) => ({ ...p, category: v }))} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></ERPFormField>
              <ERPFormField label={t("unit")}><AppDropdown value={itemForm.unit} onChange={(v) => setItemForm((p) => ({ ...p, unit: v }))} options={UNITS.map((u) => ({ value: u, label: u }))} /></ERPFormField>
              <ERPFormField label={t("quantity")}><Input type="number" min={0} value={itemForm.quantity} onChange={(e) => setItemForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 0 }))} /></ERPFormField>
              <ERPFormField label={t("minStock")}><Input type="number" min={0} value={itemForm.minStockLevel} onChange={(e) => setItemForm((p) => ({ ...p, minStockLevel: parseInt(e.target.value) || 0 }))} /></ERPFormField>
              <ERPFormField label={t("location")}><Input value={itemForm.location} onChange={(e) => setItemForm((p) => ({ ...p, location: e.target.value }))} placeholder={t("location")} /></ERPFormField>
              <ERPFormField label={t("costPrice")}><Input type="number" min={0} step={0.01} value={itemForm.costPrice} onChange={(e) => setItemForm((p) => ({ ...p, costPrice: parseFloat(e.target.value) || 0 }))} /></ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Transaction Sheet */}
      <TopSheet isOpen={isTxSheetOpen} onClose={() => setIsTxSheetOpen(false)} title={txForm.transactionType === "ISSUE" ? t("stockOut") : t("stockIn")} description={t("description")} maxWidth="xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsTxSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="tx-form">{t("save")}</Button></div>}>
        <form id="tx-form" onSubmit={handleTxSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("itemName")} required error={txErrors.itemId}>
                <AppDropdown value={txForm.itemId} onChange={(v) => setTxForm((p) => ({ ...p, itemId: v }))} options={items.map((it: any) => ({ value: it.id, label: `${it.name} (${it.quantity} ${it.unit})` }))} placeholder={t("selectItem")} searchable />
              </ERPFormField>
              <ERPFormField label={t("transactionType")}>
                <AppDropdown value={txForm.transactionType} onChange={(v) => setTxForm((p) => ({ ...p, transactionType: v as any }))} options={[{ value: "PURCHASE", label: t("purchase") }, { value: "ISSUE", label: t("issue") }, { value: "ADJUSTMENT", label: t("adjustment") }, { value: "RETURN", label: t("return") }]} />
              </ERPFormField>
              <ERPFormField label={t("quantityLabel")} required error={txErrors.quantity}><Input type="number" min={1} value={txForm.quantity} onChange={(e) => setTxForm((p) => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} /></ERPFormField>
              <ERPFormField label={t("unitCost")}><Input type="number" min={0} step={0.01} value={txForm.unitCost} onChange={(e) => setTxForm((p) => ({ ...p, unitCost: parseFloat(e.target.value) || 0 }))} /></ERPFormField>
              <ERPFormField label={t("reference")}><Input value={txForm.reference} onChange={(e) => setTxForm((p) => ({ ...p, reference: e.target.value }))} placeholder={t("reference")} /></ERPFormField>
              <div className="col-span-2">
                <ERPFormField label={t("notes")}><textarea value={txForm.notes} onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))} placeholder={t("notes")} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></ERPFormField>
              </div>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
