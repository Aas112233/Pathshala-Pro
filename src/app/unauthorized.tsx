"use client";

import Link from "next/link";
import { LogInIcon, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-red-500/10 blur-xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-red-100 border-4 border-white shadow-xl">
          <LockKeyhole className="h-10 w-10 text-red-600" />
        </div>
      </div>
      
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-red-600">
        401 Unauthorized
      </h1>
      
      <h2 className="mb-4 text-lg font-medium text-foreground">
        Authentication Required
      </h2>
      
      <p className="mx-auto mb-8 max-w-sm text-sm text-muted-foreground leading-relaxed">
        You must be logged in to access this Pathshala Pro module. If you believe this is an error, please ensure your session hasn't expired.
      </p>
      
      <div className="flex w-full max-w-sm gap-3 sm:flex-row flex-col">
        <Link href="/login" className="w-full">
          <Button size="lg" className="w-full">
            <LogInIcon className="mr-2 h-4 w-4" /> Go to Login
          </Button>
        </Link>
      </div>
    </div>
  );
}
