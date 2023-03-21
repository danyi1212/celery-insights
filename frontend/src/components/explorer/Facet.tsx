import CancelIcon from "@mui/icons-material/Cancel"
import ClearAllIcon from "@mui/icons-material/ClearAll"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import SearchIcon from "@mui/icons-material/Search"
import { InputAdornment, TextField } from "@mui/material"
import Box from "@mui/material/Box"
import Checkbox from "@mui/material/Checkbox"
import Collapse from "@mui/material/Collapse"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import React, { useState } from "react"

interface FacetProps {
    title: string
    counts: Map<string, number>
    selected: Set<string>
    setSelected: (value: Set<string>) => void
}

const FACET_MAX_HEIGHT = 42 * 8 // 8 list items
const Facet: React.FC<FacetProps> = ({ title, counts, selected, setSelected }) => {
    const [isOpen, setOpen] = useState<boolean>(true)
    const [isHover, setHover] = useState<boolean>(false)
    const [filter, setFilter] = useState<string>("")

    const handleSelect = (value: string) => {
        if (selected.has(value)) {
            const newSelected = new Set(selected)
            newSelected.delete(value)
            setSelected(newSelected)
        } else {
            setSelected(new Set(selected).add(value))
        }
    }

    const handleClearAll = () => setSelected(new Set())

    return (
        <Box>
            <Box display="flex" onMouseEnter={() => setHover(!isOpen)} onMouseLeave={() => setHover(false)}>
                <IconButton size="small" onClick={() => setOpen(!isOpen)}>
                    {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <Typography variant="h6" flexGrow={1} noWrap>
                    {title}
                </Typography>
                <Tooltip title="Clear selection">
                    <IconButton size="small" sx={{ mx: 1 }} onClick={() => handleClearAll()}>
                        <ClearAllIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            <Divider />
            <Collapse in={isOpen || isHover} orientation="vertical">
                <Box>
                    <TextField
                        variant="outlined"
                        placeholder="Filter values..."
                        size="small"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                        sx={{ p: 1 }}
                        inputProps={{ sx: { px: 1, py: 0.5 } }}
                        InputProps={{
                            sx: { px: 1, py: 0 },
                            startAdornment: (
                                <InputAdornment
                                    position="start"
                                    sx={{ m: 0, color: (theme) => theme.palette.text.disabled }}
                                >
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                            endAdornment: !filter ? null : (
                                <InputAdornment position="end" sx={{ m: 0 }}>
                                    <IconButton onClick={() => setFilter("")} edge="end" size="small">
                                        <CancelIcon color="disabled" sx={{ p: 0.4 }} />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                        fullWidth
                    />
                    <List sx={{ maxHeight: FACET_MAX_HEIGHT, overflow: "auto" }} disablePadding>
                        {Array.from(counts.entries())
                            .filter(([value]) => !filter || value.toLowerCase().includes(filter.toLowerCase()))
                            .sort((a, b) => b[1] - a[1])
                            .map(([value, count]) => (
                                <ListItem key={value} dense disablePadding>
                                    <ListItemButton dense sx={{ p: 0, pl: 2 }} onClick={() => handleSelect(value)}>
                                        <ListItemIcon sx={{ minWidth: 0 }}>
                                            <Checkbox
                                                edge="start"
                                                tabIndex={-1}
                                                checked={selected.size === 0 || selected.has(value)}
                                            />
                                        </ListItemIcon>
                                        <Tooltip title={value} placement="right" arrow>
                                            <ListItemText
                                                primary={value}
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
                            ))}
                    </List>
                </Box>
            </Collapse>
        </Box>
    )
}
export default Facet
