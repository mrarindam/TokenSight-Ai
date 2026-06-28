export interface DocPageContent {
  id: string
  label: string
  title: string
  description: string
  sections: {
    title?: string
    content?: string
    listItems?: { term?: string; text: string }[]
    warning?: string
    codeBlock?: string
  }[]
}

export interface DocGroup {
  title: string
  items: { id: string; label: string; iconName: string }[]
}

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Getting Started",
    items: [
      { id: "about", label: "About TokenSight AI", iconName: "Eye" },
      { id: "mission", label: "Mission & Vision", iconName: "Rocket" }
    ]
  },
  {
    title: "Core Features",
    items: [
      { id: "scanner", label: "Token Scanner", iconName: "Scan" },
      { id: "portfolio", label: "Portfolio Tracker", iconName: "Target" },
      { id: "alerts", label: "Alerts Center", iconName: "Bell" },
      { id: "telegram", label: "Telegram Bot", iconName: "Bot" },
      { id: "sightai", label: "Sight AI", iconName: "MessageSquareText" }
    ]
  },
  {
    title: "User Center",
    items: [
      { id: "profile", label: "Your Profile", iconName: "UserCircle" },
      { id: "history", label: "Scan History", iconName: "History" },
      { id: "leaderboard", label: "Leaderboard", iconName: "Trophy" }
    ]
  },
  {
    title: "Technical & Future",
    items: [
      { id: "roadmap", label: "Roadmap", iconName: "Crosshair" }
    ]
  },
  {
    title: "Developer",
    items: [
      { id: "dev-setup", label: "Dev Setup", iconName: "Cpu" },
      { id: "architecture", label: "Architecture & Tech Stack", iconName: "Cpu" },
      { id: "db-schema", label: "Database Schema", iconName: "History" },
      { id: "auth-security", label: "Authentication & Security", iconName: "UserCircle" },
      { id: "deployment", label: "Deployment & Infrastructure", iconName: "Rocket" }
    ]
  }
]

