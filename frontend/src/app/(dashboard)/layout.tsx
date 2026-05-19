import Sidebar from '@/components/Sidebar';
import { ConfirmProvider } from '@/components/ConfirmDialog';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <div className="flex min-h-screen bg-[var(--color-background)]">
        <Sidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
          {children}
        </main>
      </div>
    </ConfirmProvider>
  );
}
