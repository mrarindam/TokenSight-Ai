import { DOC_PAGES } from "@/lib/docs-data"
import { notFound, redirect } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo"

interface PageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: PageProps) {
  const page = DOC_PAGES[params.slug]
  if (!page) return {}
  return buildPageMetadata({
    title: `${page.title} | TokenSight AI Documentation`,
    description: page.description,
    path: `/docs/${params.slug}`
  })
}

export function generateStaticParams() {
  return Object.keys(DOC_PAGES).map((slug) => ({ slug }))
}

export default async function DocsDetailPage({ params }: PageProps) {
  const { slug } = params
  
  if (slug === "about") {
    redirect("/docs")
  }

  const page = DOC_PAGES[slug]

  if (!page) {
    notFound()
  }

  return (
    <div className="space-y-8 animate-fade-up w-full">
      {/* Title block */}
      <div className="border-b border-border/20 pb-6">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground dark:text-white">{page.title}</h1>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground dark:text-zinc-400 mt-2 font-medium">{page.description}</p>
      </div>

      {/* Sections rendering */}
      <div className="space-y-6">
        {page.sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            {section.title && (
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground dark:text-white tracking-tight pt-2">{section.title}</h2>
            )}
            
            {section.content && (
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground/90 dark:text-zinc-300 leading-relaxed font-normal">
                {section.content}
              </p>
            )}

            {section.codeBlock && (
              <pre className="bg-muted/30 border border-border/20 rounded-xl p-4 font-mono text-xs overflow-x-auto text-foreground/80 dark:text-zinc-200 dark:bg-[#07090e] dark:border-border/30 whitespace-pre">
                {section.codeBlock}
              </pre>
            )}

            {section.listItems && (
              <div className="space-y-4 pt-1">
                {section.listItems.map((item, lIdx) => (
                  <div
                    key={lIdx}
                    className="border-l-2 border-primary/40 pl-4 py-1"
                  >
                    {item.term && (
                      <h3 className="font-extrabold text-foreground dark:text-white text-sm sm:text-base lg:text-lg mb-1">{item.term}</h3>
                    )}
                    <p className="text-xs sm:text-sm lg:text-base text-muted-foreground/85 dark:text-zinc-400 leading-relaxed font-normal">{item.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
export const dynamicParams = false
