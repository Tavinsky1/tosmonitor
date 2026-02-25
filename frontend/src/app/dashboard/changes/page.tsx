"use client";

import { useQuery } from "@tanstack/react-query";
import { getChanges, warmup } from "@/lib/api";
import { ChangeCard } from "@/components/ChangeCard";
import { useState, useEffect } from "react";
import { Filter } from "lucide-react";
import clsx from "clsx";

const severityFilters = ["all", "critical", "major", "minor", "patch"] as const;

const severityColors: Record<string, { active: string; inactive: string }> = {
  all:      { active: "bg-brand-500 text-zinc-900", inactive: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" },
  critical: { active: "bg-rose-500/20 text-rose-400 border border-rose-500/40", inactive: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" },
  major:    { active: "bg-amber-500/20 text-amber-400 border border-amber-500/40", inactive: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" },
  minor:    { active: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40", inactive: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" },
  patch:    { active: "bg-slate-500/20 text-slate-400 border border-slate-500/40", inactive: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" },
};

export default function ChangesPage() {
  const [severity, setSeverity] = useState("all");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);

  // Cold warmup: trigger a scan if data is stale
  useEffect(() => {
    warmup().catch(() => {});
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["changes", severity, days, page],
    queryFn: () =>
      getChanges({
        severity: severity === "all" ? undefined : severity,
        days,
        page,
      }),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Change Feed</h1>
        <p className="text-sm text-gray-500">
          All detected policy changes across monitored services
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          {severityFilters.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSeverity(s);
                setPage(1);
              }}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition",
                severity === s
                  ? severityColors[s].active
                  : severityColors[s].inactive
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <select
          value={days}
          onChange={(e) => {
            setDays(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-brand-500 focus:outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Change list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Loading changes...
          </div>
        ) : data?.changes?.length ? (
          data.changes.map((change) => (
            <ChangeCard key={change.id} change={change} />
          ))
        ) : (
          <div className="glass-card rounded-xl border border-dashed border-zinc-700 p-12 text-center">
            <p className="text-sm text-zinc-500">
              No changes found for the selected filters.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {page} of {Math.ceil(data.total / 20)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * 20 >= data.total}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
