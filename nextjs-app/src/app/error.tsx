"use client";

import { useEffect } from "react";
import GlassButton from "@/components/ui/GlassButton";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-panel rounded-2xl p-8 max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white">Something went wrong</h2>
        <p className="text-sm text-white/50">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        {error.digest && (
          <p className="text-xs text-white/30 font-mono">Error ID: {error.digest}</p>
        )}
        <GlassButton onClick={reset}>Try Again</GlassButton>
      </div>
    </div>
  );
}
