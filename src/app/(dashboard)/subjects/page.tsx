"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, BookOpen, Search } from "lucide-react";
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject, type Subject } from "@/hooks/use-exams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

const CATEGORIES = [
  { value: "COMPULSORY", label: "compulsory", color: "default" },
  { value: "ELECTIVE", label: "elective", color: "secondary" },
  { value: "OPTIONAL", label: "optional", color: "outline" },
];

export default function SubjectsPage() {
  const t = useTranslations('subjects');
  const tCommon = useTranslations("common");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "subjects", "read");
  const canWrite = hasPermission(perms, "subjects", "write");
  const canManage = hasPermission(perms, "subjects", "manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: subjects, isLoading, refetch } = useSubjects();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  const [formData, setFormData] = useState({
    subjectId: "",
    name: "",
    code: "",
    category: "COMPULSORY" as Subject["category"],
    maxMarks: 100,
    passMarks: 33,
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<{
    subjectId?: string;
    name?: string;
    code?: string;
  }>({});

  function resetForm() {
    setFormData({
      subjectId: "",
      name: "",
      code: "",
      category: "COMPULSORY",
      maxMarks: 100,
      passMarks: 33,
      isActive: true,
    });
    setFormErrors({});
  }

  function handleCreateOpen() {
    resetForm();
    setEditingSubject(null);
    setCreateOpen(true);
  }

  function handleEdit(subject: Subject) {
    setEditingSubject(subject);
    setFormData({
      subjectId: subject.subjectId,
      name: subject.name,
      code: subject.code,
      category: subject.category,
      maxMarks: subject.maxMarks,
      passMarks: subject.passMarks,
      isActive: subject.isActive,
    });
    setCreateOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nextErrors: typeof formErrors = {};
    if (!formData.subjectId.trim()) nextErrors.subjectId = t("requiredField", { field: t("subjectId") });
    if (!formData.name.trim()) nextErrors.name = t("requiredField", { field: t("subjectName") });
    if (!formData.code.trim()) nextErrors.code = t("requiredField", { field: t("subjectCode") });

    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error(t('pleaseFillRequired'));
      return;
    }

    if (editingSubject) {
      updateSubject.mutate({ id: editingSubject.id, data: formData }, {
        onSuccess: () => {
          setCreateOpen(false);
          resetForm();
          setEditingSubject(null);
        },
      });
    } else {
      createSubject.mutate(formData, {
        onSuccess: () => {
          setCreateOpen(false);
          resetForm();
        },
      });
    }
  }

  function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) {
      return;
    }
    deleteSubject.mutate(id);
  }

  const filteredSubjects = subjects?.filter((subject: any) => {
    const matchesSearch = subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subject.subjectId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || subject.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('description')}
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleCreateOpen}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addSubject')}
          </Button>
        )}
      </div>

      {!isAuthLoading && !canRead ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2>{tCommon("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p>
        </div>
      ) : (
        <>
          {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('filterByCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {t(cat.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{subjects?.length || 0}</div>
            <p className="text-muted-foreground">{t('totalSubjects')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{subjects?.filter((s: any) => s.category === "COMPULSORY").length || 0}</div>
            <p className="text-muted-foreground">{t('compulsory')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{subjects?.filter((s: any) => s.category === "ELECTIVE").length || 0}</div>
            <p className="text-muted-foreground">{t('elective')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{subjects?.filter((s: any) => s.isActive).length || 0}</div>
            <p className="text-muted-foreground">{t('active')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subjects Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('allSubjects')}</CardTitle>
          <CardDescription>
            {t('manageSubjectDetails')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tableColumns.subjectId')}</TableHead>
                <TableHead>{t('tableColumns.code')}</TableHead>
                <TableHead>{t('tableColumns.name')}</TableHead>
                <TableHead>{t('tableColumns.category')}</TableHead>
                <TableHead>{t('tableColumns.marks')}</TableHead>
                <TableHead>{t('tableColumns.passMarks')}</TableHead>
                <TableHead>{t('tableColumns.status')}</TableHead>
                <TableHead className="text-right">{t('tableColumns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <TableSkeleton rows={6} />
                  </TableCell>
                </TableRow>
              ) : filteredSubjects?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">{t('noSubjectsFound')}</p>
                    {canWrite && (
                      <Button variant="link" onClick={handleCreateOpen} className="mt-2">
                        {t('addYourFirstSubject')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubjects?.map((subject: any) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.subjectId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{subject.code}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>
                      <Badge variant={
                        subject.category === "COMPULSORY" ? "default" :
                        subject.category === "ELECTIVE" ? "secondary" : "outline"
                      }>
                        {CATEGORIES.find(c => c.value === subject.category)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{subject.maxMarks}</TableCell>
                    <TableCell>{subject.passMarks}</TableCell>
                    <TableCell>
                      <Badge variant={subject.isActive ? "default" : "secondary"}>
                        {subject.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(subject)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(subject.id)}
                            disabled={deleteSubject.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </>
      )}

      {/* Create/Edit Sheet */}
      <TopSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editingSubject ? t('editSubject') : t('createNewSubject')}
        description={editingSubject ? t('updateSubject') : t('addSubjectDescription')}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" form="subject-form" disabled={createSubject.isPending || updateSubject.isPending}>
              {editingSubject ? t('update') : t('create')}
            </Button>
          </div>
        }
      >
        <form id="subject-form" onSubmit={handleSubmit} className="space-y-5">
          <ERPFormSection>
            <ERPFormGrid cols={3}>
              <ERPFormField label={t('subjectId')} required error={formErrors.subjectId} htmlFor="subjectId">
                <Input
                  id="subjectId"
                  value={formData.subjectId}
                  onChange={(e) => {
                    setFormData({ ...formData, subjectId: e.target.value });
                    if (formErrors.subjectId) {
                      setFormErrors((prev) => ({ ...prev, subjectId: undefined }));
                    }
                  }}
                  placeholder={t("subjectIdPlaceholder")}
                  disabled={!!editingSubject}
                  aria-invalid={Boolean(formErrors.subjectId)}
                />
              </ERPFormField>
              <ERPFormField label={t('subjectCode')} required error={formErrors.code} htmlFor="code">
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => {
                    setFormData({ ...formData, code: e.target.value.toUpperCase() });
                    if (formErrors.code) {
                      setFormErrors((prev) => ({ ...prev, code: undefined }));
                    }
                  }}
                  placeholder={t("subjectCodePlaceholder")}
                  maxLength={10}
                  aria-invalid={Boolean(formErrors.code)}
                />
              </ERPFormField>
              <ERPFormField label={t('category')} htmlFor="category">
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {t(cat.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormField label={t('subjectName')} required error={formErrors.name} htmlFor="name">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) {
                    setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder={t("subjectNamePlaceholder")}
                aria-invalid={Boolean(formErrors.name)}
              />
            </ERPFormField>

            <ERPFormGrid cols={2}>
              <ERPFormField label={t('maxMarks')} htmlFor="maxMarks">
                <Input
                  id="maxMarks"
                  type="number"
                  value={formData.maxMarks}
                  onChange={(e) => setFormData({ ...formData, maxMarks: Number(e.target.value) })}
                />
              </ERPFormField>
              <ERPFormField label={t('passMarks')} htmlFor="passMarks">
                <Input
                  id="passMarks"
                  type="number"
                  value={formData.passMarks}
                  onChange={(e) => setFormData({ ...formData, passMarks: Number(e.target.value) })}
                />
              </ERPFormField>
            </ERPFormGrid>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">{t('isActive')}</Label>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">{t('quickPresets')}</h4>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, maxMarks: 100, passMarks: 33 })}
                >
                  {t('marks100')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, maxMarks: 50, passMarks: 20 })}
                >
                  {t('marks50')}
                </Button>
              </div>
            </div>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
