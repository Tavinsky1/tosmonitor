"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getServices,
  getCategories,
  subscribe,
  unsubscribe,
  getMySubscriptions,
  getMe,
  suggestService,
} from "@/lib/api";
import type { Service } from "@/lib/api";
import { useState } from "react";
import { Bell, BellOff, Search, Globe, Shield, Lock, PlusCircle } from "lucide-react";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [subError, setSubError] = useState<string | null>(null);
  const [suggest, setSuggest] = useState({ name: "", url: "", email: "", notes: "" });
  const [suggestDone, setSuggestDone] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  const { data: servicesData } = useQuery({
    queryKey: ["services", search, category],
    queryFn: () => getServices({ search: search || undefined, category }),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: getMySubscriptions,
  });

  const subscribedIds = new Set(
    subscriptions?.map((s: any) => s.service_id) ?? []
  );

  const subscribeMut = useMutation({
    mutationFn: (serviceId: string) => subscribe(serviceId),
    onSuccess: () => {
      setSubError(null);
      queryClient.invalidateQueries({ queryKey: ["my-subscriptions"] });
    },
    onError: (err: any) => setSubError(err.message),
  });

  const unsubscribeMut = useMutation({
    mutationFn: (serviceId: string) => unsubscribe(serviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-subscriptions"] }),
  });

  const suggestMut = useMutation({
    mutationFn: () =>
      suggestService({
        service_name: suggest.name,
        url: suggest.url,
        email: suggest.email || undefined,
        notes: suggest.notes || undefined,
      }),
    onSuccess: () => setSuggestDone(true),
  });

  const subCount = subscriptions?.length ?? 0;
  const maxSubs = user?.tier?.max_services ?? 2;
  const atLimit = subCount >= maxSubs;

  function toggleSubscription(service: Service) {
    if (subscribedIds.has(service.id)) {
      unsubscribeMut.mutate(service.id);
    } else {
      subscribeMut.mutate(service.id);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-900">
          Monitored Services
        </h1>
        <p className="text-sm text-gray-500">
          Subscribe to get alerts when these services change their policies
          <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
            {subCount}/{maxSubs} subscriptions used
          </span>
        </p>
      </div>

      {/* Tier limit warning */}
      {atLimit && user?.plan === "free" && (
        <div className="mb-4">
          <UpgradeBanner
            message={`You've reached the ${maxSubs}-service limit on your Free plan. Upgrade to Pro for up to 15 services.`}
            compact
          />
        </div>
      )}

      {/* Subscription error (e.g. tier limit reached) */}
      {subError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {subError}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(undefined)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              !category
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            All
          </button>
          {categories?.map((cat: any) => (
            <button
              key={cat.name}
              onClick={() => setCategory(cat.name)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                category === cat.name
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Service grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {servicesData?.services?.map((service) => {
          const isSubscribed = subscribedIds.has(service.id);
          return (
            <div
              key={service.id}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-brand-900">
                    {service.name}
                  </h3>
                  {service.category && (
                    <span className="mt-0.5 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {service.category}
                    </span>
                  )}
                </div>
                <Shield className="h-5 w-5 text-brand-300" />
              </div>

              <div className="mb-4 space-y-1 text-xs text-gray-500">
                {service.tos_url && (
                  <a
                    href={service.tos_url}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-1 hover:text-brand-500"
                  >
                    <Globe className="h-3 w-3" /> Terms of Service ↗
                  </a>
                )}
                {service.privacy_url && (
                  <a
                    href={service.privacy_url}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-1 hover:text-brand-500"
                  >
                    <Globe className="h-3 w-3" /> Privacy Policy ↗
                  </a>
                )}
                {service.last_checked_at && (
                  <p className="text-gray-400">
                    Last checked:{" "}
                    {formatDistanceToNow(new Date(service.last_checked_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {service.subscriber_count} subscriber
                  {service.subscriber_count !== 1 && "s"}
                </span>
                <button
                  onClick={() => toggleSubscription(service)}
                  disabled={!isSubscribed && atLimit}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    isSubscribed
                      ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600"
                      : atLimit
                        ? "cursor-not-allowed bg-gray-100 text-gray-400"
                        : "bg-brand-50 text-brand-600 hover:bg-brand-100"
                  )}
                >
                  {isSubscribed ? (
                    <>
                      <BellOff className="h-3 w-3" /> Subscribed
                    </>
                  ) : atLimit ? (
                    <>
                      <Lock className="h-3 w-3" /> Limit reached
                    </>
                  ) : (
                    <>
                      <Bell className="h-3 w-3" /> Subscribe
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {servicesData?.services?.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">
          No services found matching your search.
        </div>
      )}

      {/* ── Suggest a service ─────────────────────────────── */}
      <div className="mt-12 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8">
        <div className="mb-5 flex items-center gap-3">
          <PlusCircle className="h-6 w-6 text-brand-400" />
          <div>
            <h2 className="text-base font-semibold text-brand-900">
              Don&rsquo;t see your service?
            </h2>
            <p className="text-sm text-gray-500">
              Suggest a URL and we&rsquo;ll add it to the monitoring list.
            </p>
          </div>
        </div>

        {suggestDone ? (
          <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-4 text-sm text-green-700">
            ✓ Thanks! We&rsquo;ll review your suggestion and add it within 24 hours.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (suggest.name && suggest.url) suggestMut.mutate();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">Service name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Linear, Notion, Vercel"
                value={suggest.name}
                onChange={(e) => setSuggest((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">Terms / Privacy URL *</label>
              <input
                required
                type="url"
                placeholder="https://example.com/terms"
                value={suggest.url}
                onChange={(e) => setSuggest((p) => ({ ...p, url: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">Your email (optional — we&rsquo;ll notify you)</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={suggest.email}
                onChange={(e) => setSuggest((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">Why is this important to you? (optional)</label>
              <input
                type="text"
                placeholder="We rely on it for payments, data processing…"
                value={suggest.notes}
                onChange={(e) => setSuggest((p) => ({ ...p, notes: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={suggestMut.isPending || !suggest.name || !suggest.url}
                className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition"
              >
                {suggestMut.isPending ? "Sending…" : "Submit suggestion"}
              </button>
              {suggestMut.isError && (
                <span className="text-xs text-red-500">
                  {(suggestMut.error as Error).message}
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
