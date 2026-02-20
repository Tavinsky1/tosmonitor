"""
Sales Agent Configuration
- Keywords to search for on each platform
- Subreddits to watch
- Reply templates (filled by LLM)
- Scoring rules
"""

PRODUCT_URL = "https://tos.inksky.net"
PRODUCT_NAME = "ToS Monitor"
PRODUCT_TAGLINE = "instant alerts when SaaS ToS/Privacy policies change"

# ── Search keywords ───────────────────────────────────────────────────────────
KEYWORDS = [
    "terms of service changed",
    "tos changed",
    "privacy policy update",
    "terms of service update",
    "surprised by tos change",
    "didn't notice tos update",
    "vendor changed terms",
    "stripe changed terms",
    "openai changed terms",
    "saas tos monitoring",
    "track terms of service",
    "monitor privacy policy",
    "tos change alert",
    "compliance vendor risk",
    "third party tos risk",
    "legal vendor review",
    "saas contract changes",
    "api terms changed",
]

# ── Reddit subreddits ─────────────────────────────────────────────────────────
SUBREDDITS = [
    "SaaS",
    "startups",
    "legaladvice",
    "devops",
    "entrepreneur",
    "smallbusiness",
    "Entrepreneur",
    "indiehackers",
    "webdev",
    "programming",
    "legal",
    "privacy",
    "cybersecurity",
]

# ── Hacker News tags ──────────────────────────────────────────────────────────
HN_TAGS = ["story", "comment"]
HN_MIN_POINTS = 2  # Minimum points to consider engaging with

# ── Twitter/X search queries ──────────────────────────────────────────────────
TWITTER_QUERIES = [
    '"terms of service" changed -is:retweet lang:en',
    '"privacy policy" update SaaS -is:retweet lang:en',
    '"tos" changed surprised -is:retweet lang:en',
    '"vendor" "terms" changed compliance -is:retweet lang:en',
    'site:stripe.com OR site:openai.com "terms" changed -is:retweet lang:en',
]

# ── LinkedIn target personas ──────────────────────────────────────────────────
LINKEDIN_PERSONAS = [
    {"title": "CTO", "company_size": "11-50", "industry": "Software"},
    {"title": "VP of Engineering", "company_size": "51-200", "industry": "Technology"},
    {"title": "General Counsel", "company_size": "51-200", "industry": "Software"},
    {"title": "Head of Compliance", "company_size": "201-500", "industry": "Financial Services"},
    {"title": "Chief Legal Officer", "company_size": "51-200", "industry": "Technology"},
    {"title": "Engineering Manager", "company_size": "11-50", "industry": "Software"},
]

# ── Cold email targets ────────────────────────────────────────────────────────
COLD_EMAIL_TARGETS = [
    "SaaS founders",
    "startup CTOs",
    "compliance managers at tech companies",
    "legal ops teams at startups",
]

# ── Reply prompt template ─────────────────────────────────────────────────────
REPLY_PROMPT = """You are a helpful expert on SaaS terms of service and vendor risk. 
Someone posted about a problem you can help with. Write a genuine, helpful reply that:

1. Directly addresses their specific problem (1-2 sentences)
2. Shares a useful insight or tip they might not know
3. Mentions ToS Monitor NATURALLY at the end ONLY if truly relevant - never force it
   - If mentioning it: "btw, I built a tool for this: {url} — free tier available"
   - If not relevant: don't mention it at all

Post/comment context:
Title: {title}
Content: {content}
Platform: {platform}

Rules:
- Sound human, NOT like a bot or advertiser
- Max 150 words
- No markdown headers
- If the post is not about ToS/privacy/vendor risk, reply None
- Don't be salesy. Be helpful first.

Reply (or None):"""

# ── LinkedIn DM template ──────────────────────────────────────────────────────
LINKEDIN_DM_TEMPLATE = """Hi {name},

I noticed you're a {title} at {company} — you're probably the person who finds out about ToS changes the hard way (a lawyer's email or a surprised customer).

I built ToS Monitor ({url}) — it watches the legal pages of 47+ SaaS tools you likely use (Stripe, OpenAI, Slack, GitHub, etc.) and sends plain-English alerts when something changes.

Free tier available. Happy to share access if useful.

— {sender_name}"""

# ── Cold email templates ──────────────────────────────────────────────────────
COLD_EMAIL_SUBJECT_LINES = [
    "Did you know {service} updated their ToS last month?",
    "How are you tracking vendor ToS changes?",
    "Quick question about your SaaS vendor risk process",
    "{company}, Stripe changed their terms — did you catch it?",
]

COLD_EMAIL_BODY = """Hi {name},

Quick question: how does {company} track when your SaaS vendors update their terms?

Most teams find out too late — a customer complaint, a legal review, or worse. 

I built ToS Monitor ({url}) to fix this. It watches Stripe, OpenAI, Slack, GitHub, AWS and 40+ others, then sends you a plain-English summary when anything changes. Free to start.

Would this be useful for your team?

{sender_name}"""

# ── SEO content per service ───────────────────────────────────────────────────
SEO_INTRO_TEMPLATE = """Track every {service} Terms of Service and Privacy Policy change automatically. 
ToS Monitor watches {service}'s legal pages 24/7 and sends instant plain-English alerts 
when something changes — so you're never caught off guard."""
