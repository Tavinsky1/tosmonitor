"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Shield,
  Bell,
  Zap,
  Eye,
  ArrowRight,
  Check,
  Terminal,
  Activity,
  Lock,
  Globe,
  ChevronRight,
} from "lucide-react";

// Animated Terminal Component
function AnimatedTerminal() {
  const [lines, setLines] = useState<{ text: string; type: string; delay: number }[]>([]);

  const terminalLines = [
    { text: "$ tos-monitor scan --all", type: "command", delay: 0 },
    { text: "⏳ Initializing scanner...", type: "info", delay: 400 },
    { text: "✓ Connected to database", type: "success", delay: 600 },
    { text: "✓ Loaded 20 service configurations", type: "success", delay: 800 },
    { text: "", type: "blank", delay: 900 },
    { text: "🔍 Scanning services...", type: "info", delay: 1000 },
    { text: "✓ Stripe ToS ...................... no changes", type: "success", delay: 1400 },
    { text: "✓ AWS Service Terms ............... no changes", type: "success", delay: 1600 },
    { text: "✓ Vercel ToS ...................... no changes", type: "success", delay: 1800 },
    { text: "⚠ OpenAI Privacy Policy ........... CHANGED", type: "warning", delay: 2200 },
    { text: '  → "Added clause: user content may be used for model training"', type: "detail", delay: 2400 },
    { text: "  → Severity: MAJOR  •  3 sections  •  +847 words", type: "meta", delay: 2600 },
    { text: "", type: "blank", delay: 2800 },
    { text: "✓ GitHub ToS ...................... no changes", type: "success", delay: 3000 },
    { text: "✓ Cloudflare Privacy .............. no changes", type: "success", delay: 3200 },
    { text: "🔴 Notion Terms of Service ......... CHANGED", type: "error", delay: 3600 },
    { text: '  → "New data sharing agreement with third-party AI providers"', type: "detail", delay: 3800 },
    { text: "  → Severity: CRITICAL  •  5 sections  •  +1,203 words", type: "meta", delay: 4000 },
    { text: "", type: "blank", delay: 4200 },
    { text: "✓ Scan complete. 2 changes detected.", type: "info", delay: 4600 },
    { text: "📧 Alerting 847 subscribed users...", type: "info", delay: 4800 },
    { text: "✓ Notifications sent successfully", type: "success", delay: 5200 },
  ];

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    
    terminalLines.forEach((line, index) => {
      const timeout = setTimeout(() => {
        setLines(prev => [...prev, line]);
      }, line.delay);
      timeouts.push(timeout);
    });

    const loopTimeout = setTimeout(() => {
      setLines([]);
    }, 8000);
    timeouts.push(loopTimeout);

    return () => timeouts.forEach(clearTimeout);
  }, []);

  const getLineStyle = (type: string) => {
    switch (type) {
      case "command":
        return "text-cyan-400";
      case "success":
        return "text-emerald-400";
      case "warning":
        return "text-amber-400";
      case "error":
        return "text-rose-400";
      case "info":
        return "text-blue-400";
      case "detail":
        return "text-amber-200 ml-6";
      case "meta":
        return "text-zinc-500 ml-6";
      default:
        return "";
    }
  };

  return (
    <div className="terminal rounded-xl overflow-hidden w-full max-w-2xl mx-auto">
      <div className="terminal-header px-4 py-3 flex items-center gap-2">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
        </div>
        <div className="flex-1 text-center">
          <span className="label text-zinc-600">tos-monitor — zsh</span>
        </div>
        <div className="w-16" />
      </div>
      <div className="terminal-body p-4 h-[380px] overflow-hidden">
        <div className="space-y-1">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className={`${getLineStyle(line.type)} animate-fade-in-up`}
            >
              {line.text}
            </div>
          ))}
          {lines.length > 0 && lines.length < terminalLines.length && (
            <span className="terminal-cursor" />
          )}
        </div>
      </div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <div
      className="glass-card rounded-2xl p-7 group cursor-pointer transition-all duration-500"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-6 h-6 text-indigo-400" />
      </div>
      <h3 className="headline-small text-white mb-3 group-hover:text-indigo-300 transition-colors">
        {title}
      </h3>
      <p className="text-body">{description}</p>
    </div>
  );
}

