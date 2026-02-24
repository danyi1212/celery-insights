import { TypographyProps } from "@mui/material"
import { styled } from "@mui/material/styles"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import React from "react"

interface DetailItemProps {
    label: string
    value: React.ReactNode
    color?: TypographyProps["color"]
    description?: string
}

const DetailContainer = styled("div")({
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
})

const DetailItem: React.FC<DetailItemProps> = ({ label, value, color, description }) => {
    const labelNode = (
        <Typography
            component="span"
            color={color || "primary"}
            sx={{ fontWeight: (theme) => theme.typography.fontWeightBold, pr: 1 }}
        >
            {`${label}:`}
        </Typography>
    )

    const tooltip = description ? (
        <Tooltip title={description} arrow>
            {labelNode}
        </Tooltip>
    ) : (
        labelNode
    )

    return (
        <DetailContainer>
            {tooltip}
            <Typography variant="body1" component="span" noWrap flexGrow={1}>
                {value}
            </Typography>
        </DetailContainer>
    )
}

export default DetailItem
