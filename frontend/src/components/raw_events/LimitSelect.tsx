import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import MenuItem from "@mui/material/MenuItem"
import Select from "@mui/material/Select"
import React from "react"

interface LimitSelectProps {
    limit: number
    setLimit: (limit: number) => void
}

export const LimitSelect: React.FC<LimitSelectProps> = ({ limit, setLimit }) => {
    return (
        <FormControl size="small">
            <InputLabel id="limit-select-label">Limit</InputLabel>
            <Select
                labelId="limit-select-label"
                id="limit-select"
                value={limit}
                label="Limit"
                onChange={(event) => setLimit(event.target.value as number)}
            >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={300}>300</MenuItem>
                <MenuItem value={1000}>1,000</MenuItem>
            </Select>
        </FormControl>
    )
}
