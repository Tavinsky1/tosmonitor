"use client";

import { useQuery } from "@tanstack/react-query";
import { getPublicFeed } from "@/lib/api";
import { SeverityBadge } from "@/components/SeverityBadge";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";

export function RecentChangesPreview() {
  const { data: changes, isLoading } = useQuery({
    queryKey: ["public-feed"],
    queryFn: () => getPublicFeed(5),
    staleTime: 60_000,
  });

  return (
    <section className="border-t border-gray-100 bg-white py-20">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Radio className="h-4 w-4 text-red-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-red-500">
                Live Feed
              </span>
            </div>
            <h2 className="text-2xl font-bold text-brand-900">
              Recent Changes We Caught
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Real policy changes detected by our scanner
            </p>
          </div>
          <Link
            href="/dashboard/changes"
            className="hidden items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 sm:flex"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl border border-gray-100 bg-gray-50"
              />
            ))}
          </div>
        ) : changes?.length ? (
          <div className="space-y-3">
            {changes.map((change) => (
              <Link
                key={change.id}
                href={`/dashboard/changes/${change.id}`}
                className="group block rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition hover:border-brand-200 hover:bg-brand-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <SeverityBadge
                        severity={change.severity as any}
                        size="sm"
                      />
                      <span className="text-xs font-medium text-gray-400">
                        {change.service}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium text-gray-800 group-hover:text-brand-700">
                      {change.title}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
                      {change.summary}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatDistanceToNow(new Date(change.detected_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
            <p className="text-sm text-gray-500">
              No changes detected yet — the scanner runs every 6 hours.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              When a service updates their terms, it'll appear here in real time.
            </p>
          </div>
        )}

        <Link
          href="/dashboard/changes"
          className="mt-6 flex items-center justify-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:hidden"
        >
          View all changes <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
