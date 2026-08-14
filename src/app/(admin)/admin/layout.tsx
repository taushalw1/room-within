import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The security boundary for the whole admin area.
  const user = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-cream lg:flex-row">
      <AdminNav />

      <div className="min-w-0 flex-1">
        {isDemoMode && (
          <p className="border-b border-tan/30 bg-[#F6E9CF] px-6 py-2.5 text-center text-xs text-bark">
            Demo mode — no database connected, so these are sample figures.
            Add your Supabase details to see real data.
          </p>
        )}
        <div className="px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
        <p className="px-5 pb-8 text-center text-xs text-ink-faint sm:px-8">
          Signed in as {user.fullName}
        </p>
      </div>
    </div>
  );
}
