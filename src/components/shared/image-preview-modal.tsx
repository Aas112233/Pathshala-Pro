"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  title?: string;
}

const ANIMATION_DURATION = 200;

export function ImagePreviewModal({
  isOpen,
  onClose,
  src,
  alt = "Image preview",
  title,
}: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  // Animation state
  const [isMounted, setIsMounted] = useState(false);
  const [animationState, setAnimationState] = useState<'entering' | 'open' | 'exiting' | 'closed'>('closed');

  // Open/close animation
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationState('entering');
          const timer = setTimeout(() => setAnimationState('open'), ANIMATION_DURATION);
          return () => clearTimeout(timer);
        });
      });
      document.body.style.overflow = "hidden";
    } else if (isMounted) {
      setAnimationState('exiting');
      const timer = setTimeout(() => {
        setAnimationState('closed');
        setIsMounted(false);
        document.body.style.overflow = "unset";
      }, ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "+":
        case "=":
          setScale((prev) => Math.min(prev + 0.25, 3));
          break;
        case "-":
          setScale((prev) => Math.max(prev - 0.25, 0.5));
          break;
        case "0":
          setScale(1);
          setPosition({ x: 0, y: 0 });
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartPosition({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - startPosition.x,
        y: e.clientY - startPosition.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  if (!isMounted || typeof document === "undefined") return null;

  const isVisible = animationState === 'entering' || animationState === 'open';

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center transition-colors",
        isVisible
          ? "bg-black/95 duration-200 ease-out"
          : "bg-black/0 duration-200 ease-in"
      )}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className={cn(
          "absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-all hover:bg-white/20",
          isVisible
            ? "opacity-100 scale-100 duration-200 ease-out"
            : "opacity-0 scale-90 duration-200 ease-in"
        )}
        aria-label="Close preview"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Title */}
      {title && (
        <div
          className={cn(
            "absolute left-4 top-4 z-10 text-white transition-all",
            isVisible
              ? "opacity-100 translate-y-0 duration-200 ease-out"
              : "opacity-0 -translate-y-2 duration-200 ease-in"
          )}
        >
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      )}

      {/* Image container */}
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden transition-all",
          isVisible
            ? "opacity-100 scale-100 duration-200 ease-out"
            : "opacity-0 scale-95 duration-200 ease-in"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={alt}
          className={cn(
            "max-h-full max-w-full object-contain transition-transform duration-200",
            scale > 1 && "cursor-grab active:cursor-grabbing"
          )}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
          }}
          draggable={false}
        />
      </div>

      {/* Zoom controls */}
      <div
        className={cn(
          "absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm transition-all",
          isVisible
            ? "opacity-100 translate-y-0 duration-200 ease-out"
            : "opacity-0 translate-y-4 duration-200 ease-in"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          className="h-9 w-9 rounded-full text-white hover:bg-white/20"
          disabled={scale <= 0.5}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        <span className="min-w-[60px] text-center text-sm font-medium text-white">
          {Math.round(scale * 100)}%
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          className="h-9 w-9 rounded-full text-white hover:bg-white/20"
          disabled={scale >= 3}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        <div className="mx-2 h-4 w-px bg-white/20" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRotate}
          className="h-9 w-9 rounded-full text-white hover:bg-white/20"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleReset}
          className="h-9 w-9 rounded-full text-white hover:bg-white/20"
        >
          <RotateCcw className="h-3 w-3" style={{ transform: "rotate(180deg)" }} />
        </Button>
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
        role="button"
        aria-label="Click outside to close"
      />
    </div>,
    document.body
  );
}
