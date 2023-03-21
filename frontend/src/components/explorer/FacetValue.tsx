import Checkbox from "@mui/material/Checkbox"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import React from "react"

interface FacetValueProps {
    value: string
    label: React.ReactElement | string
    count: number
    onSelect: () => void
    selected: Set<string>
}

const FacetValue: React.FC<FacetValueProps> = ({ value, count, selected, onSelect, label }) => (
    <ListItem dense disablePadding>
        <ListItemButton dense sx={{ p: 0, pl: 2 }} onClick={onSelect}>
            <ListItemIcon sx={{ minWidth: 0 }}>
                <Checkbox edge="start" tabIndex={-1} checked={selected.size === 0 || selected.has(value)} />
            </ListItemIcon>
            <Tooltip title={value} placement="right" arrow>
                <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                        variant: "caption",
                        maxWidth: "80%",
                        noWrap: true,
                    }}
                />
            </Tooltip>
            <ListItemSecondaryAction>
                <Typography>{count}</Typography>
            </ListItemSecondaryAction>
        </ListItemButton>
    </ListItem>
)
export default FacetValue
