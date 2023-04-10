import { TypographyProps } from "@mui/material"
import { styled } from "@mui/material/styles"
import Typography from "@mui/material/Typography"
import React from "react"

interface DetailItemProps {
    label: string
    value: React.ReactNode
    color?: TypographyProps["color"]
}

const DetailContainer = styled("div")({
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
})
const DetailItem: React.FC<DetailItemProps> = ({ label, value, color }) => {
    return (
        <DetailContainer>
            <Typography
                component="span"
                color={color || "primary"}
                sx={{ fontWeight: (theme) => theme.typography.fontWeightBold, pr: 1 }}
            >
                {`${label}:`}
            </Typography>
            <Typography variant="body1" component="span" noWrap>
                {value}
            </Typography>
        </DetailContainer>
    )
}
export default DetailItem
