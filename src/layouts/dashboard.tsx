import { Sidebar } from "@/components/dashboard-sidebar";
import { CustomTitlebar } from "@/components/custom-titlebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen bg-background">
      <CustomTitlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 pt-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
