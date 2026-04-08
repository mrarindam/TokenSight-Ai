'use client'

import React, { useState } from 'react'
import { Plus, Minus, MessageSquare, HelpCircle, ArrowRight } from 'lucide-react'
import { cn } from "@/lib/utils"

interface FAQItemProps {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div 
      className={cn(
        "group border-b border-border/10 last:border-0 transition-all duration-300",
        isOpen ? "bg-primary/[0.03] shadow-inner" : "hover:bg-white/[0.01]"
      )}
    >
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left px-4 md:px-6 outline-none"
      >
        <span className={cn(
          "text-sm md:text-base font-bold tracking-tight transition-colors duration-300",
          isOpen ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
        )}>
          {question}
        </span>
        <div className={cn(
          "ml-4 flex-shrink-0 w-8 h-8 rounded-full border border-border/20 flex items-center justify-center transition-all duration-500",
          isOpen ? "bg-primary border-primary rotate-180" : "bg-muted/10 group-hover:border-primary/50 group-hover:bg-primary/5"
        )}>
          {isOpen ? (
            <Minus className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
      </button>
      
      <div 
        className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 md:px-6 pb-6 text-sm md:text-[15px] leading-relaxed text-muted-foreground/80 font-medium whitespace-pre-wrap">
          {answer.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
            /https?:\/\/[^\s]+/.test(part) ? (
              <a 
                key={i} 
                href={part} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:text-primary/70 transition-colors font-bold underline underline-offset-4 decoration-primary/30"
              >
                {part}
              </a>
            ) : part
          )}
        </div>
      </div>
    </div>
  )
}

