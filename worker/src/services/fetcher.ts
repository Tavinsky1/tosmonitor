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
  // Remove script, style, nav, footer, header, noscript blocks
  let text = html;
  for (const tag of ["script", "style", "nav", "footer", "header", "noscript", "svg", "iframe"]) {
    text = text.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi"), " ");
  }
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  // Try to find main content area
  const mainMatch = text.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (mainMatch) {
    text = mainMatch[1];
  } else {
    // Try content div
    const contentMatch = text.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (contentMatch) text = contentMatch[1];
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
    .replace(/&nbsp;/g, " ");
  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
