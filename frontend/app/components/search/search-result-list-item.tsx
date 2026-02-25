import React from "react"
import { Link } from "@tanstack/react-router"

interface SearchResultListItemProps {
    avatar: React.ReactNode
    primary: string
    secondary: string
    link: string
}

const SearchResultListItem: React.FC<SearchResultListItemProps> = ({ avatar, primary, secondary, link }) => {
    return (
        <li>
            <Link to={link} className="flex items-center gap-3 px-4 py-2 hover:bg-accent transition-colors rounded-md">
                <div className="shrink-0">{avatar}</div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{primary}</p>
                    <p className="text-xs text-muted-foreground truncate">{secondary}</p>
                </div>
            </Link>
        </li>
    )
}
export default SearchResultListItem