// Live Activity Badge
function LiveActivityBadge() {
  return (
    <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full glass-card">
      <span className="pulse-ring relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="label-medium text-zinc-400">
        Monitoring <span className="text-indigo-400">20 services</span>
      </span>
      <span className="text-zinc-700">|</span>
      <span className="label-medium text-zinc-400">
        Last scan: <span className="text-cyan-400">2m ago</span>
      </span>
    </div>
  );
}

// Stats Section
function StatsSection() {
  const stats = [
    { value: "20+", label: "Services", icon: Globe },
    { value: "6h", label: "Interval", icon: Activity },
    { value: "847", label: "Alerts", icon: Bell },
    { value: "100%", label: "Uptime", icon: Shield },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="glass-card rounded-xl p-6 text-center group hover:scale-105 transition-transform duration-300"
        >
          <stat.icon className="w-5 h-5 text-indigo-400 mx-auto mb-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="headline-medium gradient-text-brand mb-1">
            {stat.value}
          </div>
          <div className="label text-zinc-500">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// Pricing Card
function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  href,
  highlighted,
  delay,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
  delay: number;
}) {
  return (
    <div
      className={`relative rounded-2xl p-[1px] transition-all duration-500 hover:scale-[1.02] ${
        highlighted
          ? "bg-gradient-to-b from-indigo-500 via-violet-500 to-cyan-500"
          : "bg-white/10"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="bg-[#0c0c12] rounded-2xl p-7 h-full flex flex-col">
        {highlighted && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="label px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
              Popular
            </span>
          </div>
        )}
        
        <div className="mb-6">
          <h3 className="headline-small text-white mb-1">{name}</h3>
          <p className="text-small">{description}</p>
        </div>
        
        <div className="mb-6">
          <span className="headline-large text-white">{price}</span>
          {period && <span className="text-zinc-500 ml-1 text-body">{period}</span>}
        </div>
        
        <ul className="space-y-3 mb-8 flex-1">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-body">
              <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
        
        <Link
          href={href}
          className={`block text-center py-3.5 rounded-lg font-display font-medium transition-all duration-300 ${
            highlighted
              ? "btn-primary text-white"
              : "btn-secondary text-white"
          }`}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

// Main Page
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Background Effects */}
      <div className="aurora-bg" />
      <div className="grid-pattern" />

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-shadow">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-lg font-semibold text-white tracking-tight">
                ToS<span className="text-indigo-400">Monitor</span>
              </span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-body text-zinc-400 hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-body text-zinc-400 hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="/login" className="text-body text-zinc-400 hover:text-white transition-colors">
                Log in
              </Link>
              <Link
                href="/register"
                className="btn-primary px-5 py-2.5 rounded-lg text-white"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-28 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="mb-6 animate-fade-in-up">
              <LiveActivityBadge />
            </div>
            
            <h1 className="headline-hero mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <span className="text-white">Know When Your Vendors</span>
              <br />
              <span className="gradient-text">Change the Rules</span>
            </h1>
            
            <p className="text-large max-w-xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              Companies quietly update their Terms of Service and Privacy Policies. 
              We watch them for you and alert you when something important changes.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <Link
                href="/register"
                className="btn-primary px-8 py-4 rounded-xl flex items-center gap-2"
              >
                Start Monitoring Free
              </Link>
              <Link
                href="/dashboard/changes"
                className="btn-secondary px-6 py-4 rounded-xl flex items-center gap-2"
              >
                See Live Changes
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Terminal Demo */}
          <div className="mt-14 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <AnimatedTerminal />
          </div>

          {/* Stats */}
          <div className="mt-20 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
            <StatsSection />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-28 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="label text-indigo-400 mb-4">How It Works</p>
            <h2 className="headline-large text-white mb-6">
              Set it up once.
              <br />
              <span className="gradient-text-brand">Get alerted forever.</span>
            </h2>
            <p className="text-large max-w-lg mx-auto">
              We handle the tedious work of monitoring legal documents so you don&apos;t have to.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            <FeatureCard
              icon={Eye}
              title="Automatic Monitoring"
              description="We check 20+ services every 6 hours. When a Terms of Service or Privacy Policy changes, we detect it instantly."
              delay={0}
            />
            <FeatureCard
              icon={Zap}
              title="AI-Powered Summaries"
              description='No more reading legal docs. Get plain-language summaries like "Stripe added a clause allowing AI training on your data."'
              delay={100}
            />
            <FeatureCard
              icon={Bell}
              title="Instant Alerts"
              description="Get notified via email, Slack, or webhook the moment something changes. Never be caught off guard."
              delay={200}
            />
            <FeatureCard
              icon={Lock}
              title="Severity Rating"
              description="We classify changes as Critical, Major, Minor, or Patch so you know what needs attention now vs. later."
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* Live Feed Preview Section */}
      <section className="relative z-10 py-28 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="label text-indigo-400 mb-4">Live Feed</p>
              <h2 className="headline-large text-white mb-6">
                See Changes As They Happen
              </h2>
              <p className="text-large mb-10">
                Our public change feed shows you exactly what we&apos;re detecting 
                in real-time. See for yourself why developers trust us.
              </p>
              <ul className="space-y-4 mb-10">
                {[
                  "Visual diff viewer shows exactly what changed",
                  "Plain language summaries of legal jargon",
                  "Severity ratings to prioritize your attention",
                  "Full history of all changes per service",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-body">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/changes"
                className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-display font-medium transition-colors"
              >
                View Live Change Feed
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
            
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="headline-small text-white">Recent Changes</h3>
                <span className="label text-zinc-500">Last 24h</span>
              </div>
              <div className="space-y-1">
                {[
                  { service: "OpenAI", change: "Privacy Policy updated", severity: "major", time: "2h ago" },
                  { service: "Notion", change: "Terms of Service updated", severity: "critical", time: "5h ago" },
                  { service: "Stripe", change: "API Terms modified", severity: "minor", time: "12h ago" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        item.severity === 'critical' ? 'bg-rose-500' :
                        item.severity === 'major' ? 'bg-amber-500' :
                        'bg-blue-500'
                      }`} />
                      <div>
                        <div className="font-display text-sm font-medium text-zinc-200">{item.service}</div>
                        <div className="text-small">{item.change}</div>
                      </div>
                    </div>
                    <span className="label text-zinc-600">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-28 px-4 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="label text-indigo-400 mb-4">Pricing</p>
            <h2 className="headline-large text-white mb-6">
              Simple, <span className="gradient-text-brand">Transparent</span> Pricing
            </h2>
            <p className="text-large max-w-md mx-auto">
              Start free. Upgrade when you need more. No credit card required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <PricingCard
              name="Free"
              price="$0"
              description="For individuals"
              features={[
                "Monitor up to 3 services",
                "Email alerts",
                "7-day change history",
                "Public change feed",
              ]}
              cta="Start Free"
              href="/register"
              highlighted={false}
              delay={0}
            />
            <PricingCard
              name="Pro"
              price="$19"
              period="/month"
              description="For developers"
              features={[
                "Unlimited services",
                "Email + webhook alerts",
                "Full change history",
                "Diff viewer",
                "Slack integration",
                "API access",
              ]}
              cta="Start Pro Trial"
              href="/register?plan=pro"
              highlighted={true}
              delay={100}
            />
            <PricingCard
              name="Business"
              price="$49"
              period="/month"
              description="For teams"
              features={[
                "Everything in Pro",
                "Team accounts (5 seats)",
                "Compliance reports",
                "Custom monitoring",
                "Priority support",
                "SLA guarantee",
              ]}
              cta="Contact Us"
              href="/register?plan=business"
              highlighted={false}
              delay={200}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-28 px-4 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="label text-indigo-400 mb-6">Ready to get started?</p>
          <h2 className="headline-large text-white mb-8">
            Stop being surprised
            <br />
            <span className="gradient-text">by ToS changes.</span>
          </h2>
          <p className="text-large mb-12 max-w-lg mx-auto">
            Join developers who never miss a Terms of Service change. 
            Start monitoring in under 2 minutes.
          </p>
          <Link
            href="/register"
            className="btn-primary inline-flex items-center gap-3 px-10 py-5 rounded-xl"
          >
            <Terminal className="w-5 h-5" />
            Start Monitoring Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="font-display text-sm font-semibold text-white">
              ToS<span className="text-indigo-400">Monitor</span>
            </span>
          </div>
          <p className="text-small">
            Built for developers who read the fine print.
          </p>
          <div className="flex items-center gap-6 label text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link>
            <a href="https://twitter.com" className="hover:text-zinc-300 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
