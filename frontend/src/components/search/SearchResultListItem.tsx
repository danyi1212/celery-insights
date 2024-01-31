import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import React from "react"
import { Link } from "react-router-dom"

interface SearchResultListItemProps {
    avatar: React.ReactNode
    primary: string
    secondary: string
    link: string
}

const SearchResultListItem: React.FC<SearchResultListItemProps> = ({ avatar, primary, secondary, link }) => {
    return (
        <ListItem disablePadding>
            <ListItemButton component={Link} to={link}>
                <ListItemAvatar>{avatar}</ListItemAvatar>
                <ListItemText primary={primary} secondary={secondary} />
            </ListItemButton>
        </ListItem>
    )
}
export default SearchResultListItem
