import CodeBlock from "@components/common/code-block"
import { Button, buttonVariants } from "@components/ui/button"
import { cn } from "@lib/utils"
import { Link } from "@tanstack/react-router"
import { MDXProvider } from "@mdx-js/react"
import { ArrowUp, ChevronLeft, ChevronRight, Copy, Link as LinkIcon, PencilLine } from "lucide-react"
import React, { useEffect, useMemo, useRef, useState } from "react"

type DocsPageHeading = {
    id: string
    title: string
    level: 2 | 3 | 4
}

type DocsPageNavLink = {
    title: string
    href: string
}

type DocsPageSource = {
    path: string
    markdown: string
}

const headingClassNames = {
    h2: "mt-8 scroll-mt-24 text-2xl font-semibold tracking-tight text-foreground",
    h3: "mt-6 scroll-mt-24 text-xl font-semibold tracking-tight text-foreground",
    h4: "mt-4 scroll-mt-24 text-base font-semibold tracking-tight text-foreground",
}

const AnchorHeading = ({
    id,
    className,
    children,
    as: Tag,
}: React.PropsWithChildren<{
    id?: string
    className: string
    as: "h2" | "h3" | "h4"
}>) => {
    if (!id) {
        return <Tag className={className}>{children}</Tag>
    }

    return (
        <Tag id={id} className={cn("group flex items-center gap-2", className)}>
            <span>{children}</span>
            <a
                href={`#${id}`}
                aria-label="Copy section link"
                className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
                <LinkIcon className="size-4" />
            </a>
        </Tag>
    )
}

const InlineCode = ({ className, children, ...props }: React.ComponentProps<"code">) => (
    <code className={cn("rounded bg-muted px-1.5 py-0.5 text-sm font-medium text-foreground", className)} {...props}>
        {children}
    </code>
)

const PreBlock = ({ children, ...props }: React.ComponentProps<"pre">) => {
    if (React.isValidElement(children)) {
        const childProps = children.props as { className?: string; children?: React.ReactNode }
        const language = childProps.className?.replace(/^language-/, "")
        const code = typeof childProps.children === "string" ? childProps.children : String(childProps.children ?? "")

        return <CodeBlock language={language}>{code.replace(/\n$/, "")}</CodeBlock>
    }

    return <pre {...props}>{children}</pre>
}

const mdxComponents = {
    h2: ({ id, children, className }: React.ComponentProps<"h2">) => (
        <AnchorHeading id={id} as="h2" className={cn(headingClassNames.h2, className)}>
            {children}
        </AnchorHeading>
    ),
    h3: ({ id, children, className }: React.ComponentProps<"h3">) => (
        <AnchorHeading id={id} as="h3" className={cn(headingClassNames.h3, className)}>
            {children}
        </AnchorHeading>
    ),
    h4: ({ id, children, className }: React.ComponentProps<"h4">) => (
        <AnchorHeading id={id} as="h4" className={cn(headingClassNames.h4, className)}>
            {children}
        </AnchorHeading>
    ),
    p: ({ className, ...props }: React.ComponentProps<"p">) => (
        <p className={cn("mt-3.5 text-sm leading-7 text-muted-foreground", className)} {...props} />
    ),
    ul: ({ className, ...props }: React.ComponentProps<"ul">) => (
        <ul
            className={cn(
                "mt-3.5 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground marker:text-primary/70",
                className,
            )}
            {...props}
        />
    ),
    ol: ({ className, ...props }: React.ComponentProps<"ol">) => (
        <ol
            className={cn(
                "mt-3.5 list-decimal space-y-2 pl-5 text-sm leading-7 text-muted-foreground marker:text-primary/70",
                className,
            )}
            {...props}
        />
    ),
    li: ({ className, ...props }: React.ComponentProps<"li">) => (
        <li className={cn("pl-1 [&>p]:mt-0 [&>p]:leading-7 [&>ol]:mt-3 [&>ul]:mt-3", className)} {...props} />
    ),
    a: ({ className, children, ...props }: React.ComponentProps<"a">) => (
        <a
            className={cn(
                "font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary",
                className,
            )}
            {...props}
        >
            {children}
        </a>
    ),
    blockquote: ({ className, ...props }: React.ComponentProps<"blockquote">) => (
        <blockquote
            className={cn("mt-4 border-l-2 border-primary/40 pl-4 text-sm leading-7 text-muted-foreground", className)}
            {...props}
        />
    ),
    hr: ({ className, ...props }: React.ComponentProps<"hr">) => (
        <hr className={cn("my-6 border-border/70", className)} {...props} />
    ),
    table: ({ className, ...props }: React.ComponentProps<"table">) => (
        <div className="mt-6 overflow-x-auto">
            <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
        </div>
    ),
    thead: ({ className, ...props }: React.ComponentProps<"thead">) => (
        <thead className={cn("border-b border-border/70", className)} {...props} />
    ),
    tbody: ({ className, ...props }: React.ComponentProps<"tbody">) => (
        <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
    ),
    tr: ({ className, ...props }: React.ComponentProps<"tr">) => (
        <tr className={cn("border-b border-border/60 align-top", className)} {...props} />
    ),
    th: ({ className, ...props }: React.ComponentProps<"th">) => (
        <th
            className={cn("px-3 py-3 text-sm font-semibold text-foreground first:pl-0 last:pr-0", className)}
            {...props}
        />
    ),
    td: ({ className, ...props }: React.ComponentProps<"td">) => (
        <td
            className={cn("px-3 py-3 align-top leading-7 text-muted-foreground first:pl-0 last:pr-0", className)}
            {...props}
        />
    ),
    code: InlineCode,
    pre: PreBlock,
}

