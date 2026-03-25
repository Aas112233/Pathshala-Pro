"use client";

import { type ReactNode } from "react";
import {
  useForm,
  FormProvider,
  type DefaultValues,
  type FieldValues,
  type SubmitHandler,
  type Path,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ZodSchema } from "zod";
import { cn } from "@/lib/utils";

interface FormWrapperProps<T extends FieldValues> {
  schema: ZodSchema<T>;
  defaultValues?: DefaultValues<T>;
  onSubmit: SubmitHandler<T>;
  children: ReactNode;
  className?: string;
}

export function FormWrapper<T extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
}: FormWrapperProps<T>) {
  const methods = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className={cn("space-y-4", className)}
        noValidate
      >
        {children}
      </form>
    </FormProvider>
  );
}

// Companion component for individual form fields
interface FormFieldProps {
  name: string;
  label: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  name,
  label,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={name}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
