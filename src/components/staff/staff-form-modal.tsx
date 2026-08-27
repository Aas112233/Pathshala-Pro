"use client";

import { useState, useCallback, useEffect } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clsx } from "clsx";
import { toast } from "sonner";
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
}

export function StaffFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false,
}: StaffFormModalProps) {
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
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.department.trim()) {
      newErrors.department = "Department is required";
    }

    if (!formData.designation.trim()) {
      newErrors.designation = "Designation is required";
    }

    if (!formData.hireDate) {
      newErrors.hireDate = "Hire date is required";
    }

    if (formData.baseSalary < 0) {
      newErrors.baseSalary = "Base salary must be non-negative";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (formData.phone && !/^\d{10,}$/.test(formData.phone.replace(/\s/g, ""))) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (createUserAccount) {
      if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        newErrors.userEmail = "Valid email is required for user account";
      }
      if (!userPassword || userPassword.length < 6) {
        newErrors.userPassword = "Password must be at least 6 characters";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, createUserAccount, userEmail, userPassword]);

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

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large. Max size is 5MB.");
        e.target.value = "";
        return;
      }
      setSelectedFile(file);
      setIsUploading(true);
      setUploadProgress(0);

      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("fileType", "staff_profiles");

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
          setTempFileId(response.data.fileId);
          toast.success("Image uploaded successfully!");
        } else {
          let errMsg = "Failed to upload image. Please try again.";
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
        toast.error("Network error during upload.");
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
      toast.error("Please wait for the image upload to complete.");
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
      title={isEditing ? "Edit Staff Member" : "Add New Staff Member"}
      description={isEditing ? "Update staff member information." : "Create a new staff member profile in the system."}
      maxWidth="5xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" type="button" onClick={handleModalClose} disabled={isLoading || isUploading}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" disabled={isLoading || isUploading}>
            {isLoading ? "Saving..." : isUploading ? "Uploading file..." : isEditing ? "Update Staff" : "Save Staff"}
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
              <label className="text-xs font-semibold text-foreground/90">Staff Photo</label>
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
                      aria-label="Click to preview image"
                    >
                      <img
                        src={formData.profilePictureUrl || (selectedFile ? URL.createObjectURL(selectedFile) : "")}
                        alt="Staff preview"
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
                  <span className="font-semibold text-xs text-center">{selectedFile ? selectedFile.name : (formData.profilePictureUrl ? "Change Photo" : "Upload Photo")}</span>
                  <span className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</span>

                  {isUploading && (
                    <div className="w-full mt-2 space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uploading...</span>
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
            <ERPFormSection title="Basic Information">
              <ERPFormGrid cols={2}>
                <ERPFormField label="Staff ID" helperText="Format: STAFF-YYYY-####">
                  <div className="px-3 py-2 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                    Auto-generated on save
                  </div>
                </ERPFormField>

                <ERPFormField label="Gender" htmlFor="gender">
                  <AppDropdown
                    value={formData.gender || "MALE"}
                    onChange={(val) => handleDropdownChange("gender", val)}
                    disabled={isLoading || isUploading}
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ]}
                  />
                </ERPFormField>

                <ERPFormField label="First Name" required error={errors.firstName} htmlFor="firstName">
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="First name"
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.firstName)}
                  />
                </ERPFormField>
                <ERPFormField label="Last Name" required error={errors.lastName} htmlFor="lastName">
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last name"
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.lastName)}
                  />
                </ERPFormField>

                {/* Bengali Name Fields */}
                <ERPFormField label="First Name (Second Language)" htmlFor="firstNameBn">
                  <Input
                    id="firstNameBn"
                    name="firstNameBn"
                    value={formData.firstNameBn}
                    onChange={handleChange}
                    placeholder="প্রথম নাম"
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
                <ERPFormField label="Last Name (Second Language)" htmlFor="lastNameBn">
                  <Input
                    id="lastNameBn"
                    name="lastNameBn"
                    value={formData.lastNameBn}
                    onChange={handleChange}
                    placeholder="শেষ নাম"
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>

                <ERPFormField label="Date of Birth" htmlFor="dateOfBirth">
                  <Input
                    id="dateOfBirth"
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
                <ERPFormField label="Address" htmlFor="address">
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Full address"
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
              </ERPFormGrid>
            </ERPFormSection>

            {/* Employment Information */}
            <ERPFormSection title="Employment Information">
              <ERPFormGrid cols={2}>
                <ERPFormField label="Department" required error={errors.department} htmlFor="department">
                  <Input
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="e.g. Teaching, Administration"
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.department)}
                  />
                </ERPFormField>
                <ERPFormField label="Designation" required error={errors.designation} htmlFor="designation">
                  <Input
                    id="designation"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="e.g. Senior Teacher, Principal"
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.designation)}
                  />
                </ERPFormField>

                <ERPFormField label="Hire Date" required error={errors.hireDate} htmlFor="hireDate">
                  <Input
                    id="hireDate"
                    type="date"
                    name="hireDate"
                    value={formData.hireDate}
                    onChange={handleChange}
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.hireDate)}
                  />
                </ERPFormField>
                <ERPFormField label="Joining Date" htmlFor="joiningDate">
                  <Input
                    id="joiningDate"
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate}
                    onChange={handleChange}
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>

                <ERPFormField label="Qualification" htmlFor="qualification">
                  <Input
                    id="qualification"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    placeholder="e.g. M.Ed, B.Ed"
                    disabled={isLoading || isUploading}
                  />
                </ERPFormField>
                <ERPFormField label="Base Salary" error={errors.baseSalary} htmlFor="baseSalary">
                  <Input
                    id="baseSalary"
                    type="number"
                    name="baseSalary"
                    value={formData.baseSalary}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.baseSalary)}
                  />
                </ERPFormField>
              </ERPFormGrid>

              <ERPFormField label="Status" htmlFor="isActive">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    disabled={isLoading || isUploading}
                  />
                  <span className="text-sm">{formData.isActive ? "Active" : "Inactive"}</span>
                </div>
              </ERPFormField>
            </ERPFormSection>

            {/* Contact Information */}
            <ERPFormSection title="Contact Information">
              <ERPFormGrid cols={2}>
                <ERPFormField label="Email" error={errors.email} htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="staff@school.edu"
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.email)}
                  />
                </ERPFormField>
                <ERPFormField label="Phone" error={errors.phone} htmlFor="phone">
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+880-XXX-XXXXXX"
                    disabled={isLoading || isUploading}
                    aria-invalid={Boolean(errors.phone)}
                  />
                </ERPFormField>
              </ERPFormGrid>
            </ERPFormSection>

            {/* User Account Creation */}
            {!isEditing && (
              <ERPFormSection title="User Account">
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Switch
                    id="createUserAccount"
                    checked={createUserAccount}
                    onCheckedChange={setCreateUserAccount}
                    disabled={isLoading || isUploading}
                  />
                  <div className="flex-1">
                    <Label htmlFor="createUserAccount" className="font-medium cursor-pointer">
                      Create login account for this staff member
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      This will allow the staff member to access the system
                    </p>
                  </div>
                </div>

                {createUserAccount && (
                  <ERPFormGrid cols={2}>
                    <ERPFormField label="Login Email" required error={errors.userEmail} htmlFor="userEmail">
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
                        placeholder="staff@school.edu"
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
        alt="Staff photo preview"
        title="Staff Photo"
      />
    </TopSheet>
  );
}
