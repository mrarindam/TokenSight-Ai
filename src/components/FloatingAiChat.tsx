"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePrivy } from "@privy-io/react-auth"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { BrainCircuit, ExternalLink, Loader2, Send, Sparkles, X, ArrowUpRight, ScanSearch } from "lucide-react"
import { useAuthFetch } from "@/lib/useAuthFetch"
import { cn } from "@/lib/utils"
import type { ChatCard, ChatLink, ChatMessage, ChatResponse, ChatResult, ChatRole } from "@/types/chat"

const INITIAL_SUGGESTIONS = [
  "What can TokenSight AI do?",
  "Scan a token for me",
  "Review my portfolio risk",
  "How do alerts and Telegram work?",
]

function createMessage(role: ChatRole, content: string, links?: ChatLink[], results?: ChatResult[], cards?: ChatCard[]): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    ...(links?.length ? { links } : {}),
    ...(results?.length ? { results } : {}),
    ...(cards?.length ? { cards } : {}),
  }
}

function cardToneClasses(tone: ChatCard["tone"]) {
  if (tone === "success") return "border-emerald-400/20 bg-emerald-400/8"
  if (tone === "warning") return "border-amber-400/20 bg-amber-400/8"
  if (tone === "info") return "border-primary/20 bg-primary/8"
  return "border-white/10 bg-black/20"
}

function getInitialMessages() {
  return [
    createMessage(
      "assistant",
      "I'm your TokenSight Copilot. Ask about platform features, your portfolio or alerts, or paste a Solana token address and I'll scan it for you.",
      [{ href: "/scan", label: "Scanner" }, { href: "/docs", label: "Docs" }],
    ),
  ]
}

function toneClasses(tone: ChatResult["tone"]) {
  if (tone === "success") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
  if (tone === "warning") return "border-amber-400/20 bg-amber-400/10 text-amber-100"
  return "border-primary/20 bg-primary/10 text-primary-foreground"
}

