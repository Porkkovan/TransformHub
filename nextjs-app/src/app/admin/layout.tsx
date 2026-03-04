"use client";

import AmbientBackground from "@/components/layout/AmbientBackground";
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopBar from "@/components/layout/TopBar";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Show nothing while auth is loading to prevent flash
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AmbientBackground />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
      </div>
    );
  }

  // RBAC: VIEWER role cannot access admin pages
  if (user && user.role === "VIEWER") {
    return (
      <div className="min-h-screen">
        <AmbientBackground />
        <div className="flex items-center justify-center min-h-screen">
          <div className="glass-panel p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-white/50 text-sm mb-6">
              You don&apos;t have permission to access the admin console. Contact your administrator to request elevated access.
            </p>
            <a
              href="/"
              className="glass-button inline-block"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AmbientBackground />
      <AdminSidebar />
      <TopBar />
      <main className="ml-64 mt-16 p-8">{children}</main>
    </div>
  );
}
