/**
 * Compute text differences and generate HTML diff.
 */
import { diffLines } from "diff";

export interface DiffSection {
  oldText: string;
  newText: string;
}

export interface DiffResult {
  sections: DiffSection[];
  sectionsChanged: number;
  wordsAdded: number;
  wordsRemoved: number;
  diffHtml: string;
}

export function computeDiff(oldContent: string, newContent: string): DiffResult {
  const changes = diffLines(oldContent, newContent);

  const sections: DiffSection[] = [];
  let wordsAdded = 0;
  let wordsRemoved = 0;
  let currentOld = "";
  let currentNew = "";

  for (const part of changes) {
    const wc = (part.value || "").split(/\s+/).filter(Boolean).length;
    if (part.added) {
      wordsAdded += wc;
      currentNew += part.value;
    } else if (part.removed) {
      wordsRemoved += wc;
      currentOld += part.value;
    } else {
      // Unchanged — flush any pending diff section
      if (currentOld || currentNew) {
        sections.push({
          oldText: currentOld.trim().slice(0, 500),
          newText: currentNew.trim().slice(0, 500),
        });
        currentOld = "";
        currentNew = "";
      }
    }
  }
  // Flush remaining
  if (currentOld || currentNew) {
    sections.push({
      oldText: currentOld.trim().slice(0, 500),
      newText: currentNew.trim().slice(0, 500),
    });
  }

  const diffHtml = generateDiffHtml(changes);

  return {
    sections,
    sectionsChanged: sections.length,
    wordsAdded,
    wordsRemoved,
    diffHtml,
  };
}

function generateDiffHtml(
  changes: ReturnType<typeof diffLines>,
): string {
  let html = '<table class="diff-table" style="width:100%;border-collapse:collapse;font-size:13px;">';

  for (const part of changes) {
    const lines = part.value.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const escaped = escapeHtml(line);
      if (part.added) {
        html += `<tr style="background:#e6ffed"><td style="padding:2px 8px;color:#22863a">+ ${escaped}</td></tr>`;
      } else if (part.removed) {
        html += `<tr style="background:#ffeef0"><td style="padding:2px 8px;color:#cb2431">- ${escaped}</td></tr>`;
      } else {
        html += `<tr><td style="padding:2px 8px;color:#586069">&nbsp; ${escaped}</td></tr>`;
      }
    }
  }

  html += "</table>";
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Check if two texts are similar enough to skip (>99.5% similar) */
export function isTooSimilar(oldContent: string, newContent: string): boolean {
  const maxLen = Math.max(oldContent.length, newContent.length);
  if (maxLen === 0) return true;
  const changes = diffLines(oldContent, newContent);
  let sameLen = 0;
  for (const part of changes) {
    if (!part.added && !part.removed) sameLen += part.value.length;
  }
  return sameLen / maxLen > 0.97;
}
