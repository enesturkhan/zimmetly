import { AuthGuard } from "@/components/AuthGuard";
import { PendingCountProvider } from "@/components/PendingCountProvider";
import { AppNavbar } from "@/components/AppNavbar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <PendingCountProvider>
        <AppNavbar />
        {children}
      </PendingCountProvider>
    </AuthGuard>
  );
}
