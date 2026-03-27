"use client";

import { useState, useCallback, useEffect } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clsx } from "clsx";
import { cn } from "@/lib/utils";
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
      await onSubmit(formData);

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

  const inputClass = cn(
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary",
    "transition-colors duration-200"
  );

  const labelClass = "text-sm font-medium";
  const errorClass = "text-xs text-destructive mt-1";

  const handleModalClose = useCallback(() => {
    cleanupTempFile();
    onClose();
  }, [cleanupTempFile, onClose]);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={isEditing ? "Edit Staff Member" : "Add New Staff Member"}
      description={isEditing ? "Update staff member information." : "Create a new staff member profile in the system."}
      maxWidth="5xl"
      className="max-h-[90vh]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Photo Upload */}
          <div className="lg:col-span-1">
            <div className="sticky top-0">
              <label className="text-sm font-medium mb-2 block">Staff Photo</label>
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
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={labelClass}>Staff ID</Label>
                  <div className="px-3 py-2 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                    Auto-generated on save
                  </div>
                  <p className="text-xs text-muted-foreground">Format: STAFF-YYYY-####</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gender" className={labelClass}>Gender</Label>
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
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className={labelClass}>First Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="First name"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.firstName && "border-destructive focus:ring-destructive")}
                  />
                  {errors.firstName && <p className={errorClass}>{errors.firstName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className={labelClass}>Last Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last name"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.lastName && "border-destructive focus:ring-destructive")}
                  />
                  {errors.lastName && <p className={errorClass}>{errors.lastName}</p>}
                </div>
              </div>

              {/* Bengali Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstNameBn" className={labelClass}>First Name (Second Language)</Label>
                  <Input
                    id="firstNameBn"
                    name="firstNameBn"
                    value={formData.firstNameBn}
                    onChange={handleChange}
                    placeholder="প্রথম নাম"
                    disabled={isLoading || isUploading}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastNameBn" className={labelClass}>Last Name (Second Language)</Label>
                  <Input
                    id="lastNameBn"
                    name="lastNameBn"
                    value={formData.lastNameBn}
                    onChange={handleChange}
                    placeholder="শেষ নাম"
                    disabled={isLoading || isUploading}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth" className={labelClass}>Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    disabled={isLoading || isUploading}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address" className={labelClass}>Address</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Full address"
                    disabled={isLoading || isUploading}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Employment Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground border-b pb-2">Employment Information</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="department" className={labelClass}>Department <span className="text-destructive">*</span></Label>
                  <Input
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="e.g. Teaching, Administration"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.department && "border-destructive focus:ring-destructive")}
                  />
                  {errors.department && <p className={errorClass}>{errors.department}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="designation" className={labelClass}>Designation <span className="text-destructive">*</span></Label>
                  <Input
                    id="designation"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="e.g. Senior Teacher, Principal"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.designation && "border-destructive focus:ring-destructive")}
                  />
                  {errors.designation && <p className={errorClass}>{errors.designation}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hireDate" className={labelClass}>Hire Date <span className="text-destructive">*</span></Label>
                  <Input
                    id="hireDate"
                    type="date"
                    name="hireDate"
                    value={formData.hireDate}
                    onChange={handleChange}
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.hireDate && "border-destructive focus:ring-destructive")}
                  />
                  {errors.hireDate && <p className={errorClass}>{errors.hireDate}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="joiningDate" className={labelClass}>Joining Date</Label>
                  <Input
                    id="joiningDate"
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate}
                    onChange={handleChange}
                    disabled={isLoading || isUploading}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qualification" className={labelClass}>Qualification</Label>
                  <Input
                    id="qualification"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    placeholder="e.g. M.Ed, B.Ed"
                    disabled={isLoading || isUploading}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="baseSalary" className={labelClass}>Base Salary</Label>
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
                    className={clsx(inputClass, errors.baseSalary && "border-destructive focus:ring-destructive")}
                  />
                  {errors.baseSalary && <p className={errorClass}>{errors.baseSalary}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="isActive" className={labelClass}>Status</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    disabled={isLoading || isUploading}
                  />
                  <span className="text-sm">{formData.isActive ? "Active" : "Inactive"}</span>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground border-b pb-2">Contact Information</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className={labelClass}>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="staff@school.edu"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.email && "border-destructive focus:ring-destructive")}
                  />
                  {errors.email && <p className={errorClass}>{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className={labelClass}>Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+880-XXX-XXXXXX"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.phone && "border-destructive focus:ring-destructive")}
                  />
                  {errors.phone && <p className={errorClass}>{errors.phone}</p>}
                </div>
              </div>
            </div>

            {/* User Account Creation */}
            {!isEditing && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground border-b pb-2">User Account</h4>

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
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/10">
                    <div className="space-y-1.5">
                      <Label htmlFor="userEmail" className={labelClass}>Login Email <span className="text-destructive">*</span></Label>
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
                        className={cn(inputClass, errors.userEmail && "border-destructive focus:ring-destructive")}
                      />
                      {errors.userEmail && <p className={errorClass}>{errors.userEmail}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="userPassword" className={labelClass}>Temporary Password <span className="text-destructive">*</span></Label>
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
                        className={cn(inputClass, errors.userPassword && "border-destructive focus:ring-destructive")}
                      />
                      {errors.userPassword && <p className={errorClass}>{errors.userPassword}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-4 sticky bottom-0 bg-background">
          <Button variant="outline" type="button" onClick={handleModalClose} disabled={isLoading || isUploading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || isUploading}>
            {isLoading ? "Saving..." : isUploading ? "Uploading file..." : isEditing ? "Update Staff" : "Save Staff"}
          </Button>
        </div>
      </form>

      <ImagePreviewModal
        isOpen={isImagePreviewOpen}
        onClose={() => setIsImagePreviewOpen(false)}
        src={formData.profilePictureUrl || (selectedFile ? URL.createObjectURL(selectedFile) : "")}
        alt="Staff photo preview"
        title="Staff Photo"
      />
    </AppModal>
  );
}
