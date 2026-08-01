import { useState } from "react";
import { useLocation } from "react-router-dom";
import { CustomTitlebar } from "@/components/custom-titlebar";
import { Sidebar } from "@/components/dashboard-sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-background">
      <CustomTitlebar />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex w-72 shrink-0 border-r border-separator/70 glass-surface">
          <Sidebar />
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm animate-fade-in"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
              role="button"
            />
            <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 glass-surface-strong border-r border-separator/70 animate-slide-in-right">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 pt-6">
            <div key={location.pathname} className="page-transition-enter h-full min-h-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile menu trigger — 放在 overflow-hidden 容器外避免 position:fixed 被限制 */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-30 p-3.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </button>
    </div>
  );
}
