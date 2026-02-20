"use client";

import { useQuery } from "@tanstack/react-query";
import { getChange } from "@/lib/api";
import { SeverityBadge } from "@/components/SeverityBadge";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeft, FileDiff, Plus, Minus, Clock } from "lucide-react";
import Link from "next/link";
import { use } from "react";

export default function ChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: change, isLoading } = useQuery({
    queryKey: ["change", id],
    queryFn: () => getChange(id),
  });

  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-gray-400">
        Loading change details...
      </div>
    );
  }

  if (!change) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">
        Change not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/dashboard/changes"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to changes
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SeverityBadge severity={change.severity} size="lg" />
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {change.change_type.replace("_", " ")}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-brand-900">{change.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {change.service_name} ·{" "}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(change.detected_at), "PPP 'at' p")}
          </span>{" "}
          ({formatDistanceToNow(new Date(change.detected_at), { addSuffix: true })})
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Summary</h2>
        <p className="leading-relaxed text-gray-700">{change.summary}</p>

        <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <FileDiff className="h-4 w-4" />
            {change.sections_changed} section
            {change.sections_changed !== 1 && "s"} changed
          </span>
          <span className="flex items-center gap-1 text-green-600">
            <Plus className="h-4 w-4" />
            {change.words_added} words added
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <Minus className="h-4 w-4" />
            {change.words_removed} words removed
          </span>
        </div>
      </div>

      {/* Diff viewer (gated for free users) */}
      {change.diff_html ? (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Visual Diff
          </h2>
          <div
            className="prose prose-sm max-w-none overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: change.diff_html }}
          />
        </div>
      ) : change.upgrade_hint ? (
        <div className="mb-6">
          <UpgradeBanner message={change.upgrade_hint} />
        </div>
      ) : null}

      {/* Raw content (if available) */}
      {change.old_content && change.new_content && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Full Content Comparison
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-medium text-red-600">
                Previous Version
              </h3>
              <pre className="max-h-96 overflow-auto rounded-lg bg-red-50 p-4 text-xs leading-relaxed text-gray-700">
                {change.old_content.slice(0, 5000)}
                {change.old_content.length > 5000 && "\n\n... (truncated)"}
              </pre>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium text-green-600">
                Current Version
              </h3>
              <pre className="max-h-96 overflow-auto rounded-lg bg-green-50 p-4 text-xs leading-relaxed text-gray-700">
                {change.new_content.slice(0, 5000)}
                {change.new_content.length > 5000 && "\n\n... (truncated)"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
