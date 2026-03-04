"use client";

import AmbientBackground from "@/components/layout/AmbientBackground";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AmbientBackground />
      <Sidebar />
      <TopBar />
      <main className="ml-64 mt-16 p-8">{children}</main>
    </div>
  );
}
