import type { Metadata } from "next";
import Link from "next/link";

// All 47 monitored services — kept in sync with backend/seed.py
const SERVICES: Record<
  string,
  { name: string; category: string; tosUrl: string; privacyUrl: string }
> = {
  stripe: {
    name: "Stripe",
    category: "Payments",
    tosUrl: "https://stripe.com/legal/ssa",
    privacyUrl: "https://stripe.com/privacy",
  },
  openai: {
    name: "OpenAI",
    category: "AI / ML",
    tosUrl: "https://openai.com/policies/terms-of-use",
    privacyUrl: "https://openai.com/policies/privacy-policy",
  },
  aws: {
    name: "AWS",
    category: "Cloud",
    tosUrl: "https://aws.amazon.com/service-terms/",
    privacyUrl: "https://aws.amazon.com/privacy/",
  },
  "google-cloud": {
    name: "Google Cloud",
    category: "Cloud",
    tosUrl: "https://cloud.google.com/terms",
    privacyUrl: "https://policies.google.com/privacy",
  },
  vercel: {
    name: "Vercel",
    category: "DevOps",
    tosUrl: "https://vercel.com/legal/terms",
    privacyUrl: "https://vercel.com/legal/privacy-policy",
  },
  github: {
    name: "GitHub",
    category: "DevOps",
    tosUrl: "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
    privacyUrl: "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
  },
  twilio: {
    name: "Twilio",
    category: "Communications",
    tosUrl: "https://www.twilio.com/en-us/legal/tos",
    privacyUrl: "https://www.twilio.com/en-us/legal/privacy",
  },
  shopify: {
    name: "Shopify",
    category: "E-commerce",
    tosUrl: "https://www.shopify.com/legal/terms",
    privacyUrl: "https://www.shopify.com/legal/privacy",
  },
  slack: {
    name: "Slack",
    category: "Communications",
    tosUrl: "https://slack.com/terms-of-service",
    privacyUrl: "https://slack.com/privacy-policy",
  },
  firebase: {
    name: "Firebase",
    category: "Cloud",
    tosUrl: "https://firebase.google.com/terms",
    privacyUrl: "https://policies.google.com/privacy",
  },
  supabase: {
    name: "Supabase",
    category: "Cloud",
    tosUrl: "https://supabase.com/terms",
    privacyUrl: "https://supabase.com/privacy",
  },
  cloudflare: {
    name: "Cloudflare",
    category: "DevOps",
    tosUrl: "https://www.cloudflare.com/terms/",
    privacyUrl: "https://www.cloudflare.com/privacypolicy/",
  },
  anthropic: {
    name: "Anthropic",
    category: "AI / ML",
    tosUrl: "https://www.anthropic.com/legal/consumer-terms",
    privacyUrl: "https://www.anthropic.com/legal/privacy",
  },
  "mongodb-atlas": {
    name: "MongoDB Atlas",
    category: "Database",
    tosUrl: "https://www.mongodb.com/legal/terms-of-use",
    privacyUrl: "https://www.mongodb.com/legal/privacy-policy",
  },
  notion: {
    name: "Notion",
    category: "Productivity",
    tosUrl: "https://www.notion.so/terms",
    privacyUrl: "https://www.notion.so/privacy",
  },
  heroku: {
    name: "Heroku",
    category: "Cloud",
    tosUrl: "https://www.salesforce.com/company/legal/agreements/",
    privacyUrl: "https://www.salesforce.com/company/privacy/",
  },
  auth0: {
    name: "Auth0",
    category: "Auth",
    tosUrl: "https://auth0.com/legal/terms-of-service",
    privacyUrl: "https://auth0.com/privacy",
  },
  plaid: {
    name: "Plaid",
    category: "Fintech",
    tosUrl: "https://plaid.com/legal/",
    privacyUrl: "https://plaid.com/legal/#end-user-privacy-policy",
  },
  datadog: {
    name: "Datadog",
    category: "DevOps",
    tosUrl: "https://www.datadoghq.com/legal/terms/",
    privacyUrl: "https://www.datadoghq.com/legal/privacy/",
  },
  hubspot: {
    name: "HubSpot",
    category: "Marketing",
    tosUrl: "https://legal.hubspot.com/terms-of-service",
    privacyUrl: "https://legal.hubspot.com/privacy-policy",
  },
  linear: {
    name: "Linear",
    category: "Productivity",
    tosUrl: "https://linear.app/terms",
    privacyUrl: "https://linear.app/privacy",
  },
  figma: {
    name: "Figma",
    category: "Design",
    tosUrl: "https://www.figma.com/tos/",
    privacyUrl: "https://www.figma.com/privacy/",
  },
  airtable: {
    name: "Airtable",
    category: "Productivity",
    tosUrl: "https://www.airtable.com/tos",
    privacyUrl: "https://www.airtable.com/privacy",
  },
  asana: {
    name: "Asana",
    category: "Productivity",
    tosUrl: "https://asana.com/terms",
    privacyUrl: "https://asana.com/privacy",
  },
  atlassian: {
    name: "Atlassian",
    category: "Productivity",
    tosUrl: "https://www.atlassian.com/legal/cloud-terms-of-service",
    privacyUrl: "https://www.atlassian.com/legal/privacy-policy",
  },
  azure: {
    name: "Microsoft Azure",
    category: "Cloud",
    tosUrl: "https://azure.microsoft.com/en-us/support/legal/",
    privacyUrl: "https://privacy.microsoft.com/en-us/privacystatement",
  },
  digitalocean: {
    name: "DigitalOcean",
    category: "Cloud",
    tosUrl: "https://www.digitalocean.com/legal/terms-of-service-agreement",
    privacyUrl: "https://www.digitalocean.com/legal/privacy-policy",
  },
  netlify: {
    name: "Netlify",
    category: "DevOps",
    tosUrl: "https://www.netlify.com/legal/terms-of-use/",
    privacyUrl: "https://www.netlify.com/privacy/",
  },
  railway: {
    name: "Railway",
    category: "Cloud",
    tosUrl: "https://railway.app/legal/terms",
    privacyUrl: "https://railway.app/legal/privacy",
  },
  zoom: {
    name: "Zoom",
    category: "Communications",
    tosUrl: "https://explore.zoom.us/en/terms/",
    privacyUrl: "https://explore.zoom.us/en/privacy/",
  },
  sendgrid: {
    name: "SendGrid",
    category: "Communications",
    tosUrl: "https://sendgrid.com/policies/tos/",
    privacyUrl: "https://sendgrid.com/policies/privacy/",
  },
  mailchimp: {
    name: "Mailchimp",
    category: "Marketing",
    tosUrl: "https://mailchimp.com/legal/terms/",
    privacyUrl: "https://mailchimp.com/legal/privacy/",
  },
  sentry: {
    name: "Sentry",
    category: "DevOps",
    tosUrl: "https://sentry.io/terms/",
    privacyUrl: "https://sentry.io/privacy/",
  },
  pagerduty: {
    name: "PagerDuty",
    category: "DevOps",
    tosUrl: "https://www.pagerduty.com/terms-of-service/",
    privacyUrl: "https://www.pagerduty.com/privacy-policy/",
  },
  mixpanel: {
    name: "Mixpanel",
    category: "Analytics",
    tosUrl: "https://mixpanel.com/legal/terms-of-use/",
    privacyUrl: "https://mixpanel.com/legal/privacy-policy/",
  },
  segment: {
    name: "Segment",
    category: "Analytics",
    tosUrl: "https://www.twilio.com/en-us/legal/tos",
    privacyUrl: "https://www.twilio.com/en-us/legal/privacy",
  },
  okta: {
    name: "Okta",
    category: "Auth",
    tosUrl: "https://www.okta.com/agreements/",
    privacyUrl: "https://www.okta.com/privacy-policy/",
  },
  salesforce: {
    name: "Salesforce",
    category: "CRM",
    tosUrl: "https://www.salesforce.com/company/legal/agreements/",
    privacyUrl: "https://www.salesforce.com/company/privacy/",
  },
  zendesk: {
    name: "Zendesk",
    category: "Support",
    tosUrl: "https://www.zendesk.com/company/agreements-and-terms/main-services-agreement/",
    privacyUrl: "https://www.zendesk.com/company/agreements-and-terms/privacy-notices/",
  },
  intercom: {
    name: "Intercom",
    category: "Support",
    tosUrl: "https://www.intercom.com/legal/terms-and-policies",
    privacyUrl: "https://www.intercom.com/legal/privacy",
  },
  paypal: {
    name: "PayPal",
    category: "Payments",
    tosUrl: "https://www.paypal.com/us/legalhub/useragreement-full",
    privacyUrl: "https://www.paypal.com/us/legalhub/privacy-full",
  },
  mistral: {
    name: "Mistral AI",
    category: "AI / ML",
    tosUrl: "https://mistral.ai/terms/",
    privacyUrl: "https://mistral.ai/privacy/",
  },
  replicate: {
    name: "Replicate",
    category: "AI / ML",
    tosUrl: "https://replicate.com/terms",
    privacyUrl: "https://replicate.com/privacy",
  },
  cohere: {
    name: "Cohere",
    category: "AI / ML",
    tosUrl: "https://cohere.com/terms-of-use",
    privacyUrl: "https://cohere.com/privacy",
  },
  planetscale: {
    name: "PlanetScale",
    category: "Database",
    tosUrl: "https://planetscale.com/legal/siteterms",
    privacyUrl: "https://planetscale.com/legal/privacy",
  },
  "redis-cloud": {
    name: "Redis Cloud",
    category: "Database",
    tosUrl: "https://redis.io/legal/cloud-tos/",
    privacyUrl: "https://redis.io/legal/privacy-policy/",
  },
  pinecone: {
    name: "Pinecone",
    category: "Database",
    tosUrl: "https://www.pinecone.io/terms/",
    privacyUrl: "https://www.pinecone.io/privacy/",
  },
};

