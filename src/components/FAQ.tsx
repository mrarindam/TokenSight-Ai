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
    answer: "TokenSight AI is an AI-powered token intelligence platform that analyzes early-stage and Bags ecosystem tokens using liquidity, trading activity, holder behavior, volume trends, and on-chain signals to help you make smarter entry decisions."
  },
  {
    question: "What is Bags?",
    answer: "Bags is a launch platform where new tokens are created and introduced to the market.\n\nTokenSight AI focuses on analyzing tokens that originate from Bags, especially during their early stages.\n\nYou can explore the platform here:\nhttps://bags.fm/"
  },
  {
    question: "Does TokenSight AI scan all tokens?",
    answer: "No — TokenSight AI currently focuses only on tokens launched within the Bags ecosystem.\n\nWe analyze all tokens that originate from Bags, including early-stage and newly launched tokens, using on-chain and market data.\n\nTokens from other platforms or ecosystems are not included at this time."
  },
  {
    question: "How is TokenSight different from rug detectors?",
    answer: "Instead of focusing on scams, TokenSight AI focuses on opportunity. It helps you evaluate token strength, momentum, and entry timing using real-time data."
  },
  {
    question: "What does the Intelligence Score mean?",
    answer: "Intelligence Score shows how strong a token’s overall setup looks based on real-time data.\n\nWe start every token at a neutral score of 50, then adjust it using key signals like liquidity, trading activity, holder distribution, and creator behavior.\n\nStrong signals push the score higher, while weak signals bring it down. If data is missing (common for new tokens), we don’t penalize it — instead, we lower the confidence level.\n\nIn simple terms:\nHigher score = stronger opportunity\nLower score = weaker setup\nConfidence = how reliable the data is"
  },
  {
    question: "How is the Intelligence Score calculated?",
    answer: "The Intelligence Score is calculated by analyzing multiple on-chain and market signals.\n\nEach token starts at 50, and we adjust the score based on:\n\n• Liquidity – strong liquidity increases confidence\n• Holders – more holders means better distribution\n• Volume & Momentum – shows real market activity\n• Creator Behavior – detects experienced or risky patterns\n• Early Stage Status – new tokens may have limited data\n\nEach factor adds or subtracts points depending on strength.\n\nIf some data is missing, we skip it instead of penalizing — so early-stage tokens are treated fairly."
  },
  {
    question: "How is Intelligence Accuracy calculated?",
    answer: "Intelligence Accuracy measures how effectively you identify strong token opportunities.\n\nEach scan contributes to your accuracy based on its quality. High-scoring tokens (70+) have the most impact, while low-quality scans have minimal effect.\n\nWe use a weighted average system, meaning better signals improve your accuracy faster.\n\nIn simple terms:\nMore high-quality scans = higher Intelligence Accuracy"
  },
  {
    question: "How does the leaderboard ranking work?",
    answer: "The leaderboard ranks analysts based on total scan activity.\n\nThe more tokens you scan, the higher your rank.\n\nMetrics like Intelligence Accuracy and streak show your skill and consistency, but they do not affect your rank.\n\nIn simple terms:\nMore scans = higher position on the leaderboard."
  },
  {
    question: "How are High-Confidence Signals selected?",
    answer: "We only show tokens that pass multiple checks for strength and quality.\n\nA token must have a strong Intelligence Score (65+), enough liquidity and trading activity (over $1K), and a basic profile (like logo, website, or social links).\n\nWe also filter out flagged or suspicious tokens.\n\nIn simple terms:\nStrong data + real market activity + complete profile = High-Confidence signal"
  },
  {
    question: "What are Early Stage Tokens?",
    answer: "Early Stage Tokens are newly launched tokens within the Bags ecosystem.\n\nThese tokens are in their early phase, which means they may have limited data, lower liquidity, and evolving market activity.\n\nThey can offer early opportunities, but also come with higher uncertainty."
  },
  {
    question: "Does TokenSight include all users' scans?",
    answer: "Yes. All scans — including both logged-in and anonymous users — are included in the platform’s analytics and insights."
  },
  {
    question: "How often is data updated?",
    answer: "Token data and signals are updated in real-time as new scans and on-chain activity occur."
  },
  {
    question: "Is this financial advice?",
    answer: "No. TokenSight AI provides data-driven insights, not financial advice. Always do your own research before making decisions."
  }
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
                 <div className="text-xl font-black italic tracking-tighter text-foreground">ARINDAM <span className="text-primary text-[6px] not-italic align-top ml-0.5">©</span></div>
              </div>
           </div>
        </div>
      </div>
    </section>
  )
}
