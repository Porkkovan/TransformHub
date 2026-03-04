"use client";

import AmbientBackground from "./AmbientBackground";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { OrganizationProvider } from "@/contexts/OrganizationContext";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OrganizationProvider>
      <div className="min-h-screen">
        <AmbientBackground />
        <Sidebar />
        <TopBar />
        <main className="ml-64 mt-16 p-8">
          {children}
        </main>
      </div>
    </OrganizationProvider>
  );
}