const FAQ_DATA = [
  {
    question: "What is TokenSight AI?",
    answer: "TokenSight AI is an AI-powered token intelligence platform built on Solana. It scans any token address and generates an Intelligence Score based on liquidity, holder distribution, trading activity, creator behavior, and on-chain signals - helping you make smarter entry decisions with real data instead of hype."
  },
  {
    question: "How does the Intelligence Score work?",
    answer: "The Intelligence Score is the average of four core parameters:\n\n- Quality - evaluates liquidity depth, holder count, whale concentration, creator behavior, metadata, and token age\n- Momentum - measures 24h volume, volume-to-liquidity efficiency, and market readiness\n- Confidence - how much reliable data was available for the scan\n- Risk Cap - safety ceiling that limits the score when extreme red flags are detected\n\nIntelligence Score = (Quality + Momentum + Confidence + Risk Cap) / 4\n\nEach parameter scores 0-100, and the final score is easy to understand at a glance."
  },
  {
    question: "What do the score labels mean?",
    answer: "Each scan result gets a label based on the Intelligence Score:\n\n- STRONG OPPORTUNITY (75+, HIGH confidence) - Strong setup across all metrics\n- GOOD ENTRY (60+) - Constructive setup worth watching\n- WATCH SIGNAL (40-59) - Mixed signals, needs more data\n- WEAK ENTRY (below 40) - Weak fundamentals, high risk\n\nThese labels help you quickly assess without reading every detail."
  },
  {
    question: "Can I scan any Solana token?",
    answer: "Yes - TokenSight AI can scan any Solana token address. We pull data from Helius, Birdeye, DexScreener, and Bags API in parallel. Even very new tokens with limited data will get a fair scan - missing data lowers confidence rather than penalizing the score."
  },
  {
    question: "How does the Portfolio feature work?",
    answer: "After scanning a token, you can add it to your portfolio directly from the scan results. A popup lets you enter your quantity, entry price, and status (Holding, Watching, or Sold). The token address, name, and risk level are auto-filled from the scan.\n\nYou can manage all your positions from the Portfolio dashboard."
  },
  {
    question: "How do Price Alerts work?",
    answer: "From any scan result, click 'Set Alert' to create a custom price alert. You can choose:\n\n- Alert Type - Price Drop, Price Rise, or Score Change\n- Condition - Below, Above, or Change by %\n- Threshold - your target price or percentage\n\nThe token address and name are auto-filled. Alerts are monitored automatically and notifications are sent via Telegram if linked."
  },
  {
    question: "What is the Active Streak?",
    answer: "Your Active Streak counts how many consecutive days you've scanned at least one token. It resets if you miss a day, but restarts at 1 on your next scan - you never get stuck at 0.\n\nStreaks are calculated from your actual scan history in the database, so they're always accurate."
  },
  {
    question: "How does the Leaderboard work?",
    answer: "The leaderboard ranks analysts by total scan count. The more tokens you scan, the higher your rank.\n\nYour Intelligence Accuracy and streak are displayed as skill indicators but don't affect ranking. Leaderboard data refreshes every 15 seconds."
  },
  {
    question: "What data sources does TokenSight use?",
    answer: "TokenSight pulls data from multiple sources in parallel:\n\n- Helius - on-chain holder data, creator wallet history, token accounts\n- Birdeye - real-time price, liquidity, volume, token overview\n- DexScreener - pair data, market depth, trading pairs\n- Bags API - token launch metadata, social links, descriptions\n- Jupiter - swap integration and routing\n\nData from multiple sources is cross-checked for accuracy."
  },
  {
    question: "What does the AI Summary explain?",
    answer: "The Intelligence Summary at the bottom of every scan result breaks down exactly why each parameter scored what it did:\n\n- Quality - explains liquidity, holders, whale %, creator history\n- Momentum - explains volume, V/L ratio, market status\n- Confidence - explains data availability and metadata coverage\n- Risk Cap - lists specific risk flags that capped the score\n\nThe final line shows the Intelligence Score formula so you can verify it yourself."
  },
  {
    question: "Is this financial advice?",
    answer: "No. TokenSight AI provides data-driven intelligence and on-chain analytics - not financial advice. Always do your own research (DYOR) before making any trading decisions."
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      {/* Background Glows for the section */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] pointer-events-none opacity-20" />
      
      <div className="container max-w-4xl px-4 md:px-6 relative z-10">
        {/* HEADER */}
        <div className="text-center space-y-4 mb-16 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md mb-2">
            <HelpCircle className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Intelligence Hub</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-foreground animate-fade-up" style={{ animationDelay: '0.1s' }}>
            FREQUENTLY ASKED <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">QUESTIONS</span>
          </h2>
          <p className="text-muted-foreground/60 text-sm md:text-base max-w-2xl mx-auto font-medium leading-relaxed animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Everything you need to know about TokenSight AI and how it helps you make smarter entry decisions in the token intelligence landscape.
          </p>
        </div>

        {/* ACCORDION CARDS */}
        <div className="glass-strong rounded-[2.5rem] border border-border/10 overflow-hidden shadow-2xl relative animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          
          <div className="py-2">
            {FAQ_DATA.map((item, index) => (
              <FAQItem 
                key={index}
                question={item.question}
                answer={item.answer}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </div>

        {/* CTA BOTTOM */}
        <div className="mt-12 text-center animate-in fade-in slide-in-from-bottom duration-700 delay-500">
           <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-3 glass py-4 px-8 rounded-2xl border border-white/5">
                 <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
                    <MessageSquare className="h-5 w-5" />
                 </div>
                 <div className="text-left">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Still have questions?</p>
                    <p className="text-sm font-bold text-foreground">Join our active surveillance community.</p>
                 </div>
              </div>
              
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4">
                 <a 
                   href="https://t.me/MrxArindam" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className={cn(
                     "inline-flex items-center justify-center h-12 px-8 rounded-xl border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all duration-500 font-bold tracking-tight text-xs uppercase shadow-lg shadow-primary/5"
                   )}
                 >
                    Join Telegram
                 </a>
                 <a 
                   href="https://mrarindam.vercel.app/" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className={cn(
                     "inline-flex items-center justify-center h-12 px-8 rounded-xl border border-border/50 transition-all duration-500 font-black tracking-tight text-xs uppercase shadow-sm",
                     "bg-slate-200/50 text-slate-700 hover:bg-slate-200",
                     "dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
                   )}
                 >
                    CEO Website
                 </a>
                 <a 
                   href="mailto:marindam342@gmail.com"
                   className={cn(
                     "inline-flex items-center justify-center h-12 px-8 rounded-xl text-muted-foreground hover:text-foreground transition-colors text-xs font-black uppercase tracking-widest"
                   )}
                 >
                    Send Mail <ArrowRight className="ml-2 h-3.5 w-3.5" />
                 </a>
              </div>

              {/* CEO LOGO / BRANDING SUBTLE */}
              <div className="pt-4 opacity-40 hover:opacity-100 transition-opacity flex flex-col items-center gap-1 group">
                 <div className="text-[10px] font-black tracking-[0.5em] text-foreground/50 group-hover:text-primary transition-colors">THE NETWORK LEAD & DEVELOPED BY</div>
                 <div className="text-xl font-black italic tracking-tighter text-foreground">ARINDAM <span className="text-primary text-[6px] not-italic align-top ml-0.5">Â©</span></div>
              </div>
           </div>
        </div>
      </div>
    </section>
  )
}
