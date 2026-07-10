import { MainLayout } from "@/components/layout";
import { ConfirmDialog } from "@/components/ui/confirm";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MainLayout>
      {children}
      <ConfirmDialog />
    </MainLayout>
  );
}