export const DOC_PAGES: Record<string, DocPageContent> = {
  about: {
    id: "about",
    label: "About TokenSight AI",
    title: "About TokenSight AI",
    description: "A specialized intelligence platform built for the Solana ecosystem.",
    sections: [
      {
        content: "TokenSight AI is an AI-powered token intelligence platform built for the Solana ecosystem. It helps traders and researchers make data-driven decisions by analyzing on-chain data, liquidity depth, holder distribution, trading volume and social signals. All of these metrics are distilled into a single Intelligence Score."
      },
      {
        content: "Built and maintained by a solo full-stack developer passionate about crypto and cutting-edge web technology, the platform combines real-time blockchain data with intelligent scoring to give you an edge in the fast-moving Solana landscape."
      },
      {
        content: "Whether you are scouting newly launched tokens on Bags or evaluating established projects, TokenSight AI provides the signals you need - no noise, just intelligence."
      }
    ]
  },
  mission: {
    id: "mission",
    label: "Mission & Vision",
    title: "Mission & Vision",
    description: "Democratizing crypto token intelligence for everyone.",
    sections: [
      {
        title: "🎯 Our Mission",
        content: "To democratize crypto token intelligence by making professional-grade analysis accessible to every trader, regardless of experience or portfolio size. We believe everyone deserves accurate and real-time data to make confident entry decisions."
      },
      {
        title: "🔭 Our Vision",
        content: "To become the go-to intelligence layer for the Solana ecosystem. We are actively expanding into scan contests, community-driven insights, advanced portfolio analytics and a full-featured mobile experience. More features are actively being developed and shipped on a regular basis."
      }
    ]
  },
  scanner: {
    id: "scanner",
    label: "Token Scanner",
    title: "Token Scanner",
    description: "Analyze any Solana token address instantly.",
    sections: [
      {
        content: "The Token Scanner is the core of TokenSight AI. Paste any Solana token address in the input bar to get a complete intelligence report with a full breakdown of market and on-chain metrics."
      },
      {
        title: "How the Intelligence Score works",
        content: "The overall score (0-100) is the average of four sub-scores, each evaluating a different dimension of the token:",
        listItems: [
          { term: "Quality (0-100)", text: "Evaluates token fundamentals including liquidity depth, holder distribution, metadata completeness and social presence." },
          { term: "Momentum (0-100)", text: "Measures current market activity and trend strength, incorporating 24h volume, price action velocity and buyer-seller ratio patterns." },
          { term: "Confidence (0-100)", text: "Indicates how much the data sources agree with each other. High confidence means multiple signals are aligned and the analysis is consistent." },
          { term: "Risk Cap (0-100)", text: "The risk ceiling penalty. A score of 100 means no risk flags were detected. Lower values show concentrated holdings, low liquidity or suspicious patterns that cap the overall score." }
        ]
      },
      {
        title: "What you get in a scan result",
        listItems: [
          { term: "Token Info", text: "Logo image, name, symbol and quick action buttons visible at the top." },
          { term: "Security Badges", text: "Mint authority, freeze authority and LP burn profile details. Green indicates renounced and safe status while red highlights enabled risk factors." },
          { term: "Trust Signals", text: "Jupiter verification status, mutability settings, tax conditions and developer wallet balances." },
          { term: "Launch Metadata", text: "Launchpad details, pool establishment timestamps and first transaction records." },
          { term: "Trading Flow", text: "Trading volume, organic buyers and transaction statistics across multiple timeframes." },
          { term: "Liquidity Intelligence", text: "Meteora DLMM and DAMM v2 depth analysis, reserve-based price impact estimates and protocol split stats." },
          { term: "Intelligence Signals", text: "AI-generated findings classified by severity with color-coded warning indicators." },
          { term: "Market Metrics", text: "Price, liquidity, volume, market cap, top 10 wallet concentration and creator holdings." },
          { term: "Holder Breakdown", text: "Top 10 holder wallets with progress percentage bars and copy-on-hover shortcuts." },
          { term: "AI Summary", text: "A natural-language explanation highlighting bullish and bearish keywords." },
          { term: "Live Chart", text: "Embedded token price charts powered by DexScreener." },
          { term: "Swap Widget", text: "Direct token swapping with MEV protection powered by Jupiter." }
        ]
      },
      {
        title: "Risk Categories",
        listItems: [
          { term: "Strong Opportunity", text: "Score 85+ (Emerald theme color)" },
          { term: "Good Entry", text: "Score 60-84 (Blue theme color)" },
          { term: "Watch Signal", text: "Score 31-59 (Amber theme color)" },
          { term: "High Risk", text: "Score 30 or below (Rose theme color)" }
        ]
      }
    ]
  },
  portfolio: {
    id: "portfolio",
    label: "Portfolio Tracker",
    title: "Portfolio Tracker",
    description: "Track your token holdings, live values and overall profit.",
    sections: [
      {
        content: "Monitor your Solana token positions, track live prices and see your return on investment (ROI) at a glance."
      },
      {
        title: "Features",
        listItems: [
          { term: "Live Prices", text: "Current prices are fetched automatically via DexScreener." },
          { term: "ROI Calculations", text: "Real-time profit and loss calculations for each position." },
          { term: "Risk Classification", text: "Tag your positions as low, medium or high risk based on conviction." },
          { term: "Personal Notes", text: "Save private notes or research points directly on the token card." },
          { term: "Summary Dashboard", text: "Overview of total holdings, invested amounts, current valuations and overall PnL." }
        ]
      },
      {
        title: "How to use",
        listItems: [
          { term: "Step 1", text: "Go to the Portfolio page." },
          { term: "Step 2", text: "Input the token address, name, quantity and entry price." },
          { term: "Step 3", text: "Click Add to Portfolio to save the position." },
          { term: "Step 4", text: "Monitor live updates, edit entries or delete positions as needed." }
        ]
      }
    ]
  },
  alerts: {
    id: "alerts",
    label: "Alerts Center",
    title: "Alerts Center",
    description: "Configure real-time price alerts for any Solana token.",
    sections: [
      {
        content: "Set up price notifications for any Solana token and receive instant alerts when your conditions are met."
      },
      {
        title: "Alert Types",
        listItems: [
          { term: "Price Drop", text: "Triggers when the token price falls below your specified limit." },
          { term: "Price Rise", text: "Triggers when the token price rises above your specified limit." },
          { term: "Volume Spike", text: "Triggers on unusual volume activity changes." }
        ]
      },
      {
        title: "How to use",
        listItems: [
          { term: "Step 1", text: "Navigate to the Alerts page or click the Set Alert button in any scan report." },
          { term: "Step 2", text: "Select the alert type and specify the price target." },
          { term: "Step 3", text: "Click Create Alert to save and activate the monitor." },
          { term: "Step 4", text: "Manage active alerts from the dashboard, which also syncs with your Telegram bot." }
        ]
      }
    ]
  },
  telegram: {
    id: "telegram",
    label: "Telegram Bot",
    title: "Telegram Bot",
    description: "Get notifications and alerts directly in Telegram.",
    sections: [
      {
        content: "Connect your Telegram account to receive scan summaries and price alerts directly in your chat via @TokenSightai_bot."
      },
      {
        title: "Current Features",
        listItems: [
          { term: "Alert Delivery", text: "Get immediate notifications when your price targets trigger." },
          { term: "Scan Card Preview", text: "Receive quick token scan summaries directly in chat." }
        ]
      },
      {
        title: "How to link",
        listItems: [
          { term: "Step 1", text: "Open @TokenSightai_bot in Telegram and tap /start." },
          { term: "Step 2", text: "Copy the unique Telegram ID sent by the bot." },
          { term: "Step 3", text: "Navigate to Settings - Telegram on TokenSight AI, enter the ID and click Link." }
        ]
      }
    ]
  },
  sightai: {
    id: "sightai",
    label: "Sight AI",
    title: "Sight AI - Your Copilot",
    description: "The built-in assistant for quick insights and operations.",
    sections: [
      {
        content: "Sight AI is the interactive assistant residing on every page. Accessible via the floating chat bubble, it gives you conversational access to the platform's intelligence engine without disrupting your workspace."
      },
      {
        title: "Key Capabilities",
        listItems: [
          { term: "Token Lookup", text: "Ask about any token by name or address. The bot fetches price, liquidity, volume and market cap." },
          { term: "Scan Summaries", text: "Request a scan and receive the intelligence score, risk flags and signals directly in chat." },
          { term: "Alert Creation", text: "Set price-drop or price-rise targets directly through conversation." },
          { term: "Profile Updates", text: "Instruct the assistant to change your username or update your avatar." },
          { term: "Grounded Answers", text: "Sight AI uses real-time data feeds and documentation files to answer questions accurately without hallucinations." }
        ]
      }
    ]
  },
  profile: {
    id: "profile",
    label: "Your Profile",
    title: "Your Profile",
    description: "Manage your account settings and stats.",
    sections: [
      {
        content: "Your profile is a personalized dashboard for managing your identity, tracking your scanning achievements and checking your standings."
      },
      {
        title: "Profile Features",
        listItems: [
          { term: "Custom Identity", text: "Modify your username and choose your avatar." },
          { term: "Global Rankings", text: "Check your current position on the global leaderboard." },
          { term: "Skill Rating", text: "Assigned automatically based on your scan history and accuracy." },
          { term: "Streak Counter", text: "Tracks consecutive days of scanning activity with a fire animation." },
          { term: "League Tier", text: "Bronze, Silver, Gold and beyond, determined by your total scan count." },
          { term: "Detailed Stats", text: "Monitor weekly averages, lifetime scans, accuracy records and conviction hits." }
        ]
      }
    ]
  },
  history: {
    id: "history",
    label: "Scan History",
    title: "Scan History",
    description: "Audit your past token searches.",
    sections: [
      {
        content: "Every scan you execute is recorded in your personal history feed. Review previous analyses, compare score shifts over time and audit your selection choices."
      },
      {
        title: "Features",
        listItems: [
          { term: "Search Logs", text: "View token name, score, risk rating and date for each record." },
          { term: "Sorting", text: "Sort and search through your past checks." },
          { term: "Cloud Sync", text: "Logs are synced with your account securely." }
        ]
      }
    ]
  },
  leaderboard: {
    id: "leaderboard",
    label: "Leaderboard",
    title: "Leaderboard",
    description: "Compete with other token analysts.",
    sections: [
      {
        content: "Climb the ranks and benchmark your performance against other analysts in the community."
      },
      {
        title: "How it works",
        listItems: [
          { term: "XP Levels", text: "Earn experience points for each token scan. Higher scans yield higher levels." },
          { term: "League Tiers", text: "Advance through Bronze, Silver, Gold and Elite rankings as you level up." },
          { term: "Streaks", text: "Maintain daily streak points to climb the board faster." },
          { term: "Leaderboard standings", text: "See where you stand in the top 50 rankings." }
        ]
      }
    ]
  },
  "dev-setup": {
    id: "dev-setup",
    label: "Dev Setup",
    title: "Developer Setup Guide",
    description: "Step-by-step instructions to configure and run the TokenSight AI local development environment.",
    sections: [
      {
        title: "Prerequisites",
        content: "Before setting up TokenSight AI locally, ensure that your development machine has the following tools and account keys configured:"
      },
      {
        listItems: [
          { term: "Node.js 18+", text: "LTS version is recommended. Required to compile React components, execute Next.js route handlers, and run linting/build tools." },
          { term: "Supabase Project", text: "Create a database project at supabase.com. Used to provision the PostgreSQL database, manage Row Level Security policies, and store profiles and scans." },
          { term: "Privy Console", text: "Register an application at dashboard.privy.io to retrieve your Privy App ID and App Secret. Used for user identity and non-custodial wallet auth." },
          { term: "Solana RPC API Keys", text: "Account endpoints with Helius, Birdeye, DexScreener, and Jupiter to retrieve real-time token states, pool reserves, and pricing feeds." },
          { term: "OpenRouter Key", text: "API key from openrouter.ai to access LLM completion queries (e.g. gpt-4o-mini) for automated token summary analytics." }
        ]
      },
      {
        title: "Step 1: Clone the Repository",
        content: "Clone the TokenSight AI repository to your local computer and navigate into the workspace directory:",
        codeBlock: "git clone https://github.com/mrarindam/TokenSight-Ai.git\ncd TokenSight-Ai"
      },
      {
        title: "Step 2: Install Dependencies",
        content: "Install the required packages using npm. The workspace resolves all dependencies (Next.js, Privy, Supabase, Tailwind, Framer Motion) at the root level:",
        codeBlock: "npm install"
      },
      {
        title: "Step 3: Configure Environment Variables",
        content: "Create a new file named .env.local in the root directory. Copy the keys from .env.example and populate them with your credentials:",
        codeBlock: `# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Privy Non-Custodial Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret

# Application URL Configurations
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Solana API Keys & Services
BIRDEYE_API_KEY=your-birdeye-api-key
BAGS_API_KEY=your-bags-api-key
HELIUS_API_KEY=your-helius-api-key
JUPITER_API_KEY=your-jupiter-api-key

# LLM AI Integration (OpenRouter)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openai/gpt-4o-mini

# Telegram Integration
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
CRON_SECRET=your-cron-secret`
      },
      {
        title: "Step 4: Set Up Supabase Database Tables",
        content: "Execute SQL queries in your Supabase SQL Editor to prepare the database. Ensure Row Level Security (RLS) is configured correctly for the tables:"
      },
      {
        listItems: [
          { term: "users", text: "Caches authenticated user profiles, Privy wallet identifiers, streak counters, and premium membership tiers." },
          { term: "user_stats", text: "Tracks lifetime scan volumes, current streaks, experience levels, and league standings." },
          { term: "scans", text: "Persists analyzed token details (mint addresses, overall intelligence scores, volume, risk checks)." },
          { term: "price_alerts", text: "Stores target prices, conditions, token metadata, and user links for Telegram notifications." },
          { term: "ip_scans", text: "Logs rate-limiting activities mapping anonymous IP lookups to daily scan reset tickers." }
        ]
      },
      {
        title: "Step 5: Run the Development Server",
        content: "Start the local Next.js development server. The project will compile assets and launch on port 3000:",
        codeBlock: "npm run dev"
      },
      {
        title: "Step 6: Verify TypeScript Types",
        content: "Confirm that the codebase has no compilation errors or type inconsistencies:",
        codeBlock: "npx tsc --noEmit"
      },
      {
        title: "Project Directory Structure",
        content: "The workspace is structured cleanly as follows:",
        codeBlock: `TokenSight-Ai/
├── .env.local                  # Environment keys
├── package.json                # Next.js and Tailwind configurations
├── tailwind.config.ts          # Styling theme configurations
│
└── src/
    ├── app/                    # Next.js App Router directories
    │   ├── api/                # Route handlers (scan, telegram alerts, trending)
    │   ├── scan/               # Token scanner pages
    │   ├── portfolio/          # Portfolio tracker dashboard
    │   ├── alerts/             # User price alerts manager
    │   ├── docs/               # Documentation routes
    │   └── layout.tsx          # Global styles wrapper
    │
    ├── components/             # Reusable React components
    │   ├── layout/             # Header, footer, app layouts
    │   ├── ui/                 # Buttons, modals, skeletons
    │   └── RecentActivity.tsx  # Dashboard tables
    │
    └── lib/                    # Shared helpers and utilities
        ├── auth.ts             # Privy auth checks and login sync hooks
        ├── streak-logic.ts     # User streak calculations
        └── ip-limit.ts         # Anonymous user limits logic`
      }
    ]
  },
  architecture: {
    id: "architecture",
    label: "Architecture & Tech Stack",
    title: "Architecture & Tech Stack",
    description: "System architecture and technology stack details.",
    sections: [
      {
        content: ""
      }
    ]
  },
  "db-schema": {
    id: "db-schema",
    label: "Database Schema",
    title: "Database Schema",
    description: "Database tables, fields and relationship models.",
    sections: [
      {
        content: ""
      }
    ]
  },
  "auth-security": {
    id: "auth-security",
    label: "Authentication & Security",
    title: "Authentication & Security",
    description: "User authentication flows and system security measures.",
    sections: [
      {
        content: ""
      }
    ]
  },
  deployment: {
    id: "deployment",
    label: "Deployment & Infrastructure",
    title: "Deployment & Infrastructure",
    description: "Server hosting, build steps and deployment pipelines.",
    sections: [
      {
        content: ""
      }
    ]
  },
  roadmap: {
    id: "roadmap",
    label: "Roadmap",
    title: "Roadmap & What's Next",
    description: "The upcoming features in development.",
    sections: [
      {
        content: "TokenSight AI is constantly evolving with new updates scheduled for release:"
      },
      {
        listItems: [
          { term: "Solana Scan Contests", text: "Compete in predicting token performance to earn rewards and recognition." },
          { term: "Advanced Portfolio Analytics", text: "Allocation pie charts, portfolio growth history and visual ROI maps." },
          { term: "Telegram Bot V2", text: "Inline commands, portfolio lookups and scanning direct from chat." },
          { term: "Mobile Application", text: "Native application layouts for on-the-go checks." },
          { term: "Community Insights", text: "Shared watchlists and public rating systems." }
        ]
      }
    ]
  }
}
