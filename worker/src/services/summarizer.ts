/**
 * LLM-powered summarizer: takes diff sections and produces title + summary + severity.
 */
import type { DiffSection } from "./differ";

export interface SummaryResult {
  title: string;
  summary: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "PATCH";
}

const SYSTEM_PROMPT = `You are a legal policy analyst. Given a diff of a Terms of Service or Privacy Policy, produce a JSON object with:
- "title": concise headline (max 100 chars)
- "summary": 2-3 sentence plain-English explanation of what changed and why it matters
- "severity": one of "CRITICAL", "MAJOR", "MINOR", "PATCH"

Severity guide:
- CRITICAL: data rights, liability, arbitration, AI training on user data
- MAJOR: pricing, payment terms, cancellation, significant feature removal
- MINOR: clarification, formatting, adding services or regions
- PATCH: typo, grammar, date updates

Respond ONLY with valid JSON, no markdown.`;

export async function summarize(
  serviceName: string,
  sections: DiffSection[],
  env: {
    LLM_PROVIDER: string;
    GROQ_API_KEY: string;
    GROQ_MODEL: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_MODEL?: string;
  },
): Promise<SummaryResult> {
  // Build user prompt
  const diffText = sections
    .slice(0, 10)
    .map((s, i) => `Section ${i + 1}:\nOLD: ${s.oldText.slice(0, 500)}\nNEW: ${s.newText.slice(0, 500)}`)
    .join("\n\n");

  const userPrompt = `Service: ${serviceName}\n\nChanges:\n${diffText}`;

  // Try providers in order
  const providers = getProviderOrder(env);
  for (const provider of providers) {
    try {
      const result = await callProvider(provider, SYSTEM_PROMPT, userPrompt, env);
      if (result) return result;
    } catch (err) {
      console.error(`LLM ${provider} failed:`, err);
    }
  }

  // Fallback: no LLM available
  return {
    title: `${serviceName} policy updated`,
    summary: `A change was detected in ${serviceName}'s policy documents. ${sections.length} section(s) were modified.`,
    severity: "MINOR",
  };
}

type Provider = "groq" | "openai" | "anthropic";

function getProviderOrder(env: any): Provider[] {
  const primary = (env.LLM_PROVIDER || "groq").toLowerCase() as Provider;
  const all: Provider[] = ["groq", "openai", "anthropic"];
  // Put primary first, then the rest
  return [primary, ...all.filter((p) => p !== primary)];
}

async function callProvider(
  provider: Provider,
  systemPrompt: string,
  userPrompt: string,
  env: any,
): Promise<SummaryResult | null> {
  if (provider === "groq") {
    if (!env.GROQ_API_KEY) return null;
    return callOpenAICompatible(
      "https://api.groq.com/openai/v1/chat/completions",
      env.GROQ_API_KEY,
      env.GROQ_MODEL || "llama-3.1-70b-versatile",
      systemPrompt,
      userPrompt,
    );
  }
  if (provider === "openai") {
    if (!env.OPENAI_API_KEY) return null;
    return callOpenAICompatible(
      "https://api.openai.com/v1/chat/completions",
      env.OPENAI_API_KEY,
      env.OPENAI_MODEL || "gpt-4o-mini",
      systemPrompt,
      userPrompt,
    );
  }
  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) return null;
    return callAnthropic(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || "claude-haiku-4-20250514", systemPrompt, userPrompt);
  }
  return null;
}

async function callOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<SummaryResult> {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<SummaryResult> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      messages: [{ role: "user", content: user }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as any;
  const content = data.content?.[0]?.text;
  return JSON.parse(content);
}
