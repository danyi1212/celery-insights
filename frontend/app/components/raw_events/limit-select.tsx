import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import React from "react"

interface LimitSelectProps {
    limit: number
    setLimit: (limit: number) => void
}

export const LimitSelect: React.FC<LimitSelectProps> = ({ limit, setLimit }) => {
    return (
        <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
            <SelectTrigger size="sm">
                <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="300">300</SelectItem>
                <SelectItem value="1000">1,000</SelectItem>
            </SelectContent>
        </Select>
    )
}
