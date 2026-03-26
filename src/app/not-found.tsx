"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[100vh] w-full flex-col items-center justify-center p-8 bg-background text-center animate-in fade-in zoom-in duration-500">
      <div className="relative mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
        <span className="absolute text-8xl font-black text-primary/5 tracking-tighter">
          404
        </span>
        <SearchX className="h-16 w-16 text-primary relative z-10" strokeWidth={1.5} />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight mb-3 text-foreground">
        Page Not Found
      </h1>
      <p className="text-muted-foreground max-w-md mb-8 text-lg">
        The page you are looking for doesn&apos;t exist or has been moved. 
        It might be hidden deep in the archives.
      </p>
      <div className="flex gap-4">
        <Button 
          variant="outline" 
          size="lg" 
          className="rounded-full shadow-sm hover:shadow-md transition-all px-6"
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>
        <Link href="/">
          <Button 
            variant="default" 
            size="lg" 
            className="rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
          >
            Dashboard Setup
          </Button>
        </Link>
      </div>
    </div>
  );
}
