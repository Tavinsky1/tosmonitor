/**
 * Fetch a web page and extract meaningful text content.
 * Uses Workers fetch() + a simple HTML-to-text extraction.
 */

const UA = "ToSMonitor/1.0 (+https://tosmonitor.inksky.net)";

export interface FetchResult {
  content: string;
  contentHash: string;
  wordCount: number;
}

export async function fetchPage(
  url: string,
  timeoutMs: number = 30000,
): Promise<FetchResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!resp.ok) {
      console.error(`Fetch ${url}: HTTP ${resp.status}`);
      return null;
    }

    const html = await resp.text();
    const content = extractText(html);
    if (!content || content.length < 50) {
      console.warn(`Fetch ${url}: content too short (${content.length} chars)`);
      return null;
    }

    const contentHash = await sha256(content);
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    return { content, contentHash, wordCount };
  } catch (err: any) {
    console.error(`Fetch ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract meaningful text from HTML — strip nav, footer, script, style */
function extractText(html: string): string {
  let text = html;

  // Remove blocks that never contain policy text
  for (const tag of ["script", "style", "nav", "footer", "header", "noscript", "svg", "iframe", "form"]) {
    // Use a greedy regex per tag — *? can cut off at nested closing tags
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    text = text.replace(re, " ");
  }
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, " ");

  // Try to find the LAST <main> or <article> — many pages have multiple;
  // the legal content is usually the deepest/last one.
  const mainBlocks = [...text.matchAll(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/gi)];
  if (mainBlocks.length > 0) {
    // Pick the longest match (most content)
    let best = mainBlocks[0][1];
    for (const m of mainBlocks) {
      if (m[1].length > best.length) best = m[1];
    }
    text = best;
  } else {
    // Fallback: grab <body> content if present
    const bodyMatch = text.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) text = bodyMatch[1];
  }

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ");
  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Strip dynamic noise: copyright years, "last updated" dates, cache-busters
  text = text.replace(/©\s*\d{4}/g, "©YYYY");
  text = text.replace(/(last\s+(?:updated|modified|revised))\s*:?\s*\w+\s+\d{1,2},?\s*\d{4}/gi, "$1: DATE");
  text = text.replace(/(effective\s+(?:date|as\s+of))\s*:?\s*\w+\s+\d{1,2},?\s*\d{4}/gi, "$1: DATE");

  return text;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
