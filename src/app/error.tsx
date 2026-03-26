"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Optionally log this error to an error reporting service
    console.error("Global boundary caught an error: ", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-destructive/20 bg-card p-10 shadow-xl relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 -m-8 h-32 w-32 rounded-full bg-destructive/5 blur-2xl" />
        <div className="absolute bottom-0 left-0 -m-8 h-32 w-32 rounded-full bg-destructive/5 blur-2xl" />

        <div className="relative mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-10 w-10 text-destructive" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Something went wrong
        </h1>
        
        <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
          Pathshala Pro encountered an unexpected issue trying to render this section. Our technical team has been notified.
        </p>

        {/* Small error block snippet to aid debugging */}
        {error.message && (
          <div className="mb-8 rounded-md bg-muted/50 p-3 text-left border border-border">
            <code className="text-xs text-muted-foreground break-words line-clamp-3">
              {error.message}
            </code>
          </div>
        )}

        <div className="flex w-full flex-col gap-3 sm:flex-row justify-center">
          <Button 
            onClick={() => reset()} 
            size="lg"
            className="w-full sm:w-auto flex-1 font-semibold"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Try Again
          </Button>

          <Link href="/" className="w-full sm:w-auto flex-1">
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full font-semibold border-border bg-transparent text-foreground hover:bg-muted"
            >
              <Home className="mr-2 h-4 w-4" /> Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
