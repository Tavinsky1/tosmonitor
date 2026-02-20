import Link from "next/link";
import { SeverityBadge } from "./SeverityBadge";
import { ArrowRight } from "lucide-react";

interface Change {
  id: string;
  title: string;
  summary: string;
  severity: "critical" | "major" | "minor" | "patch";
  service_name: string;
  detected_at: string;
}

export function ChangeCard({ change }: { change: Change }) {
  return (
    <Link
      href={`/dashboard/changes/${change.id}`}
      className="glass-card rounded-xl p-5 block group transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-display text-sm font-medium text-indigo-400">
              {change.service_name}
            </span>
            <span className="text-zinc-600">•</span>
            <SeverityBadge severity={change.severity} />
          </div>
          <h3 className="font-display text-base font-medium text-white mb-1 group-hover:text-indigo-300 transition-colors truncate">
            {change.title}
          </h3>
          <p className="text-body line-clamp-2">{change.summary}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
      </div>
      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
        <span className="label text-zinc-600">
          {new Date(change.detected_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="label text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
          View →
        </span>
      </div>
    </Link>
  );
}
