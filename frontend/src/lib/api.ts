/**
 * API Client — typed wrapper around fetch for the ToS Monitor API.
 */

import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ── Auth helpers ────────────────────────────────────────────

export function getToken(): string | undefined {
  return Cookies.get("token");
}

export function setToken(token: string) {
  Cookies.set("token", token, { expires: 7, sameSite: "lax" });
}

export function removeToken() {
  Cookies.remove("token");
}

// ── Fetch wrapper ───────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

// ── Auth ────────────────────────────────────────────────────

export interface TierInfo {
  plan: "free" | "pro" | "business";
  max_services: number;
  history_days: number;
  realtime_alerts: boolean;
  can_view_diff: boolean;
  can_export: boolean;
  can_api: boolean;
  can_webhook: boolean;
  digest_frequency: "none" | "weekly" | "daily" | "realtime";
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: "free" | "pro" | "business";
  tier: TierInfo | null;
  created_at: string;
}

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<{ access_token: string }> {
  const data = await apiFetch<{ access_token: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
  setToken(data.access_token);
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<{ access_token: string }> {
  const data = await apiFetch<{ access_token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.access_token);
  return data;
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/api/auth/me");
}

export function logout() {
  removeToken();
  window.location.href = "/login";
}

// ── Services ────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  logo_url: string | null;
  tos_url: string | null;
  privacy_url: string | null;
  is_active: boolean;
  last_checked_at: string | null;
  subscriber_count: number;
}

export async function getServices(params?: {
  category?: string;
  search?: string;
  page?: number;
}): Promise<{ services: Service[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  return apiFetch(`/api/services?${searchParams}`);
}

export async function getService(slug: string): Promise<Service> {
  return apiFetch(`/api/services/${slug}`);
}

export async function getCategories(): Promise<
  { name: string; count: number }[]
> {
  return apiFetch("/api/services/categories/list");
}

export async function subscribe(serviceId: string) {
  return apiFetch("/api/services/subscribe", {
    method: "POST",
    body: JSON.stringify({ service_id: serviceId }),
  });
}

export async function unsubscribe(serviceId: string) {
  return apiFetch(`/api/services/unsubscribe/${serviceId}`, {
    method: "DELETE",
  });
}

export async function getMySubscriptions() {
  return apiFetch<
    {
      id: string;
      service_id: string;
      service_name: string;
      notify_email: boolean;
    }[]
  >("/api/services/me/subscriptions");
}

// ── Changes ─────────────────────────────────────────────────

export interface Change {
  id: string;
  service_id: string;
  service_name: string;
  service_slug: string;
  change_type: string;
  severity: "critical" | "major" | "minor" | "patch";
  title: string;
  summary: string;
  diff_html: string | null;
  sections_changed: number;
  words_added: number;
  words_removed: number;
  detected_at: string;
}

export interface ChangeDetail extends Change {
  old_content: string | null;
  new_content: string | null;
  upgrade_hint: string | null;
}

export async function getChanges(params?: {
  service_slug?: string;
  severity?: string;
  days?: number;
  page?: number;
}): Promise<{ changes: Change[]; total: number; page: number }> {
  const searchParams = new URLSearchParams();
  if (params?.service_slug)
    searchParams.set("service_slug", params.service_slug);
  if (params?.severity) searchParams.set("severity", params.severity);
  if (params?.days) searchParams.set("days", String(params.days));
  if (params?.page) searchParams.set("page", String(params.page));
  return apiFetch(`/api/changes?${searchParams}`);
}

export async function getChange(id: string): Promise<ChangeDetail> {
  return apiFetch(`/api/changes/${id}`);
}

export async function getPublicFeed(
  limit = 10
): Promise<
  {
    id: string;
    service: string;
    service_slug: string;
    title: string;
    summary: string;
    severity: string;
    detected_at: string;
  }[]
> {
  return apiFetch(`/api/changes/feed?limit=${limit}`);
}

// ── Dashboard ───────────────────────────────────────────────

export interface DashboardStats {
  total_services_monitored: number;
  total_changes_detected: number;
  changes_last_7_days: number;
  changes_last_30_days: number;
  user_subscriptions: number;
  critical_changes_unread: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch("/api/changes/dashboard/stats");
}

// ── Suggestions ─────────────────────────────────────────────

export async function suggestService(payload: {
  service_name: string;
  url: string;
  email?: string;
  notes?: string;
}): Promise<{ id: string; service_name: string; url: string; status: string }> {
  return apiFetch("/api/suggestions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
