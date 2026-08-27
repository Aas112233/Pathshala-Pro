"use client";

import { useState } from "react";
import { Plus, GraduationCap, TrendingUp } from "lucide-react";
import { usePromotionRules, useCreatePromotionRule, type PromotionRule } from "@/hooks/use-exams";
import { useAcademicYears } from "@/hooks/use-queries";
import { useStudents } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function PromotionRulesPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("");

  const { data: rulesData, isLoading } = usePromotionRules({ academicYearId: selectedYear || undefined });
  const { data: academicYearsData } = useAcademicYears();
  const { data: studentsData } = useStudents();
  const createRule = useCreatePromotionRule();

  // Extract data from API response
  const rules = Array.isArray(rulesData) ? rulesData : (rulesData as any)?.data;
  const academicYears = Array.isArray(academicYearsData) ? academicYearsData : (academicYearsData as any)?.data;
  const students = Array.isArray(studentsData) ? studentsData : (studentsData as any)?.data;

  // Get unique classes from students
  const classes = Array.from(new Map(students?.map((s: any) => [s.classId, s.class]).filter(([_, v]: any) => v)).values())
    .filter(Boolean);

  const [formData, setFormData] = useState({
    academicYearId: "",
    classId: "",
    minimumAttendance: 75,
    minimumOverallPercentage: 40,
    minimumPerSubject: 33,
    maxFailedSubjects: 0,
    allowConditionalPromotion: false,
    autoPromote: true,
    nextClassId: "",
  });

  function resetForm() {
    setFormData({
      academicYearId: selectedYear || "",
      classId: "",
      minimumAttendance: 75,
      minimumOverallPercentage: 40,
      minimumPerSubject: 33,
      maxFailedSubjects: 0,
      allowConditionalPromotion: false,
      autoPromote: true,
      nextClassId: "",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.academicYearId || !formData.classId) {
      toast.error("Please select academic year and class");
      return;
    }

    createRule.mutate(formData as Partial<PromotionRule>, {
      onSuccess: () => {
        setCreateOpen(false);
        resetForm();
      },
    });
  }

  function handleCalculatePromotions(rule: PromotionRule) {
    router.push(`/promotions/calculate?classId=${rule.classId}&academicYearId=${rule.academicYearId}`);
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Promotion Rules</h1>
          <p className="text-muted-foreground mt-1">
            Configure promotion criteria for each class
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select academic year" />
          </SelectTrigger>
          <SelectContent>
            {academicYears?.map((year: any) => (
              <SelectItem key={year.id} value={year.id}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rules Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full">
            <CardGridSkeleton count={6} />
          </div>
        ) : rules?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No promotion rules found</p>
            <Button variant="link" onClick={() => { resetForm(); setCreateOpen(true); }}>
              Create your first promotion rule
            </Button>
          </div>
        ) : (
          rules?.map((rule: any) => (
            <Card key={rule.id} className="relative">
              <CardHeader>
                <CardTitle className="text-lg">{rule.class?.name}</CardTitle>
                <CardDescription>{rule.academicYear?.label}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Attendance</p>
                    <p className="font-medium">{rule.minimumAttendance}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Overall %</p>
                    <p className="font-medium">{rule.minimumOverallPercentage}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Per Subject</p>
                    <p className="font-medium">{rule.minimumPerSubject}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Max Fails</p>
                    <p className="font-medium">{rule.maxFailedSubjects}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 pt-2">
                  {rule.allowConditionalPromotion && (
                    <Badge variant="secondary">Conditional OK</Badge>
                  )}
                  {rule.autoPromote && (
                    <Badge variant="outline">Auto Promote</Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleCalculatePromotions(rule)}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Calculate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Sheet */}
      <TopSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Promotion Rule"
        description="Define promotion criteria for a class"
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="promotion-rule-form" disabled={createRule.isPending}>
              {createRule.isPending ? "Creating..." : "Create Rule"}
            </Button>
          </div>
        }
      >
        <form id="promotion-rule-form" onSubmit={handleSubmit} className="space-y-5">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label="Academic Year" required htmlFor="academicYearId">
                <Select
                  value={formData.academicYearId}
                  onValueChange={(value) => setFormData({ ...formData, academicYearId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears?.map((year: any) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
              <ERPFormField label="Class" required htmlFor="classId">
                <Select
                  value={formData.classId}
                  onValueChange={(value) => setFormData({ ...formData, classId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={3}>
              <ERPFormField label="Min Attendance %" htmlFor="minimumAttendance">
                <Input
                  id="minimumAttendance"
                  type="number"
                  value={formData.minimumAttendance}
                  onChange={(e) => setFormData({ ...formData, minimumAttendance: Number(e.target.value) })}
                />
              </ERPFormField>
              <ERPFormField label="Min Overall %" htmlFor="minimumOverallPercentage">
                <Input
                  id="minimumOverallPercentage"
                  type="number"
                  value={formData.minimumOverallPercentage}
                  onChange={(e) => setFormData({ ...formData, minimumOverallPercentage: Number(e.target.value) })}
                />
              </ERPFormField>
              <ERPFormField label="Min Per Subject %" htmlFor="minimumPerSubject">
                <Input
                  id="minimumPerSubject"
                  type="number"
                  value={formData.minimumPerSubject}
                  onChange={(e) => setFormData({ ...formData, minimumPerSubject: Number(e.target.value) })}
                />
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={2}>
              <ERPFormField label="Max Failed Subjects" htmlFor="maxFailedSubjects">
                <Input
                  id="maxFailedSubjects"
                  type="number"
                  value={formData.maxFailedSubjects}
                  onChange={(e) => setFormData({ ...formData, maxFailedSubjects: Number(e.target.value) })}
                />
              </ERPFormField>
              <ERPFormField label="Next Class" htmlFor="nextClassId">
                <Select
                  value={formData.nextClassId}
                  onValueChange={(value) => setFormData({ ...formData, nextClassId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select next class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Next Class (Final)</SelectItem>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Conditional Promotion</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow promotion with re-exam for borderline cases
                  </p>
                </div>
                <Switch
                  checked={formData.allowConditionalPromotion}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowConditionalPromotion: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Promote</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically promote eligible students
                  </p>
                </div>
                <Switch
                  checked={formData.autoPromote}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoPromote: checked })}
                />
              </div>
            </div>
          </ERPFormSection>
        </form>
      </TopSheet>
    </div>
  );
}
