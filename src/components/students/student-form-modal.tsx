"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clsx } from "clsx";
import { toast } from "sonner";
import { ImagePreviewModal } from "@/components/shared/image-preview-modal";
import { ZoomIn } from "lucide-react";
import type { CreateStudentDTO } from "@/viewmodels/students/use-student-view-model";

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateStudentDTO) => Promise<void>;
  initialData?: CreateStudentDTO & { id?: string };
  isEditing?: boolean;
}

interface FormErrors {
  rollNumber?: string;
  firstName?: string;
  lastName?: string;
  guardianName?: string;
  guardianContact?: string;
  guardianEmail?: string;
}

export function StudentFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false,
}: StudentFormModalProps) {
  const t = useTranslations("students");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [tempFileId, setTempFileId] = useState<string | null>(null); // Track temp file ID

  const [formData, setFormData] = useState({
    rollNumber: "",
    firstName: "",
    lastName: "",
    firstNameBn: "",
    lastNameBn: "",
    guardianName: "",
    guardianContact: "",
    guardianEmail: "",
    gender: "MALE",
    status: "ACTIVE",
    profilePictureUrl: "",
    driveFileId: "",
    dateOfBirth: "",
    address: "",
    classId: "",
    groupId: "",
    sectionId: "",
  });

  // Query classes for student assignment
  const { data: classesData } = useQuery({
    queryKey: ["classes-dropdown"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true");
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: isOpen,
  });

  // Query groups filtered by selected class
  const { data: groupsData } = useQuery({
    queryKey: ["groups-dropdown", { classId: formData.classId }],
    queryFn: async () => {
      if (!formData.classId) return { data: [] };
      const res = await fetch(`/api/groups?limit=100&classId=${formData.classId}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: isOpen && !!formData.classId,
  });

  // Query sections filtered by selected class and group
  const { data: sectionsData } = useQuery({
    queryKey: ["sections-dropdown", { classId: formData.classId, groupId: formData.groupId }],
    queryFn: async () => {
      if (!formData.classId) return { data: [] };
      const params = new URLSearchParams({
        limit: "100",
        classId: formData.classId,
        ...(formData.groupId && { groupId: formData.groupId }),
      });
      const res = await fetch(`/api/sections?${params}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: isOpen && !!formData.classId,
  });

  const classOptions = useMemo(() => {
    const list = ("data" in (classesData || {})) ? (classesData as any).data : [];
    return [
      { value: "", label: t("form.noClass") },,
      ...list.map((c: any) => ({ value: c.id, label: c.name })),
    ];
  }, [classesData]);

  const groupOptions = useMemo(() => {
    const list = ("data" in (groupsData || {})) ? (groupsData as any).data : [];
    return [
      { value: "", label: t("form.noGroup") },,
      ...list.map((g: any) => ({ value: g.id, label: g.name })),
    ];
  }, [groupsData]);

  const sectionOptions = useMemo(() => {
    const list = ("data" in (sectionsData || {})) ? (sectionsData as any).data : [];
    return [
      { value: "", label: t("form.noSection") },,
      ...list.map((s: any) => ({ value: s.id, label: s.name })),
    ];
  }, [sectionsData]);

  // Reset form data when initialData changes (for edit mode)
  // Or reset to empty when initialData is null/undefined (for new student mode)
  useEffect(() => {
    if (initialData) {
      setFormData({
        rollNumber: initialData.rollNumber || "",
        firstName: initialData.firstName || "",
        lastName: initialData.lastName || "",
        firstNameBn: initialData.firstNameBn || "",
        lastNameBn: initialData.lastNameBn || "",
        guardianName: initialData.guardianName || "",
        guardianContact: initialData.guardianContact || "",
        guardianEmail: initialData.guardianEmail || "",
        gender: initialData.gender || "MALE",
        status: initialData.status || "ACTIVE",
        profilePictureUrl: initialData.profilePictureUrl || "",
        driveFileId: initialData.driveFileId || "",
        dateOfBirth: initialData.dateOfBirth || "",
        address: initialData.address || "",
        classId: initialData.classId || "",
        groupId: initialData.groupId || "",
        sectionId: initialData.sectionId || "",
      });
    } else {
      // Reset to empty form for new student
      setFormData({
        rollNumber: "",
        firstName: "",
        lastName: "",
        firstNameBn: "",
        lastNameBn: "",
        guardianName: "",
        guardianContact: "",
        guardianEmail: "",
        gender: "MALE",
        status: "ACTIVE",
        profilePictureUrl: "",
        driveFileId: "",
        dateOfBirth: "",
        address: "",
        classId: "",
        groupId: "",
        sectionId: "",
      });
      setTempFileId(null);
      setSelectedFile(null);
      setUploadProgress(0);
      setErrors({});
    }
  }, [initialData]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.rollNumber.trim()) {
      newErrors.rollNumber = t("form.required", { field: t("rollNumber") });
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = t("form.required", { field: t("firstName") });
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t("form.required", { field: t("lastName") });
    }

    if (!formData.guardianName.trim()) {
      newErrors.guardianName = t("form.required", { field: t("guardianName") });
    }

    if (!formData.guardianContact.trim()) {
      newErrors.guardianContact = t("form.required", { field: t("guardianContact") });
    } else if (!/^\d{10,}$/.test(formData.guardianContact.replace(/\s/g, ""))) {
      newErrors.guardianContact = t("form.invalidPhone");
    }

    if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
      newErrors.guardianEmail = t("form.invalidEmail");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleDropdownChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("upload.fileTooLarge"));
        e.target.value = "";
        return;
      }
      setSelectedFile(file);
      setIsUploading(true);
      setUploadProgress(0);

      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("fileType", "student_profiles");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          setFormData((prev) => ({
            ...prev,
            profilePictureUrl: response.data.webViewLink,
            driveFileId: response.data.fileId
          }));
          setTempFileId(response.data.fileId); // Track for cleanup
          toast.success(t("upload.imageUploaded"));
        } else {
          let errMsg = t("upload.failed");
          try {
            const errRes = JSON.parse(xhr.responseText);
            errMsg = errRes.error || errRes.message || errMsg;
          } catch (e) { }
          toast.error(errMsg);
          setSelectedFile(null);
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        toast.error(t("upload.networkError"));
        setSelectedFile(null);
      };

      xhr.send(uploadData);
    }
  }, []);

  // Cleanup temp file on cancel/close
  const cleanupTempFile = useCallback(async () => {
    if (tempFileId && tempFileId.includes("temp_")) {
      try {
        const response = await fetch(`/api/upload?fileId=${encodeURIComponent(tempFileId)}`, {
          method: "DELETE",
        });

        if (response.ok) {
          console.log("Temp file cleaned up:", tempFileId);
        }
      } catch (error) {
        console.error("Failed to cleanup temp file:", error);
      }
    }
  }, [tempFileId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (isUploading) {
      toast.error(t("upload.wait"));
      return;
    }

    setIsLoading(true);

    try {
      // Strip empty strings from optional fields - the API's Zod schemas
      // reject e.g. profilePictureUrl: "" ("Invalid url") otherwise.
      const payload: CreateStudentDTO = {
        ...formData,
        classId: formData.classId || undefined,
        groupId: formData.groupId || undefined,
        sectionId: formData.sectionId || undefined,
        profilePictureUrl: formData.profilePictureUrl || undefined,
        driveFileId: formData.driveFileId || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        address: formData.address || undefined,
      };
      await onSubmit(payload);
      onClose();

      // Reset form
      setFormData({
        rollNumber: "",
        firstName: "",
        lastName: "",
        firstNameBn: "",
        lastNameBn: "",
        guardianName: "",
        guardianContact: "",
        guardianEmail: "",
        gender: "MALE",
        status: "ACTIVE",
        profilePictureUrl: "",
        driveFileId: "",
        dateOfBirth: "",
        address: "",
        classId: "",
        groupId: "",
        sectionId: "",
      });
      setSelectedFile(null);
      setUploadProgress(0);
      setErrors({});
    } catch (error: any) {
      // Error is handled by the view model
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = useCallback(() => {
    cleanupTempFile();
    onClose();
  }, [cleanupTempFile, onClose]);

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={handleModalClose}
      title={isEditing ? t("formTitle.edit") : t("formTitle.create")}
      description={isEditing ? t("formDescription.edit") : t("formDescription.create")}
      maxWidth="4xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" type="button" onClick={handleModalClose} disabled={isLoading || isUploading}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="student-form" disabled={isLoading || isUploading}>
            {isLoading ? t("saving") : isUploading ? t("form.uploadingFile") : isEditing ? t("form.updateStudent") : t("form.saveStudent")}
          </Button>
        </div>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photo Upload */}
          <div className="lg:col-span-1">
            <div className="sticky top-0 space-y-1.5">
              <label className="text-xs font-semibold text-foreground/90">{t("upload.studentPhoto")}</label>
              <div className={clsx(
                "space-y-1.5 flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg transition-colors",
                isUploading ? "border-primary/50 bg-primary/5" : "border-muted-foreground/25 hover:bg-muted/50"
              )}>
                {/* Image Preview */}
                {(formData.profilePictureUrl || selectedFile) && (
                  <div className="mb-3">
                    <div
                      className="relative h-32 w-32 cursor-pointer overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/20 transition-all hover:ring-primary/40 hover:scale-105"
                      onClick={() => setIsImagePreviewOpen(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsImagePreviewOpen(true);
                        }
                      }}
                      aria-label={t("upload.previewImage")}
                    >
                      <img
                        src={formData.profilePictureUrl || (selectedFile ? URL.createObjectURL(selectedFile) : "")}
                        alt={t("upload.photoAlt")}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <ZoomIn className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                <label className={clsx("text-sm font-medium flex flex-col items-center space-y-2", !isUploading && "cursor-pointer")}>
                  <span className="bg-primary/10 text-primary p-3 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                  </span>
                  <span className="font-semibold text-xs text-center">{selectedFile ? selectedFile.name : (formData.profilePictureUrl ? t("upload.changePhoto") : t("upload.uploadPhoto"))}</span>
                  <span className="text-xs text-muted-foreground">{t("upload.constraints")}</span>

                  {isUploading && (
                    <div className="w-full mt-2 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t("upload.uploading")}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileChange}
                    disabled={isLoading || isUploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right Column - Form Fields */}
          <div className="lg:col-span-2 space-y-5">
            {/* Basic Information */}
            <ERPFormSection title={t("section.basicInfo")}>
              <ERPFormGrid cols={2}>
                <ERPFormField label={t("rollNumber")} required error={errors.rollNumber} htmlFor="student-rollNumber">
                  <Input
                    id="student-rollNumber"
                    required
                    name="rollNumber"
                    value={formData.rollNumber}
                    onChange={handleChange}
                    placeholder={t("form.rollPlaceholder")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.rollNumber)}
                  />
                </ERPFormField>

                <ERPFormField label={t("gender")} htmlFor="student-gender">
                  <AppDropdown
                    value={formData.gender}
                    onChange={(val) => handleDropdownChange("gender", val)}
                    disabled={isLoading || isUploading}
                    options={[
                      { value: "MALE", label: t("male") },
                      { value: "FEMALE", label: t("female") },
                      { value: "OTHER", label: t("other") },
                    ]}
                  />
                </ERPFormField>

                <ERPFormField label={t("firstName")} required error={errors.firstName} htmlFor="student-firstName">
                  <Input
                    id="student-firstName"
                    required
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder={t("form.firstNamePlaceholder")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.firstName)}
                  />
                </ERPFormField>
                <ERPFormField label={t("lastName")} required error={errors.lastName} htmlFor="student-lastName">
                  <Input
                    id="student-lastName"
                    required
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder={t("form.lastNamePlaceholder")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.lastName)}
                  />
                </ERPFormField>

                {/* Bengali Name Fields */}
                <ERPFormField label={t("firstNameBn")} htmlFor="student-firstNameBn">
                  <Input
                    id="student-firstNameBn"
                    name="firstNameBn"
                    value={formData.firstNameBn}
                    onChange={handleChange}
                    placeholder={t("form.firstNameBnPlaceholder")}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
                <ERPFormField label={t("lastNameBn")} htmlFor="student-lastNameBn">
                  <Input
                    id="student-lastNameBn"
                    name="lastNameBn"
                    value={formData.lastNameBn}
                    onChange={handleChange}
                    placeholder={t("form.lastNameBnPlaceholder")}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>

                <ERPFormField label={t("dateOfBirth")} htmlFor="student-dateOfBirth">
                  <Input
                    id="student-dateOfBirth"
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
                <ERPFormField label={t("address")} htmlFor="student-address">
                  <Input
                    id="student-address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder={t("form.addressPlaceholder")}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
              </ERPFormGrid>
            </ERPFormSection>

            {/* Guardian Information */}
            <ERPFormSection title={t("section.guardianInfo")}>
              <ERPFormGrid cols={2}>
                <ERPFormField label={t("guardianName")} required error={errors.guardianName} htmlFor="student-guardianName">
                  <Input
                    id="student-guardianName"
                    required
                    name="guardianName"
                    value={formData.guardianName}
                    onChange={handleChange}
                    placeholder={t("form.fullNamePlaceholder")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.guardianName)}
                  />
                </ERPFormField>
                <ERPFormField label={t("guardianContact")} required error={errors.guardianContact} htmlFor="student-guardianContact">
                  <Input
                    id="student-guardianContact"
                    required
                    name="guardianContact"
                    value={formData.guardianContact}
                    onChange={handleChange}
                    placeholder={t("form.phonePlaceholder")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.guardianContact)}
                  />
                </ERPFormField>

                <ERPFormField label={t("guardianEmail")} error={errors.guardianEmail} htmlFor="student-guardianEmail">
                  <Input
                    id="student-guardianEmail"
                    type="email"
                    name="guardianEmail"
                    value={formData.guardianEmail}
                    onChange={handleChange}
                    placeholder={t("form.emailPlaceholder")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.guardianEmail)}
                  />
                </ERPFormField>

                <ERPFormField label={t("status")} htmlFor="student-status">
                  <AppDropdown
                    value={formData.status}
                    onChange={(val) => handleDropdownChange("status", val)}
                    disabled={isLoading || isUploading}
                    options={[
                      { value: "ACTIVE", label: t("active") },
                      { value: "INACTIVE", label: t("inactive") },
                      { value: "SUSPENDED", label: t("filters.status.suspended") },
                    ]}
                  />
                </ERPFormField>
              </ERPFormGrid>
            </ERPFormSection>

            {/* Academic Placement */}
            <ERPFormSection title={t("section.academicPlacement")}>
              <ERPFormGrid cols={3}>
                <ERPFormField label={t("class")} htmlFor="student-classId">
                  <AppDropdown
                    value={formData.classId}
                    onChange={(val) => {
                      setFormData((prev) => ({
                        ...prev,
                        classId: val,
                        groupId: "",
                        sectionId: "",
                      }));
                    }}
                    disabled={isLoading || isUploading}
                    options={classOptions}
                  />
                </ERPFormField>

                <ERPFormField label={t("form.groupStream")} htmlFor="student-groupId">
                  <AppDropdown
                    value={formData.groupId}
                    onChange={(val) => {
                      setFormData((prev) => ({
                        ...prev,
                        groupId: val,
                        sectionId: "",
                      }));
                    }}
                    disabled={isLoading || isUploading || !formData.classId}
                    options={groupOptions}
                  />
                </ERPFormField>

                <ERPFormField label={t("sectionLabel")} htmlFor="student-sectionId">
                  <AppDropdown
                    value={formData.sectionId}
                    onChange={(val) => handleDropdownChange("sectionId", val)}
                    disabled={isLoading || isUploading || !formData.classId}
                    options={sectionOptions}
                  />
                </ERPFormField>
              </ERPFormGrid>
            </ERPFormSection>
          </div>
        </div>
      </form>

      <ImagePreviewModal
        isOpen={isImagePreviewOpen}
        onClose={() => setIsImagePreviewOpen(false)}
        src={formData.profilePictureUrl || (selectedFile ? URL.createObjectURL(selectedFile) : "")}
        alt={t("upload.photoAlt")}
        title={t("upload.studentPhoto")}
      />
    </TopSheet>
  );
}