const extractHeadings = (article: HTMLElement | null): DocsPageHeading[] => {
    if (!article) {
        return []
    }

    return Array.from(article.querySelectorAll("h2[id], h3[id], h4[id]")).map((heading) => ({
        id: heading.id,
        title: heading.textContent?.trim() ?? "",
        level: heading.tagName === "H2" ? 2 : heading.tagName === "H3" ? 3 : 4,
    }))
}

const usePageHeadings = (articleRef: React.RefObject<HTMLElement | null>) => {
    const [headings, setHeadings] = useState<DocsPageHeading[]>([])

    useEffect(() => {
        const updateHeadings = () => setHeadings(extractHeadings(articleRef.current))
        updateHeadings()

        const observer = new MutationObserver(updateHeadings)
        if (articleRef.current) {
            observer.observe(articleRef.current, { childList: true, subtree: true })
        }

        return () => observer.disconnect()
    }, [articleRef])

    return headings
}

const useActiveHeading = (headings: DocsPageHeading[]) => {
    const [activeId, setActiveId] = useState<string>("")

    useEffect(() => {
        if (!headings.length) {
            setActiveId("")
            return
        }

        const updateActiveHeading = () => {
            const offset = 140
            let currentId = headings[0]?.id ?? ""

            for (const heading of headings) {
                const element = document.getElementById(heading.id)
                if (!element) {
                    continue
                }

                if (element.getBoundingClientRect().top - offset <= 0) {
                    currentId = heading.id
                } else {
                    break
                }
            }

            setActiveId(currentId)
        }

        updateActiveHeading()
        window.addEventListener("scroll", updateActiveHeading, { passive: true })
        window.addEventListener("resize", updateActiveHeading)

        return () => {
            window.removeEventListener("scroll", updateActiveHeading)
            window.removeEventListener("resize", updateActiveHeading)
        }
    }, [headings])

    return activeId
}

const useReadingProgress = (articleRef: React.RefObject<HTMLElement | null>) => {
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        const updateProgress = () => {
            const article = articleRef.current
            if (!article) {
                setProgress(0)
                return
            }

            const rect = article.getBoundingClientRect()
            const viewportHeight = window.innerHeight
            const start = viewportHeight * 0.15
            const total = Math.max(article.offsetHeight - viewportHeight * 0.4, 1)
            const nextProgress = Math.min(Math.max((start - rect.top) / total, 0), 1)
            setProgress(nextProgress)
        }

        updateProgress()
        window.addEventListener("scroll", updateProgress, { passive: true })
        window.addEventListener("resize", updateProgress)

        return () => {
            window.removeEventListener("scroll", updateProgress)
            window.removeEventListener("resize", updateProgress)
        }
    }, [articleRef])

    return progress
}

const GITHUB_REPO_URL = "https://github.com/danyi1212/celery-insights"

const buildEditOnGitHubUrl = (path: string) => `${GITHUB_REPO_URL}/edit/main/${path}`

const DocsTableOfContents = ({
    headings,
    activeId,
    progress,
    source,
}: {
    headings: DocsPageHeading[]
    activeId: string
    progress: number
    source?: DocsPageSource
}) => (
    <aside className="hidden xl:block">
        <div className="sticky top-20 space-y-2.5 pl-2">
            <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">On this page</p>
                <div className="h-1 overflow-hidden rounded-full bg-border/70">
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-150"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>
            </div>
            <nav className="max-h-[calc(100vh-10rem)] overflow-y-auto border-l border-border/70 pr-2">
                {headings.map((heading) => (
                    <a
                        key={heading.id}
                        href={`#${heading.id}`}
                        className={cn(
                            "block border-l border-transparent py-1 text-sm leading-5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
                            heading.level === 2 ? "-ml-px pl-4" : heading.level === 3 ? "pl-8" : "pl-12 text-xs",
                            activeId === heading.id && "border-primary text-foreground",
                        )}
                    >
                        {heading.title}
                    </a>
                ))}
            </nav>
            <DocsTableOfContentsActions source={source} />
        </div>
    </aside>
)

