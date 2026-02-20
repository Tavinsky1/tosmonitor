"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, getChanges, getMySubscriptions, getMe } from "@/lib/api";
import { ChangeCard } from "@/components/ChangeCard";
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Bell,
  Activity,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
  });

  const { data: recentChanges } = useQuery({
    queryKey: ["recent-changes"],
    queryFn: () => getChanges({ days: 7, page: 1 }),
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: getMySubscriptions,
  });

  const statCards = [
    {
      label: "Services Monitored",
      value: stats?.total_services_monitored ?? "—",
      icon: Shield,
      color: "text-indigo-400",
    },
    {
      label: "Changes (7 days)",
      value: stats?.changes_last_7_days ?? "—",
      icon: TrendingUp,
      color: "text-emerald-400",
    },
    {
      label: "Critical Alerts",
      value: stats?.critical_changes_unread ?? "—",
      icon: AlertTriangle,
      color: "text-rose-400",
    },
    {
      label: "Subscriptions",
      value: stats?.user_subscriptions ?? "—",
      icon: Bell,
      color: "text-amber-400",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="headline-medium text-white">Dashboard</h1>
            {user?.plan && (
              <span className="label px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {user.plan.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-body">
            Overview of policy changes across your monitored services
          </p>
        </div>

        {/* Stats grid */}
        <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="glass-card rounded-xl p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="label text-zinc-500">
                  {stat.label}
                </span>
              </div>
              <p className="headline-medium text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Recent changes */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="headline-small text-white">
                Recent Changes
              </h2>
              <Link
                href="/dashboard/changes"
                className="text-body font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View all →
              </Link>
            </div>

            <div className="space-y-3">
              {recentChanges?.changes?.length ? (
                recentChanges.changes.slice(0, 5).map((change) => (
                  <ChangeCard key={change.id} change={change} />
                ))
              ) : (
                <div className="glass-card rounded-xl border border-dashed border-white/10 p-10 text-center">
                  <Activity className="mx-auto mb-4 h-10 w-10 text-zinc-600" />
                  <p className="text-body mb-2">
                    No changes detected yet
                  </p>
                  <p className="text-small">
                    The scanner runs every 6 hours. Subscribe to services to get notified.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Subscriptions sidebar */}
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="headline-small text-white">
                Your Subscriptions
              </h2>
              <Link
                href="/dashboard/services"
                className="text-body font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Manage →
              </Link>
            </div>

            <div className="glass-card rounded-xl p-5">
              {subscriptions?.length ? (
                <ul className="divide-y divide-white/10">
                  {subscriptions.map((sub: any) => (
                    <li
                      key={sub.id}
                      className="flex items-center justify-between py-3"
                    >
                      <span className="font-display text-sm font-medium text-zinc-300">
                        {sub.service_name}
                      </span>
                      {sub.notify_email && (
                        <span className="label px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          Email
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-8 text-center">
                  <Bell className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                  <p className="text-small mb-3">No subscriptions yet</p>
                  <Link
                    href="/dashboard/services"
                    className="inline-block text-body font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Browse services →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
