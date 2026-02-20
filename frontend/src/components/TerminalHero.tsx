"use client";

import { useEffect, useState } from "react";

interface LogLine {
  text: string;
  color: "green" | "yellow" | "red" | "gray" | "blue";
  delay: number;
}

const SCAN_LINES: LogLine[] = [
  { text: "$ tos-monitor scan --all", color: "blue", delay: 0 },
  { text: "", color: "gray", delay: 400 },
  { text: "⏳ Scanning 20 services...", color: "gray", delay: 800 },
  { text: "", color: "gray", delay: 1200 },
  { text: "✓ Stripe ToS ................... no changes", color: "green", delay: 1600 },
  { text: "✓ AWS Service Terms ............ no changes", color: "green", delay: 2000 },
  { text: "✓ Vercel ToS ................... no changes", color: "green", delay: 2400 },
  { text: "⚠ OpenAI Privacy Policy ........ CHANGED", color: "yellow", delay: 2900 },
  { text: '  → "Added clause: user content may be used for model training"', color: "yellow", delay: 3400 },
  { text: "  → Severity: MAJOR · 3 sections · +847 words", color: "yellow", delay: 3800 },
  { text: "", color: "gray", delay: 4100 },
  { text: "✓ GitHub ToS ................... no changes", color: "green", delay: 4400 },
  { text: "✓ Cloudflare Privacy ........... no changes", color: "green", delay: 4800 },
  { text: "🔴 Notion Terms of Service ...... CHANGED", color: "red", delay: 5300 },
  { text: '  → "New data sharing agreement with third-party AI providers"', color: "red", delay: 5800 },
  { text: "  → Severity: CRITICAL · 5 sections · +1,203 words", color: "red", delay: 6200 },
  { text: "", color: "gray", delay: 6500 },
  { text: "✓ Supabase ToS ................. no changes", color: "green", delay: 6800 },
  { text: "✓ Firebase ToS ................. no changes", color: "green", delay: 7100 },
  { text: "", color: "gray", delay: 7400 },
  { text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", color: "gray", delay: 7700 },
  { text: "Scan complete: 20 services · 2 changes detected", color: "blue", delay: 8000 },
  { text: "📧 Alerts sent to 142 subscribers", color: "blue", delay: 8400 },
];

const COLOR_MAP = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
  gray: "text-gray-500",
  blue: "text-sky-400",
};

export function TerminalHero() {
  const [visibleLines, setVisibleLines] = useState<number>(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    SCAN_LINES.forEach((line, i) => {
      const timer = setTimeout(() => {
        setVisibleLines((prev) => Math.max(prev, i + 1));
      }, line.delay);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="mx-auto mt-12 max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-2xl shadow-brand-500/5">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs text-gray-500">tos-monitor — zsh</span>
        </div>

        {/* Terminal body */}
        <div className="h-[360px] overflow-hidden p-4 font-mono text-[13px] leading-relaxed">
          {SCAN_LINES.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className={`${COLOR_MAP[line.color]} ${
                i === visibleLines - 1 ? "animate-fade-in" : ""
              }`}
              style={{ minHeight: line.text ? undefined : "1.2em" }}
            >
              {line.text}
            </div>
          ))}
          {visibleLines < SCAN_LINES.length && (
            <span className="inline-block h-4 w-2 animate-pulse bg-gray-400" />
          )}
        </div>
      </div>
    </div>
  );
}
