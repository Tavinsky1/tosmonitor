"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, logout } from "@/lib/api";
import { Shield, Menu, X } from "lucide-react";
import clsx from "clsx";

export function Navbar() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
  }, [pathname]);

  const navLinks = isLoggedIn
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/dashboard/services", label: "Services" },
        { href: "/dashboard/changes", label: "Changes" },
      ]
    : [
        { href: "/#features", label: "Features" },
        { href: "/#pricing", label: "Pricing" },
      ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl bg-background/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-shadow">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-lg font-semibold text-white tracking-tight">
            ToS<span className="text-indigo-400">Monitor</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "text-body transition-colors",
                pathname === link.href
                  ? "text-indigo-400"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {link.label}
            </Link>
          ))}

          {isLoggedIn ? (
            <button
              onClick={logout}
              className="btn-secondary px-4 py-2 rounded-lg text-body text-white"
            >
              Log out
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-body text-zinc-400 hover:text-white transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="btn-primary px-4 py-2 rounded-lg text-body text-white"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-background px-4 py-4 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-2 text-body text-zinc-400 hover:text-white transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {isLoggedIn ? (
            <button onClick={logout} className="mt-2 text-body text-zinc-400 hover:text-white transition-colors">
              Log out
            </button>
          ) : (
            <Link
              href="/register"
              className="mt-2 block btn-primary text-center px-4 py-2 rounded-lg text-body text-white"
              onClick={() => setMobileOpen(false)}
            >
              Get Started
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
