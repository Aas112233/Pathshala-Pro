"use client";

import { useState, useCallback, useEffect } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import { cn } from "@/lib/utils";
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
  });

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
      newErrors.rollNumber = "Roll number is required";
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.guardianName.trim()) {
      newErrors.guardianName = "Guardian name is required";
    }

    if (!formData.guardianContact.trim()) {
      newErrors.guardianContact = "Guardian contact is required";
    } else if (!/^\d{10,}$/.test(formData.guardianContact.replace(/\s/g, ""))) {
      newErrors.guardianContact = "Please enter a valid phone number";
    }

    if (formData.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail)) {
      newErrors.guardianEmail = "Please enter a valid email address";
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
        toast.error("File is too large. Max size is 5MB.");
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
      title={isEditing ? "Edit Student" : "Add New Student"}
      description={isEditing ? "Update student information." : "Create a new student profile in the system."}
      maxWidth="4xl"
      className="max-h-[90vh]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photo Upload */}
          <div className="lg:col-span-1">
            <div className="sticky top-0">
              <label className="text-sm font-medium mb-2 block">Student Photo</label>
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
                        alt="Student preview"
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
          <div className="lg:col-span-2 space-y-4">
            {/* Basic Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Roll Number <span className="text-destructive">*</span></label>
                  <input
                    required
                    name="rollNumber"
                    value={formData.rollNumber}
                    onChange={handleChange}
                    placeholder="e.g. 2026004"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.rollNumber && "border-destructive focus:ring-destructive")}
                  />
                  {errors.rollNumber && <p className={errorClass}>{errors.rollNumber}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Gender</label>
                  <AppDropdown
                    value={formData.gender}
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
                  <label className={labelClass}>First Name <span className="text-destructive">*</span></label>
                  <input
                    required
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
                  <label className={labelClass}>Last Name <span className="text-destructive">*</span></label>
                  <input
                    required
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
                  <label className={labelClass}>First Name (Second Language)</label>
                  <input
                    name="firstNameBn"
                    value={formData.firstNameBn}
                    onChange={handleChange}
                    placeholder="প্রথম নাম"
                    disabled={isLoading || isUploading}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Last Name (Second Language)</label>
                  <input
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
                  <label className={labelClass}>Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    disabled={isLoading || isUploading}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Address</label>
                  <input
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

            {/* Guardian Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground border-b pb-2">Guardian Information</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Guardian Name <span className="text-destructive">*</span></label>
                  <input
                    required
                    name="guardianName"
                    value={formData.guardianName}
                    onChange={handleChange}
                    placeholder="Full name"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.guardianName && "border-destructive focus:ring-destructive")}
                  />
                  {errors.guardianName && <p className={errorClass}>{errors.guardianName}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Guardian Contact <span className="text-destructive">*</span></label>
                  <input
                    required
                    name="guardianContact"
                    value={formData.guardianContact}
                    onChange={handleChange}
                    placeholder="Phone number"
                    disabled={isLoading || isUploading}
                    className={clsx(inputClass, errors.guardianContact && "border-destructive focus:ring-destructive")}
                  />
                  {errors.guardianContact && <p className={errorClass}>{errors.guardianContact}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Guardian Email</label>
                <input
                  type="email"
                  name="guardianEmail"
                  value={formData.guardianEmail}
                  onChange={handleChange}
                  placeholder="Email address"
                  disabled={isLoading || isUploading}
                  className={clsx(inputClass, errors.guardianEmail && "border-destructive focus:ring-destructive")}
                />
                {errors.guardianEmail && <p className={errorClass}>{errors.guardianEmail}</p>}
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Status</label>
                <AppDropdown
                  value={formData.status}
                  onChange={(val) => handleDropdownChange("status", val)}
                  disabled={isLoading || isUploading}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                    { value: "SUSPENDED", label: "Suspended" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-4 sticky bottom-0 bg-background">
          <Button variant="outline" type="button" onClick={handleModalClose} disabled={isLoading || isUploading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || isUploading}>
            {isLoading ? "Saving..." : isUploading ? "Uploading file..." : isEditing ? "Update Student" : "Save Student"}
          </Button>
        </div>
      </form>

      <ImagePreviewModal
        isOpen={isImagePreviewOpen}
        onClose={() => setIsImagePreviewOpen(false)}
        src={formData.profilePictureUrl || (selectedFile ? URL.createObjectURL(selectedFile) : "")}
        alt="Student photo preview"
        title="Student Photo"
      />
    </AppModal>
  );
}
