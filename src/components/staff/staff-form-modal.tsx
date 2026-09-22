"use client";

import { useState, useCallback, useEffect } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import { isValidBirthDate, isValidDateInput } from "@/lib/date-validation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clsx } from "clsx";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ImagePreviewModal } from "@/components/shared/image-preview-modal";
import { ZoomIn, UserCircle } from "lucide-react";
import type { CreateStaffDTO } from "@/types/entities";

interface StaffFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateStaffDTO) => Promise<void>;
  initialData?: CreateStaffDTO & { id?: string };
  isEditing?: boolean;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  department?: string;
  designation?: string;
  email?: string;
  userEmail?: string;
  userPassword?: string;
  phone?: string;
  baseSalary?: string;
  hireDate?: string;
  dateOfBirth?: string;
}

export function StaffFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false,
}: StaffFormModalProps) {
  const t = useTranslations("staff");
  const tDate = useTranslations("dateValidation");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [tempFileId, setTempFileId] = useState<string | null>(null);
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");

  const departmentOptions = [
    { value: "Teaching", label: t("filters.department.teaching") },
    { value: "Administration", label: t("filters.department.administration") },
    { value: "Support", label: t("filters.department.support") },
    { value: "Transport", label: t("filters.department.transport") },
    { value: "Maintenance", label: t("filters.department.maintenance") },
  ];

  const designationOptions = [
    { value: "Principal", label: t("form.designations.principal") },
    { value: "Vice Principal", label: t("form.designations.vicePrincipal") },
    { value: "Senior Teacher", label: t("form.designations.seniorTeacher") },
    { value: "Teacher", label: t("form.designations.teacher") },
    { value: "Accountant", label: t("form.designations.accountant") },
    { value: "Admin Officer", label: t("form.designations.adminOfficer") },
    { value: "Clerk", label: t("form.designations.clerk") },
    { value: "Librarian", label: t("form.designations.librarian") },
    { value: "Lab Assistant", label: t("form.designations.labAssistant") },
    { value: "PT Teacher", label: t("form.designations.ptTeacher") },
    { value: "Counselor", label: t("form.designations.counselor") },
  ];

  const [formData, setFormData] = useState<CreateStaffDTO>({
    firstName: "",
    lastName: "",
    firstNameBn: "",
    lastNameBn: "",
    department: "",
    designation: "",
    baseSalary: 0,
    hireDate: "",
    joiningDate: "",
    phone: "",
    email: "",
    gender: "MALE",
    dateOfBirth: "",
    qualification: "",
    profilePictureUrl: "",
    driveFileId: "",
    address: "",
    isActive: true,
  });

  // Reset form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName || "",
        lastName: initialData.lastName || "",
        firstNameBn: initialData.firstNameBn || "",
        lastNameBn: initialData.lastNameBn || "",
        department: initialData.department || "",
        designation: initialData.designation || "",
        baseSalary: initialData.baseSalary || 0,
        hireDate: initialData.hireDate || "",
        joiningDate: initialData.joiningDate || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        gender: initialData.gender || "MALE",
        dateOfBirth: initialData.dateOfBirth || "",
        qualification: initialData.qualification || "",
        profilePictureUrl: initialData.profilePictureUrl || "",
        driveFileId: initialData.driveFileId || "",
        address: initialData.address || "",
        isActive: initialData.isActive ?? true,
        userId: initialData.userId,
      });
      if (initialData.email) {
        setUserEmail(initialData.email);
      }
    } else {
      // Reset to empty form for new staff
      setFormData({
        firstName: "",
        lastName: "",
        firstNameBn: "",
        lastNameBn: "",
        department: "",
        designation: "",
        baseSalary: 0,
        hireDate: "",
        joiningDate: "",
        phone: "",
        email: "",
        gender: "MALE",
        dateOfBirth: "",
        qualification: "",
        profilePictureUrl: "",
        driveFileId: "",
        address: "",
        isActive: true,
      });
      setTempFileId(null);
      setSelectedFile(null);
      setUploadProgress(0);
      setErrors({});
      setCreateUserAccount(false);
      setUserEmail("");
      setUserPassword("");
    }
  }, [initialData]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t("form.firstNameRequired");
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t("form.lastNameRequired");
    }

    if (!formData.department.trim()) {
      newErrors.department = t("form.departmentRequired");
    }

    if (!formData.designation.trim()) {
      newErrors.designation = t("form.designationRequired");
    }

    if (!formData.hireDate) {
      newErrors.hireDate = t("form.hireDateRequired");
    }

    if (formData.baseSalary < 0) {
      newErrors.baseSalary = t("form.baseSalaryNonNegative");
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("form.emailInvalid");
    }

    if (formData.phone && !/^\d{10,}$/.test(formData.phone.replace(/\s/g, ""))) {
      newErrors.phone = t("form.phoneInvalid");
    }

    if (createUserAccount) {
      if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        newErrors.userEmail = t("form.loginEmailRequired");
      }
      if (!userPassword || userPassword.length < 6) {
        newErrors.userPassword = t("form.passwordRequired");
      }
    }

    if (formData.dateOfBirth && !isValidBirthDate(formData.dateOfBirth)) {
      newErrors.dateOfBirth = tDate(isValidDateInput(formData.dateOfBirth) ? "futureBirthDate" : "invalid");
    }
    if (formData.hireDate && !isValidDateInput(formData.hireDate)) {
      newErrors.hireDate = tDate("invalid");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, createUserAccount, userEmail, userPassword, tDate, t]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value
    }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleDropdownChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleDateChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("fileTooLarge"));
        e.target.value = "";
        return;
      }
      setSelectedFile(file);
      setIsUploading(true);
      setUploadProgress(0);

      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("fileType", "staff_profiles");

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });

        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || "Failed to upload image. Please try again.");
        }

        const result = await response.json();
        setFormData((prev) => ({
          ...prev,
          profilePictureUrl: result.data.webViewLink,
          driveFileId: result.data.fileId
        }));
        setTempFileId(result.data.fileId);
        toast.success(t("imageUploadSuccess"));
      } catch (err: any) {
        toast.error(err?.message || t("uploadNetworkError"));
        setSelectedFile(null);
      } finally {
        setIsUploading(false);
      }
    }
  }, [t]);

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
      toast.error(t("waitForUpload"));
      return;
    }

    setIsLoading(true);

    try {
      // Strip empty strings from optional fields - the API's Zod schemas
      // reject e.g. profilePictureUrl: "" / email: "" otherwise.
      const payload: CreateStaffDTO = {
        ...formData,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        qualification: formData.qualification || undefined,
        profilePictureUrl: formData.profilePictureUrl || undefined,
        driveFileId: formData.driveFileId || undefined,
        address: formData.address || undefined,
      };
      await onSubmit(payload);

      // If create user account is checked, we would need to call a separate endpoint
      // This is handled by the parent component via the viewmodel

      onClose();

      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        firstNameBn: "",
        lastNameBn: "",
        department: "",
        designation: "",
        baseSalary: 0,
        hireDate: "",
        joiningDate: "",
        phone: "",
        email: "",
        gender: "MALE",
        dateOfBirth: "",
        qualification: "",
        profilePictureUrl: "",
        driveFileId: "",
        address: "",
        isActive: true,
      });
      setSelectedFile(null);
      setUploadProgress(0);
      setErrors({});
      setCreateUserAccount(false);
      setUserEmail("");
      setUserPassword("");
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
      title={isEditing ? t("editStaff") : t("addStaff")}
      description={isEditing ? t("form.editStaffDescription") : t("form.addStaffDescription")}
      maxWidth="5xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" type="button" onClick={handleModalClose} disabled={isLoading || isUploading}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" form="staff-form" disabled={isLoading || isUploading}>
            {isLoading ? t("form.saving") : isUploading ? t("form.uploading") : isEditing ? t("form.update") : t("form.create")}
          </Button>
        </div>
      }
    >
      <form id="staff-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Photo Upload */}
          <div className="lg:col-span-1">
            <div className="sticky top-0 space-y-1.5">
              <label className="text-xs font-semibold text-foreground/90">{t("staffProfile")}</label>
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
                      aria-label={t("form.previewAria")}
                    >
                      <img
                        src={formData.profilePictureUrl || (selectedFile ? URL.createObjectURL(selectedFile) : "")}
                        alt={t("form.previewAlt")}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <ZoomIn className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {!formData.profilePictureUrl && !selectedFile && (
                  <div className="mb-3 h-32 w-32 rounded-full bg-muted flex items-center justify-center">
                    <UserCircle className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}

                <label className={clsx("text-sm font-medium flex flex-col items-center space-y-2", !isUploading && "cursor-pointer")}>
                  <span className="bg-primary/10 text-primary p-3 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                  </span>
                  <span className="font-semibold text-xs text-center">{selectedFile ? selectedFile.name : (formData.profilePictureUrl ? t("form.changePhoto") : t("form.uploadPhoto"))}</span>
                  <span className="text-xs text-muted-foreground">{t("form.photoFormat")}</span>

                  {isUploading && (
                    <div className="w-full mt-2 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t("form.uploading")}</span>
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
          <div className="lg:col-span-3 space-y-5">
            {/* Basic Information */}
            <ERPFormSection title={t("form.sectionBasicInfo")}>
              <ERPFormGrid cols={2}>
                <ERPFormField label={t("form.staffId")} helperText={t("form.staffIdHelper")}>
                  <div className="px-3 py-2 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                    {t("form.autoGenerated")}
                  </div>
                </ERPFormField>

                <ERPFormField label={t("form.gender")} htmlFor="gender">
                  <AppDropdown
                    value={formData.gender || "MALE"}
                    onChange={(val) => handleDropdownChange("gender", val)}
                    disabled={isLoading || isUploading}
                    options={[
                      { value: "MALE", label: t("form.male") },
                      { value: "FEMALE", label: t("form.female") },
                      { value: "OTHER", label: t("form.other") },
                    ]}
                  />
                </ERPFormField>

                <ERPFormField label={t("form.firstName")} required error={errors.firstName} htmlFor="firstName">
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder={t("form.firstName")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.firstName)}
                  />
                </ERPFormField>
                <ERPFormField label={t("form.lastName")} required error={errors.lastName} htmlFor="lastName">
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder={t("form.lastName")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.lastName)}
                  />
                </ERPFormField>

                {/* Bengali Name Fields */}
                <ERPFormField label={t("form.firstNameBn")} htmlFor="firstNameBn">
                  <Input
                    id="firstNameBn"
                    name="firstNameBn"
                    value={formData.firstNameBn}
                    onChange={handleChange}
                    placeholder={t("form.firstNameBnPlaceholder")}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
                <ERPFormField label={t("form.lastNameBn")} htmlFor="lastNameBn">
                  <Input
                    id="lastNameBn"
                    name="lastNameBn"
                    value={formData.lastNameBn}
                    onChange={handleChange}
                    placeholder={t("form.lastNameBnPlaceholder")}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>

                <ERPFormField label={t("form.dateOfBirth")} error={errors.dateOfBirth} htmlFor="dateOfBirth">
                  <TenantDateInput
                    id="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={(v) => handleDateChange("dateOfBirth", v)}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
                <ERPFormField label={t("form.address")} htmlFor="address">
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder={t("form.addressPlaceholder")}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
              </ERPFormGrid>
            </ERPFormSection>

            {/* Employment Information */}
            <ERPFormSection title={t("form.sectionEmploymentInfo")}>
              <ERPFormGrid cols={2}>
                <ERPFormField label={t("department")} required error={errors.department} htmlFor="department">
                  <AppDropdown
                    id="department"
                    value={formData.department}
                    onChange={(val) => handleDropdownChange("department", val)}
                    disabled={isLoading || isUploading}
                    options={departmentOptions}
                    placeholder={t("form.departmentPlaceholder")}
                  />
                </ERPFormField>
                <ERPFormField label={t("designation")} required error={errors.designation} htmlFor="designation">
                  <AppDropdown
                    id="designation"
                    value={formData.designation}
                    onChange={(val) => handleDropdownChange("designation", val)}
                    disabled={isLoading || isUploading}
                    options={designationOptions}
                    placeholder={t("form.designationPlaceholder")}
                  />
                </ERPFormField>

                <ERPFormField label={t("joiningDate")} htmlFor="joiningDate">
                  <TenantDateInput
                    id="joiningDate"
                    value={formData.joiningDate}
                    onChange={(v) => handleDateChange("joiningDate", v)}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>

                <ERPFormField label={t("qualification")} htmlFor="qualification">
                  <Input
                    id="qualification"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    placeholder={t("form.qualificationPlaceholder")}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
                <ERPFormField label={t("salary")} error={errors.baseSalary} htmlFor="baseSalary">
                  <Input
                    id="baseSalary"
                    type="number"
                    name="baseSalary"
                    value={formData.baseSalary}
                    onChange={handleChange}
                    placeholder={t("form.baseSalaryPlaceholder")}
                    min="0"
                    step="0.01"
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.baseSalary)}
                  />
                </ERPFormField>
              </ERPFormGrid>

              <ERPFormField label={t("form.status")} htmlFor="isActive">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    disabled={isLoading || isUploading}
                  />
                  <span className="text-sm">{formData.isActive ? t("form.active") : t("form.inactive")}</span>
                </div>
              </ERPFormField>
            </ERPFormSection>

            {/* Contact Information */}
            <ERPFormSection title={t("form.sectionContactInfo")}>
              <ERPFormGrid cols={2}>
                <ERPFormField label={t("form.email")} error={errors.email} htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("form.emailPlaceholder")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.email)}
                  />
                </ERPFormField>
                <ERPFormField label={t("form.phone")} error={errors.phone} htmlFor="phone">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder={t("form.phonePlaceholder")}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.phone)}
                  />
                </ERPFormField>
              </ERPFormGrid>
            </ERPFormSection>

            {/* User Account Creation */}
            {!isEditing && (
              <ERPFormSection title={t("form.sectionUserAccount")}>
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Switch
                    id="createUserAccount"
                    checked={createUserAccount}
                    onCheckedChange={setCreateUserAccount}
                    disabled={isLoading || isUploading}
                  />
                  <div className="flex-1">
                    <Label htmlFor="createUserAccount" className="font-medium cursor-pointer">
                      {t("form.createUserAccount")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("form.createUserAccountHint")}
                    </p>
                  </div>
                </div>

                {createUserAccount && (
                  <ERPFormGrid cols={2}>
                    <ERPFormField label={t("form.loginEmail")} required error={errors.userEmail} htmlFor="userEmail">
                      <Input
                        id="userEmail"
                        type="email"
                        value={userEmail}
                        onChange={(e) => {
                          setUserEmail(e.target.value);
                          if (errors.userEmail) {
                            setErrors((prev) => ({ ...prev, userEmail: undefined }));
                          }
                        }}
                        placeholder={t("form.loginEmailPlaceholder")}
                        disabled={isLoading || isUploading}
                        aria-invalid={Boolean(errors.userEmail)}
                      />
                    </ERPFormField>
                    <ERPFormField label="Temporary Password" required error={errors.userPassword} htmlFor="userPassword">
                      <Input
                        id="userPassword"
                        type="password"
                        value={userPassword}
                        onChange={(e) => {
                          setUserPassword(e.target.value);
                          if (errors.userPassword) {
                            setErrors((prev) => ({ ...prev, userPassword: undefined }));
                          }
                        }}
                        placeholder="Min 6 characters"
                        disabled={isLoading || isUploading}
                        aria-invalid={Boolean(errors.userPassword)}
                      />
                    </ERPFormField>
                  </ERPFormGrid>
                )}
              </ERPFormSection>
            )}
          </div>
        </div>
      </form>

      <ImagePreviewModal
        isOpen={isImagePreviewOpen}
        onClose={() => setIsImagePreviewOpen(false)}
        src={formData.profilePictureUrl || (selectedFile ? URL.createObjectURL(selectedFile) : "")}
        alt={t("form.previewAlt")}
        title={t("form.previewTitle")}
      />
    </TopSheet>
  );
}
