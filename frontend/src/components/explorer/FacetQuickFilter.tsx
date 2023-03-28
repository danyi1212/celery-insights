import CancelIcon from "@mui/icons-material/Cancel"
import SearchIcon from "@mui/icons-material/Search"
import IconButton from "@mui/material/IconButton"
import InputAdornment from "@mui/material/InputAdornment"
import TextField from "@mui/material/TextField"
import React from "react"

interface FacetQuickFilterProps {
    filter: string
    setFilter: (value: string) => void
}

const FacetQuickFilter: React.FC<FacetQuickFilterProps> = ({ filter, setFilter }) => {
    return (
        <TextField
            variant="outlined"
            placeholder="Filter values..."
            size="small"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            fullWidth
            sx={{ p: 1 }}
            inputProps={{ sx: { px: 1, py: 0.5 } }}
            InputProps={{
                sx: { px: 1, py: 0 },
                startAdornment: (
                    <InputAdornment position="start" sx={{ m: 0, color: (theme) => theme.palette.text.disabled }}>
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
        />
    )
}

export default FacetQuickFilter
