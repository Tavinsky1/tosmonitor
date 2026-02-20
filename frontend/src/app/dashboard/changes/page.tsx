"use client";

import { useQuery } from "@tanstack/react-query";
import { getChanges } from "@/lib/api";
import { ChangeCard } from "@/components/ChangeCard";
import { useState } from "react";
import { Filter } from "lucide-react";
import clsx from "clsx";

const severityFilters = ["all", "critical", "major", "minor", "patch"];

export default function ChangesPage() {
  const [severity, setSeverity] = useState("all");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);

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
        <h1 className="text-2xl font-bold text-brand-900">Change Feed</h1>
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
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
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
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">
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
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {Math.ceil(data.total / 20)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * 20 >= data.total}
            className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
