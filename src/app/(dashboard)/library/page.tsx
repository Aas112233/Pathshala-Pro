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
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBooksViewModel, useBookIssuesViewModel } from "@/viewmodels/library/use-library-view-model";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission } from "@/lib/permissions";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Library,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Search,
  UserCheck,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

const CATEGORIES = ["GENERAL", "TEXTBOOK", "REFERENCE", "STORY", "SCIENCE", "HISTORY", "COMPUTER"];

export default function LibraryPage() {
  const t = useTranslations("library");
  const { user } = useAuth();
  const canManage = user?.role === "SUPER_ADMIN" || (!!user && hasPermission(user.permissions, "library", "write"));

  const [activeTab, setActiveTab] = useState("books");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [issueSearch, setIssueSearch] = useState("");
  const [issueSearchInput, setIssueSearchInput] = useState("");
  const [issueStatus, setIssueStatus] = useState("");
  const [issuePage, setIssuePage] = useState(1);

  // Book form
  const [isBookSheetOpen, setIsBookSheetOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [bookForm, setBookForm] = useState({ title: "", author: "", isbn: "", publisher: "", category: "GENERAL", accessionNo: "", copies: 1, shelfLocation: "" });
  const [bookErrors, setBookErrors] = useState<Record<string, string>>({});

  // Issue form
  const [isIssueSheetOpen, setIsIssueSheetOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ bookId: "", borrowerType: "STUDENT" as "STUDENT" | "STAFF", borrowerName: "", borrowerIdNo: "", dueDate: "" });
  const [issueErrors, setIssueErrors] = useState<Record<string, string>>({});

  const { books, pagination, isLoading, createBook, updateBook, deleteBook, isMutating: isBookMutating } = useBooksViewModel(search, categoryFilter, page);
  const { issues, pagination: issuePagination, isLoading: isIssueLoading, issueBook, returnBook, isMutating: isIssueMutating } = useBookIssuesViewModel(issueSearch, issueStatus, issuePage);

  const openAddBook = () => {
    setEditingBook(null);
    setBookForm({ title: "", author: "", isbn: "", publisher: "", category: "GENERAL", accessionNo: "", copies: 1, shelfLocation: "" });
    setBookErrors({});
    setIsBookSheetOpen(true);
  };
  const openEditBook = (b: any) => {
    setEditingBook(b);
    setBookForm({ title: b.title, author: b.author, isbn: b.isbn || "", publisher: b.publisher || "", category: b.category, accessionNo: b.accessionNo, copies: b.copies, shelfLocation: b.shelfLocation || "" });
    setBookErrors({});
    setIsBookSheetOpen(true);
  };
  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!bookForm.title.trim()) errs.title = "Required";
    if (!bookForm.author.trim()) errs.author = "Required";
    if (!bookForm.accessionNo.trim()) errs.accessionNo = "Required";
    setBookErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const payload: any = { ...bookForm, copies: Number(bookForm.copies), isbn: bookForm.isbn || null, publisher: bookForm.publisher || null, shelfLocation: bookForm.shelfLocation || null };
      if (editingBook) await updateBook(editingBook.id, payload);
      else await createBook(payload);
      setIsBookSheetOpen(false);
    } catch {}
  };
  const handleDeleteBook = async (id: string) => {
    if (!confirm(t("confirmDeleteBook"))) return;
    try { await deleteBook(id); } catch {}
  };

  const openIssue = () => {
    setIssueForm({ bookId: "", borrowerType: "STUDENT", borrowerName: "", borrowerIdNo: "", dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) });
    setIssueErrors({});
    setIsIssueSheetOpen(true);
  };
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!issueForm.bookId) errs.bookId = "Required";
    if (!issueForm.borrowerName.trim()) errs.borrowerName = "Required";
    if (!issueForm.borrowerIdNo.trim()) errs.borrowerIdNo = "Required";
    if (!issueForm.dueDate) errs.dueDate = "Required";
    setIssueErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await issueBook({ ...issueForm, dueDate: new Date(issueForm.dueDate).toISOString() });
      setIsIssueSheetOpen(false);
    } catch {}
  };
  const handleReturn = async (id: string) => {
    try { await returnBook(id); } catch {}
  };

  const totalBooks = (pagination as any)?.totalCount ?? books.length;
  const overdueCount = issues.filter((i: any) => i.computedStatus === "OVERDUE" || (i.status === "ISSUED" && new Date(i.dueDate) < new Date())).length;

  const bookColumns: ColumnDef<any>[] = [
    {
      accessorKey: "title",
      header: t("titleLabel"),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><BookOpen className="h-4 w-4 text-primary" /></div>
          <div>
            <p className="font-medium text-sm">{row.original.title}</p>
            <p className="text-xs text-muted-foreground">{row.original.author} · {row.original.accessionNo}</p>
          </div>
        </div>
      ),
    },
    { accessorKey: "category", header: t("category"), cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{String(getValue())}</Badge> },
    {
      accessorKey: "copies",
      header: t("copies"),
      cell: ({ row }) => (
        <span className="text-sm">
          <span className={row.original.availableCopies === 0 ? "text-destructive font-bold" : "font-semibold"}>{row.original.availableCopies}</span>
          <span className="text-muted-foreground"> / {row.original.copies}</span>
        </span>
      ),
    },
    { accessorKey: "shelfLocation", header: t("shelfLocation"), cell: ({ getValue }) => (getValue() as string) || "—" },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBook(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteBook(row.original.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      ),
    },
  ];

  const issueColumns: ColumnDef<any>[] = [
    {
      accessorKey: "book",
      header: t("titleLabel"),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.book?.title || "—"}</span>,
    },
    {
      accessorKey: "borrowerName",
      header: t("borrower"),
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.borrowerName}</p>
          <p className="text-xs text-muted-foreground">{row.original.borrowerIdNo} · {row.original.borrowerType}</p>
        </div>
      ),
    },
    {
      accessorKey: "dueDate",
      header: t("dueDate"),
      cell: ({ row }) => {
        const d = new Date(row.original.dueDate);
        const overdue = row.original.computedStatus === "OVERDUE";
        return <span className={`text-xs ${overdue ? "text-destructive font-bold" : ""}`}>{d.toLocaleDateString()}</span>;
      },
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => {
        const s = row.original.computedStatus || row.original.status;
        const color = s === "ISSUED" ? "bg-blue-50 text-blue-700 border-blue-200" : s === "OVERDUE" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";
        return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold border ${color}`}>{s}</span>;
      },
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) =>
        row.original.status === "ISSUED" ? (
          <Button variant="outline" size="sm" onClick={() => handleReturn(row.original.id)} className="h-7 text-xs gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> {t("returnBook")}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{row.original.fineAmount ? `৳${row.original.fineAmount}` : "—"}</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={Library}>
        <div className="flex items-center gap-2">
          {activeTab === "books" && canManage && (
            <Button onClick={openAddBook} className="gap-2"><Plus className="h-4 w-4" />{t("addBook")}</Button>
          )}
          {activeTab === "issues" && canManage && (
            <Button onClick={openIssue} className="gap-2"><Plus className="h-4 w-4" />{t("issueBook")}</Button>
          )}
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-lg"><BookOpen className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{totalBooks}</p><p className="text-xs text-muted-foreground">{t("totalBooks")}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-emerald-500/10 rounded-lg"><CheckCircle className="h-5 w-5 text-emerald-600" /></div><div><p className="text-2xl font-bold text-emerald-600">{books.reduce((s: number, b: any) => s + (b.availableCopies || 0), 0)}</p><p className="text-xs text-emerald-600">{t("availableBooks")}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-blue-500/10 rounded-lg"><Clock className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold text-blue-600">{issues.filter((i: any) => i.status === "ISSUED").length}</p><p className="text-xs text-blue-600">{t("issuedBooks")}</p></div></CardContent></Card>
        <Card className={overdueCount > 0 ? "border-rose-200 bg-rose-50/50 dark:bg-rose-950/20" : ""}><CardContent className="pt-6 flex items-center gap-3"><div className="p-2 bg-rose-500/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-rose-600" /></div><div><p className="text-2xl font-bold text-rose-600">{overdueCount}</p><p className="text-xs text-rose-600">{t("overdueBooks")}</p></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="books" className="gap-2"><BookOpen className="h-4 w-4" />{t("booksTab")}</TabsTrigger>
          <TabsTrigger value="issues" className="gap-2"><UserCheck className="h-4 w-4" />{t("issuesTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="books" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setSearch(searchInput), setPage(1))} placeholder={t("searchBooks")} className="pl-9" />
                </div>
                <AppDropdown value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }} options={[{ value: "", label: "All Categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} placeholder={t("category")} />
                <Button variant="outline" onClick={() => { setSearch(searchInput); setPage(1); }}><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={bookColumns as any} data={books} pagination={pagination} onPageChange={setPage} onSearch={(v) => { setSearch(v); setPage(1); }} isLoading={isLoading} searchPlaceholder={t("searchBooks")} />
        </TabsContent>

        <TabsContent value="issues" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={issueSearchInput} onChange={(e) => setIssueSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setIssueSearch(issueSearchInput), setIssuePage(1))} placeholder={t("searchIssues")} className="pl-9" />
                </div>
                <AppDropdown value={issueStatus} onChange={(v) => { setIssueStatus(v); setIssuePage(1); }} options={[{ value: "", label: "All Statuses" }, { value: "ISSUED", label: t("issued") }, { value: "OVERDUE", label: t("overdue") }, { value: "RETURNED", label: t("returned") }]} placeholder={t("status")} />
                <Button variant="outline" onClick={() => { setIssueSearch(issueSearchInput); setIssuePage(1); }}><Search className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
          <DataTable columns={issueColumns as any} data={issues} pagination={issuePagination} onPageChange={setIssuePage} onSearch={(v) => { setIssueSearch(v); setIssuePage(1); }} isLoading={isIssueLoading} searchPlaceholder={t("searchIssues")} />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Book Sheet */}
      <TopSheet isOpen={isBookSheetOpen} onClose={() => setIsBookSheetOpen(false)} title={editingBook ? t("editBook") : t("addBook")} description={t("description")} maxWidth="2xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsBookSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="book-form" disabled={isBookMutating}>{t("save")}</Button></div>}>
        <form id="book-form" onSubmit={handleBookSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("titleLabel")} required error={bookErrors.title}><Input value={bookForm.title} onChange={(e) => setBookForm((p) => ({ ...p, title: e.target.value }))} placeholder={t("titleLabel")} /></ERPFormField>
              <ERPFormField label={t("author")} required error={bookErrors.author}><Input value={bookForm.author} onChange={(e) => setBookForm((p) => ({ ...p, author: e.target.value }))} placeholder={t("author")} /></ERPFormField>
              <ERPFormField label={t("accessionNo")} required error={bookErrors.accessionNo}><Input value={bookForm.accessionNo} onChange={(e) => setBookForm((p) => ({ ...p, accessionNo: e.target.value }))} placeholder={t("accessionNo")} /></ERPFormField>
              <ERPFormField label={t("isbn")}><Input value={bookForm.isbn} onChange={(e) => setBookForm((p) => ({ ...p, isbn: e.target.value }))} placeholder={t("isbn")} /></ERPFormField>
              <ERPFormField label={t("category")}><AppDropdown value={bookForm.category} onChange={(v) => setBookForm((p) => ({ ...p, category: v }))} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></ERPFormField>
              <ERPFormField label={t("copies")}><Input type="number" min={1} value={bookForm.copies} onChange={(e) => setBookForm((p) => ({ ...p, copies: parseInt(e.target.value) || 1 }))} /></ERPFormField>
              <ERPFormField label={t("shelfLocation")}><Input value={bookForm.shelfLocation} onChange={(e) => setBookForm((p) => ({ ...p, shelfLocation: e.target.value }))} placeholder={t("shelfLocation")} /></ERPFormField>
              <ERPFormField label="Publisher"><Input value={bookForm.publisher} onChange={(e) => setBookForm((p) => ({ ...p, publisher: e.target.value }))} placeholder="Publisher" /></ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Issue Book Sheet */}
      <TopSheet isOpen={isIssueSheetOpen} onClose={() => setIsIssueSheetOpen(false)} title={t("issueBook")} description={t("description")} maxWidth="xl" footer={<div className="flex justify-end gap-3 w-full"><Button variant="outline" type="button" onClick={() => setIsIssueSheetOpen(false)}>{t("cancel")}</Button><Button type="submit" form="issue-form">{t("issueBook")}</Button></div>}>
        <form id="issue-form" onSubmit={handleIssueSubmit} className="space-y-6">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("titleLabel")} required error={issueErrors.bookId}>
                <AppDropdown value={issueForm.bookId} onChange={(v) => setIssueForm((p) => ({ ...p, bookId: v }))} options={books.map((b: any) => ({ value: b.id, label: `${b.title} (${b.availableCopies} avail)` }))} placeholder={t("selectBook")} searchable />
              </ERPFormField>
              <ERPFormField label={t("borrowerType")}>
                <AppDropdown value={issueForm.borrowerType} onChange={(v) => setIssueForm((p) => ({ ...p, borrowerType: v as any }))} options={[{ value: "STUDENT", label: t("student") }, { value: "STAFF", label: t("staff") }]} />
              </ERPFormField>
              <ERPFormField label={t("borrower")} required error={issueErrors.borrowerName}><Input value={issueForm.borrowerName} onChange={(e) => setIssueForm((p) => ({ ...p, borrowerName: e.target.value }))} placeholder={t("borrower")} /></ERPFormField>
              <ERPFormField label="Borrower ID" required error={issueErrors.borrowerIdNo}><Input value={issueForm.borrowerIdNo} onChange={(e) => setIssueForm((p) => ({ ...p, borrowerIdNo: e.target.value }))} placeholder="Roll No / Staff ID" /></ERPFormField>
              <ERPFormField label={t("dueDate")} required error={issueErrors.dueDate}><Input type="date" value={issueForm.dueDate} onChange={(e) => setIssueForm((p) => ({ ...p, dueDate: e.target.value }))} /></ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
