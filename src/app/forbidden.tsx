"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from 'next-intl';

export default function Forbidden() {
  const t = useTranslations('ForbiddenPage');

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-orange-500/10 blur-xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-orange-100 border-4 border-white shadow-xl">
          <ShieldAlert className="h-10 w-10 text-orange-600" />
        </div>
      </div>
      
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-orange-600">
        {t("title")}
      </h1>
      
      <h2 className="mb-4 text-lg font-medium text-foreground">
        {t("subtitle")}
      </h2>
      
      <p className="mx-auto mb-8 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {t("message")}
      </p>
      
      <div className="flex w-full max-w-sm gap-3 sm:flex-row flex-col justify-center">
        <Link href="/">
          <Button size="lg" className="w-full sm:w-auto">
            {t("dashboard")}
          </Button>
        </Link>
        <Button 
          variant="outline" 
          size="lg" 
          className="w-full sm:w-auto"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("goBack")}
        </Button>
      </div>
    </div>
  );
}
