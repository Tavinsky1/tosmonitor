import Link from "next/link";
import { Shield, Home, FileText, Grid } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <nav className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-14 items-center justify-between">
            {/* Left: logo/home */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                title="Back to home"
              >
                <Home className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">Home</span>
              </Link>

              <div className="h-4 w-px bg-white/10" />

              <Link href="/" className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-400" />
                <span className="font-semibold text-white text-sm">ToS Monitor</span>
              </Link>
            </div>

            {/* Right: nav links */}
            <div className="flex items-center gap-1">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
              >
                <Grid className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </Link>
              <Link
                href="/dashboard/changes"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Changes</span>
              </Link>
              <Link
                href="/dashboard/services"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white transition-all"
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Services</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
