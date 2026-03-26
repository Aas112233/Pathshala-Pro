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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

const CATEGORIES = [
  { value: "COMPULSORY", label: "Compulsory", color: "default" },
  { value: "ELECTIVE", label: "Elective", color: "secondary" },
  { value: "OPTIONAL", label: "Optional", color: "outline" },
];

export default function SubjectsPage() {
  const t = useTranslations('subjects');
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
    
    if (!formData.subjectId || !formData.name || !formData.code) {
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
        <Button onClick={handleCreateOpen}>
          <Plus className="h-4 w-4 mr-2" />
          {t('addSubject')}
        </Button>
      </div>

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
                    {cat.label}
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
                  <TableCell colSpan={8} className="text-center py-8">
                    {t('loadingSubjects')}
                  </TableCell>
                </TableRow>
              ) : filteredSubjects?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">{t('noSubjectsFound')}</p>
                    <Button variant="link" onClick={handleCreateOpen} className="mt-2">
                      {t('addYourFirstSubject')}
                    </Button>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(subject)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(subject.id)}
                          disabled={deleteSubject.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSubject ? t('editSubject') : t('createNewSubject')}
            </DialogTitle>
            <DialogDescription>
              {editingSubject ? t('updateSubject') : t('addSubjectDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subjectId">{t('subjectId')} *</Label>
                  <Input
                    id="subjectId"
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    placeholder="SUB-MAT"
                    disabled={!!editingSubject}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">{t('subjectCode')} *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="MAT"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">{t('category')}</Label>
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
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('subjectName')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Mathematics"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxMarks">{t('maxMarks')}</Label>
                  <Input
                    id="maxMarks"
                    type="number"
                    value={formData.maxMarks}
                    onChange={(e) => setFormData({ ...formData, maxMarks: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passMarks">{t('passMarks')}</Label>
                  <Input
                    id="passMarks"
                    type="number"
                    value={formData.passMarks}
                    onChange={(e) => setFormData({ ...formData, passMarks: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={createSubject.isPending || updateSubject.isPending}>
                {editingSubject ? t('update') : t('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
