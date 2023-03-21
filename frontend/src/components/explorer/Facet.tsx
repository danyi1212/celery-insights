import FacetQuickFilter from "@components/explorer/FacetQuickFilter"
import FacetValue from "@components/explorer/FacetValue"
import ClearAllIcon from "@mui/icons-material/ClearAll"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import Box from "@mui/material/Box"
import Collapse from "@mui/material/Collapse"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import List from "@mui/material/List"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import React, { useState } from "react"

interface FacetProps {
    title: string
    counts: Map<string, number>
    selected: Set<string>
    setSelected: (value: Set<string>) => void
    valueFormatter?: (value: string) => React.ReactElement | string
}

const FACET_MAX_HEIGHT = 42 * 8 // 8 list items

const Facet: React.FC<FacetProps> = ({ title, counts, selected, setSelected, valueFormatter }) => {
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
        <Box onMouseEnter={() => setHover(!isOpen)} onMouseLeave={() => setHover(false)}>
            <Box display="flex">
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
                    <FacetQuickFilter filter={filter} setFilter={setFilter} />
                    <List sx={{ maxHeight: FACET_MAX_HEIGHT, overflow: "auto" }} disablePadding>
                        {Array.from(counts.entries())
                            .filter(([value]) => !filter || value.toLowerCase().includes(filter.toLowerCase()))
                            .sort((a, b) => b[1] - a[1])
                            .map(([value, count]) => (
                                <FacetValue
                                    key={value}
                                    value={value}
                                    label={valueFormatter ? valueFormatter(value) : value}
                                    count={count}
                                    selected={selected}
                                    onSelect={() => handleSelect(value)}
                                />
                            ))}
                    </List>
                </Box>
            </Collapse>
        </Box>
    )
}
export default Facet
