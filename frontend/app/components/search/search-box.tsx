import { appShortcuts } from "@components/keyboard/shortcut-definitions"
import { ShortcutHint } from "@components/keyboard/shortcut-hint"
import QuickAccessDialog from "@components/search/quick-access-dialog"
import { useSearchBoxController } from "@components/search/search-box-controller"
import { cn } from "@lib/utils"
import { Search } from "lucide-react"
import { useEffect, useState } from "react"

const SearchBox = () => {
    const [focusNonce, setFocusNonce] = useState(0)
    const [open, setOpen] = useState(false)
    const { registerSearchBox } = useSearchBoxController()

    useEffect(() => {
        return registerSearchBox({
            close: () => setOpen(false),
            focus: () => {
                setOpen(true)
                setFocusNonce((current) => current + 1)
            },
            open: () => setOpen(true),
        })
    }, [registerSearchBox])

    return (
        <>
            <button
                id="search-bar"
                type="button"
                className={cn(
                    "relative mr-2 ml-0 flex h-9 w-full items-center rounded-md border bg-muted/60 px-3 text-left transition-colors sm:ml-3 sm:w-auto md:min-w-[30ch]",
                    "border-transparent hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
                )}
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label="Open quick search"
            >
                <Search className="size-4 text-muted-foreground" />
                <span className="ml-2 flex-1 truncate text-sm text-muted-foreground">
                    Search tasks, workers, pages, and features
                </span>
                <ShortcutHint className="hidden shrink-0 sm:inline-flex" sequence={appShortcuts.focusSearch} />
            </button>
            <QuickAccessDialog focusNonce={focusNonce} open={open} onOpenChange={setOpen} />
        </>
    )
}

export default SearchBox