// ── Static params for Next.js SSG ─────────────────────────────────────────────
export function generateStaticParams() {
  return Object.keys(SERVICES).map((slug) => ({ slug }));
}

// ── Dynamic metadata ──────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const service = SERVICES[params.slug];
  if (!service) {
    return { title: "Service Not Found — ToS Monitor" };
  }

  const title = `${service.name} Terms of Service & Privacy Policy Monitor`;
  const description = `Get instant alerts when ${service.name} updates their Terms of Service or Privacy Policy. ToS Monitor watches ${service.name} 24/7 and sends plain-English summaries of every change. Free tier available.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://tos.inksky.net/services/${params.slug}`,
      siteName: "ToS Monitor",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `https://tos.inksky.net/services/${params.slug}`,
    },
  };
}

// ── Page component ────────────────────────────────────────────────────────────
export default function ServicePage({ params }: { params: { slug: string } }) {
  const service = SERVICES[params.slug];

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Service not found</h1>
          <p className="text-muted-foreground mb-4">
            We don&apos;t monitor &quot;{params.slug}&quot; yet.
          </p>
          <Link href="/" className="text-primary underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // JSON-LD structured data for Google
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ToS Monitor",
    applicationCategory: "BusinessApplication",
    description: `Monitor ${service.name} Terms of Service and Privacy Policy changes automatically.`,
    url: "https://tos.inksky.net",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier available",
    },
  };

  const relatedServices = Object.entries(SERVICES)
    .filter(([slug, s]) => s.category === service.category && slug !== params.slug)
    .slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen bg-background">
        {/* Nav */}
        <header className="border-b">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg tracking-tight">
              ToS Monitor
            </Link>
            <Link
              href="/pricing"
              className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition"
            >
              Get started free
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12">
          {/* Hero */}
          <div className="mb-10">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground bg-muted px-2 py-1 rounded">
              {service.category}
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              {service.name} ToS &amp; Privacy Policy Monitor
            </h1>
            <p className="mt-4 text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Get instant plain-English alerts when {service.name} updates their
              Terms of Service or Privacy Policy. Never be caught off guard by a
              vendor change again.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
              >
                Start monitoring free →
              </Link>
              <Link
                href="/"
                className="border px-6 py-3 rounded-lg font-medium hover:bg-muted transition"
              >
                View dashboard
              </Link>
            </div>
          </div>

          {/* What we monitor */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">
              What we monitor for {service.name}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  title: "Terms of Service",
                  url: service.tosUrl,
                  desc: "We check the full ToS page for any wording changes, new clauses, or updated liability limits.",
                },
                {
                  title: "Privacy Policy",
                  url: service.privacyUrl,
                  desc: "Data collection, retention, sharing, and GDPR/CCPA sections — tracked word by word.",
                },
              ].map((item) => (
                <div key={item.title} className="border rounded-lg p-5">
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{item.desc}</p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline break-all"
                  >
                    {item.url}
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">How it works</h2>
            <ol className="space-y-4">
              {[
                {
                  step: "1",
                  title: "We crawl daily",
                  desc: `Our service checks ${service.name}'s legal pages every day for changes.`,
                },
                {
                  step: "2",
                  title: "AI summarises the diff",
                  desc: "We use an LLM to convert legal jargon into a plain-English summary of what changed.",
                },
                {
                  step: "3",
                  title: "You get an instant alert",
                  desc: "You receive an email with the summary, severity rating, and a link to the full diff.",
                },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Why it matters */}
          <section className="mb-12 bg-muted/50 rounded-xl p-8">
            <h2 className="text-2xl font-semibold mb-4">
              Why you need to track {service.name} ToS changes
            </h2>
            <div className="space-y-3 text-muted-foreground">
              <p>
                {service.name} updates their legal terms multiple times per year.
                Most companies only find out about changes when a customer complains,
                a lawyer flags it, or worse — after the change has already impacted
                their business.
              </p>
              <p>
                Common issues include: new data sharing clauses, updated liability
                limits, changes to API usage rights, new auto-renewal terms, and
                modified dispute resolution processes.
              </p>
              <p>
                ToS Monitor gives your team a 24/7 watchdog so you&apos;re always
                the first to know — not the last.
              </p>
            </div>
          </section>

          {/* Related services */}
          {relatedServices.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold mb-4">
                Also monitor these {service.category} services
              </h2>
              <div className="flex flex-wrap gap-2">
                {relatedServices.map(([slug, svc]) => (
                  <Link
                    key={slug}
                    href={`/services/${slug}`}
                    className="border px-4 py-2 rounded-lg text-sm hover:bg-muted transition"
                  >
                    {svc.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="border rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">
              Start monitoring {service.name} today
            </h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Free tier includes up to 5 services. Pro plan monitors all 47+ services
              with instant email alerts and full change history.
            </p>
            <Link
              href="/pricing"
              className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:opacity-90 transition"
            >
              Get started free →
            </Link>
          </section>
        </main>

        <footer className="border-t mt-16">
          <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-muted-foreground flex flex-wrap gap-4">
            <Link href="/" className="hover:text-foreground transition">
              Dashboard
            </Link>
            <Link href="/pricing" className="hover:text-foreground transition">
              Pricing
            </Link>
            <Link href="/services/stripe" className="hover:text-foreground transition">
              Stripe monitor
            </Link>
            <Link href="/services/openai" className="hover:text-foreground transition">
              OpenAI monitor
            </Link>
            <Link href="/services/github" className="hover:text-foreground transition">
              GitHub monitor
            </Link>
            <span className="ml-auto">© 2025 ToS Monitor</span>
          </div>
        </footer>
      </div>
    </>
  );
}
