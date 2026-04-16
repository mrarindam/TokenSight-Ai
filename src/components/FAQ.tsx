'use client'

import React, { useState } from 'react'
import { Plus, Minus, HelpCircle } from 'lucide-react'
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
      
      <div className="dashboard-shell relative z-10">
        {/* HEADER */}
        <div className="mb-16 space-y-4 text-center animate-fade-up">
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
      </div>
    </section>
  )
}
