import SearchResultList from "@components/search/search-result-list"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover"
import { Search } from "lucide-react"
import React, { useState } from "react"

const SearchBox = () => {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")

    const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    id="search-bar"
                    type="button"
                    className="relative rounded-md bg-foreground/15 hover:bg-foreground/25 mr-2 ml-0 w-full sm:ml-3 sm:w-auto cursor-text flex items-center border-none"
                >
                    <div className="px-2 h-full absolute pointer-events-none flex items-center justify-center">
                        <Search className="size-5 text-foreground/70" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search..."
                        aria-label="search"
                        className="bg-transparent text-inherit pl-10 pr-2 py-2 w-full md:w-[30ch] outline-none transition-[width] duration-200"
                        onChange={handleQueryChange}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => setOpen(true)}
                        value={query}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px] p-0" align="start">
                <div className="flex items-center justify-center">
                    <SearchResultList query={query} />
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default SearchBox
