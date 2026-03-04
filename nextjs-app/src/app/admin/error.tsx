"use client";

import { useEffect } from "react";
import GlassButton from "@/components/ui/GlassButton";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="glass-panel p-8 max-w-lg w-full text-center border border-orange-500/20">
        <div className="w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Admin Error</h2>
        <p className="text-white/50 text-sm mb-2">
          {error.message || "An unexpected error occurred in the admin console."}
        </p>
        {error.digest && (
          <p className="text-xs text-white/30 font-mono mb-6">Error ID: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-4">
          <GlassButton onClick={reset}>Try Again</GlassButton>
          <a href="/admin" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            Admin Home
          </a>
          <a href="/" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
