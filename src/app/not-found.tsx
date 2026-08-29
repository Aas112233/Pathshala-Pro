"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="flex min-h-[100vh] w-full flex-col items-center justify-center p-8 bg-background text-center animate-in fade-in zoom-in duration-500">
      <div className="relative mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
        <span className="absolute text-8xl font-black text-primary/5 tracking-tighter">
          404
        </span>
        <SearchX className="h-16 w-16 text-primary relative z-10" strokeWidth={1.5} />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-3 text-foreground">
              {t("title")}
            </h1>
            <p className="text-muted-foreground max-w-md mb-8 text-lg">
              {t("description")}
            </p>
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full shadow-sm hover:shadow-md transition-all px-6"
                onClick={() => window.history.back()}
              >
                {t("goBack")}
              </Button>
              <Link href="/">
                <Button
                  variant="default"
                  size="lg"
                  className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                >
                  {t("dashboardSetup")}
                </Button>
              </Link>
            </div>
    </div>
  );
}