const DocsTableOfContentsActions = ({ source }: { source?: DocsPageSource }) => {
    const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")

    useEffect(() => {
        if (copyState === "idle") {
            return
        }

        const timeoutId = window.setTimeout(() => setCopyState("idle"), 2000)
        return () => window.clearTimeout(timeoutId)
    }, [copyState])

    const handleCopyMarkdown = async () => {
        if (!source?.markdown) {
            return
        }

        try {
            await navigator.clipboard.writeText(source.markdown)
            setCopyState("copied")
        } catch {
            setCopyState("error")
        }
    }

    const handleScrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    return (
        <div className="space-y-2 border-t border-border/70 pt-4">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start px-2 text-muted-foreground hover:text-foreground"
                onClick={handleCopyMarkdown}
                disabled={!source?.markdown}
            >
                <Copy className="size-4" />
                {copyState === "copied"
                    ? "Copied Markdown"
                    : copyState === "error"
                      ? "Copy Failed"
                      : "Copy as Markdown"}
            </Button>
            {source?.path ? (
                <a
                    href={buildEditOnGitHubUrl(source.path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "w-full justify-start px-2 text-muted-foreground hover:text-foreground",
                    )}
                >
                    <PencilLine className="size-4" />
                    Edit on GitHub
                </a>
            ) : null}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start px-2 text-muted-foreground hover:text-foreground"
                onClick={handleScrollToTop}
            >
                <ArrowUp className="size-4" />
                Scroll to Top
            </Button>
        </div>
    )
}

const DocsPageNavigation = ({
    previousPage,
    nextPage,
}: {
    previousPage?: DocsPageNavLink
    nextPage?: DocsPageNavLink
}) => {
    if (!previousPage && !nextPage) {
        return null
    }

    return (
        <div className="mt-16 grid gap-4 border-t border-border/70 pt-8 md:grid-cols-2">
            {previousPage ? (
                <Link
                    to={previousPage.href}
                    className="rounded-2xl border border-border/70 bg-card/60 p-5 no-underline transition-colors hover:border-primary/40 hover:bg-card"
                >
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ChevronLeft className="size-4" />
                        Previous
                    </span>
                    <p className="mt-2 text-lg font-semibold text-foreground">{previousPage.title}</p>
                </Link>
            ) : (
                <div />
            )}
            {nextPage ? (
                <Link
                    to={nextPage.href}
                    className="rounded-2xl border border-border/70 bg-card/60 p-5 text-right no-underline transition-colors hover:border-primary/40 hover:bg-card"
                >
                    <span className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                        Next
                        <ChevronRight className="size-4" />
                    </span>
                    <p className="mt-2 text-lg font-semibold text-foreground">{nextPage.title}</p>
                </Link>
            ) : null}
        </div>
    )
}

export default function DocsPage({
    title,
    description,
    group,
    source,
    previousPage,
    nextPage,
    tocMaxDepth = 2,
    children,
}: {
    title: string
    description: string
    group: string
    source?: DocsPageSource
    previousPage?: DocsPageNavLink
    nextPage?: DocsPageNavLink
    tocMaxDepth?: 2 | 3 | 4
    children: React.ReactNode
}) {
    const articleRef = useRef<HTMLElement>(null)
    const headings = usePageHeadings(articleRef)
    const tocHeadings = useMemo(
        () => headings.filter((heading) => heading.level <= tocMaxDepth),
        [headings, tocMaxDepth],
    )
    const activeId = useActiveHeading(tocHeadings)
    const progress = useReadingProgress(articleRef)
    const providerComponents = useMemo(() => mdxComponents, [])

    return (
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_14rem]">
            <article ref={articleRef} className="min-w-0 max-w-4xl pb-16">
                <header className="space-y-2.5 border-b border-border/70 pb-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">{group}</p>
                    <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">{title}</h1>
                    <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
                </header>

                <div className="mt-6">
                    <MDXProvider components={providerComponents}>{children}</MDXProvider>
                </div>

                <DocsPageNavigation previousPage={previousPage} nextPage={nextPage} />
            </article>

            <DocsTableOfContents headings={tocHeadings} activeId={activeId} progress={progress} source={source} />
        </div>
    )
}