export function FloatingAiChat() {
  const { ready, authenticated } = usePrivy()
  const authFetch = useAuthFetch()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isThinking])

  const canShow = ready && authenticated && pathname !== "/login"

  if (!canShow) {
    return null
  }

  const sendMessage = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || isThinking) return

    const userMessage = createMessage("user", trimmed)
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput("")
    setIsThinking(true)

    try {
      const response = await authFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            links: message.links,
            results: message.results,
          })),
          currentPath: pathname,
        }),
      })

      const payload = (await response.json()) as ChatResponse & { error?: string }

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to reach the AI agent.")
      }

      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          payload.reply || "I couldn't generate a useful answer right now.",
          payload.links || [],
          payload.results || [],
          payload.cards || [],
        ),
      ])
      setSuggestions(Array.isArray(payload.suggestions) && payload.suggestions.length ? payload.suggestions : INITIAL_SUGGESTIONS)
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          error instanceof Error
            ? error.message
            : "The AI agent is unavailable right now. Try again in a moment.",
        ),
      ])
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-end p-3 sm:p-4">
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {isOpen ? (
          <div className="animate-chat-panel-in flex h-[min(78vh,720px)] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[2rem] border border-primary/20 bg-[#050912]/95 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:w-[26rem] max-sm:h-[min(82vh,720px)]">
            <div className="border-b border-white/10 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_30px_rgba(37,99,235,0.15)]">
                    <span className="animate-ai-orbit absolute inset-1 rounded-[1rem] border border-primary/25" />
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black tracking-wide text-white">Sight AI</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-white/55">
                      <Sparkles className="h-3 w-3 text-primary" />
                      TokenSight Copilot
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close AI chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {messages.map((message) => (
                <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_8px_24px_rgba(0,0,0,0.22)]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-white/10 bg-white/5 text-white/85",
                    )}
                  >
                    <div className="max-w-full overflow-hidden text-sm leading-6 break-words">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-3 last:mb-0 break-words whitespace-pre-wrap">{children}</p>,
                          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
                          li: ({ children }) => <li className="break-words">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                          code: ({ children }) => <code className="rounded bg-black/25 px-1 py-0.5 text-[0.9em] break-all">{children}</code>,
                          a: ({ href, children }) => {
                            if (!href) return <span>{children}</span>
                            const external = href.startsWith("http")
                            const className = "inline-flex items-center gap-1 text-primary underline underline-offset-4"
                            return external ? (
                              <a href={href} target="_blank" rel="noreferrer" className={className}>
                                {children}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <Link href={href} className={className}>
                                {children}
                              </Link>
                            )
                          },
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {message.results?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.results.map((result) => (
                          <div
                            key={`${message.id}-${result.title}`}
                            className={cn("rounded-2xl border px-3 py-2 text-xs leading-5", toneClasses(result.tone))}
                          >
                            <div className="font-bold">{result.title}</div>
                            <div className="mt-1 opacity-90 break-words">{result.description}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {message.cards?.length ? (
                      <div className="mt-3 space-y-3">
                        {message.cards.map((card, index) => (
                          <div
                            key={`${message.id}-card-${card.type}-${index}`}
                            className={cn("rounded-2xl border p-3", cardToneClasses(card.tone))}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-white">{card.title}</div>
                                {card.subtitle ? <div className="mt-1 text-xs text-white/60 break-all">{card.subtitle}</div> : null}
                              </div>
                              {card.badges?.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {card.badges.map((badge) => (
                                    <span key={badge} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/75">
                                      {badge}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>

                            {card.metrics?.length ? (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                {card.metrics.map((metric) => (
                                  <div key={`${card.title}-${metric.label}`} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{metric.label}</div>
                                    <div className="mt-1 text-sm font-semibold text-white break-all">{metric.value}</div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {message.links?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.links.map((link) => (
                          <a
                            key={`${message.id}-${link.href}`}
                            href={link.href}
                            target={link.external ? "_blank" : undefined}
                            rel={link.external ? "noreferrer" : undefined}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary transition hover:bg-primary/20"
                          >
                            {link.label}
                            {link.external ? <ExternalLink className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {isThinking ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-white/5 px-4 py-3 text-sm text-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
                    <div className="flex items-end gap-1">
                      <span className="animate-ai-wave h-2 w-1.5 rounded-full bg-primary/80 [animation-delay:0ms]" />
                      <span className="animate-ai-wave h-4 w-1.5 rounded-full bg-primary/65 [animation-delay:120ms]" />
                      <span className="animate-ai-wave h-3 w-1.5 rounded-full bg-primary/90 [animation-delay:240ms]" />
                    </div>
                    <div>
                      <div className="font-semibold text-white/85">Sight AI is analyzing</div>
                      <div className="text-xs text-white/45">Reading token and profile signals...</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/10 bg-black/20 px-4 py-4 sm:px-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void sendMessage(suggestion)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:border-primary/20 hover:bg-primary/10 hover:text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-[#060b15] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        void sendMessage(input)
                      }
                    }}
                    placeholder="Ask about TokenSight, your data, or paste a Solana token address..."
                    className="min-h-[52px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                    rows={2}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage(input)}
                    disabled={isThinking || !input.trim()}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(37,99,235,0.35)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="Send message"
                  >
                    {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="group relative overflow-hidden rounded-full border border-primary/20 bg-[#071120]/95 px-4 py-3 text-white shadow-[0_14px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_22px_54px_rgba(0,0,0,0.48)]"
          aria-label="Open TokenSight AI chat"
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_42%),linear-gradient(120deg,transparent,rgba(59,130,246,0.08),transparent)] opacity-80 transition duration-500 group-hover:opacity-100 group-hover:[background-position:100%_0]" />
          <span className="relative flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary shadow-[0_0_30px_rgba(37,99,235,0.18)] transition duration-500 group-hover:scale-105 group-hover:bg-primary/20">
              <span className="animate-ai-pulse-ring absolute inset-0 rounded-full border border-primary/25" />
              <span className="absolute inset-[5px] rounded-full border border-primary/15 opacity-0 transition duration-500 group-hover:opacity-100" />
              <ScanSearch className="h-5 w-5 transition duration-500 group-hover:scale-110 group-hover:-rotate-6" />
            </span>

            <span className="text-left">
              <span className="block text-[11px] font-black uppercase tracking-[0.24em] text-primary/80 transition duration-300 group-hover:text-primary">AI Assistant</span>
              <span className="mt-0.5 block text-sm font-bold text-white">Sight AI</span>
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}