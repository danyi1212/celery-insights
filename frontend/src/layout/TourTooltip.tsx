import CloseIcon from "@mui/icons-material/Close"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardActions from "@mui/material/CardActions"
import CardContent from "@mui/material/CardContent"
import IconButton from "@mui/material/IconButton"
import { styled } from "@mui/material/styles"
import Typography from "@mui/material/Typography"
import React from "react"
import { TooltipRenderProps } from "react-joyride"

const StyledCard = styled(Card)(({ theme }) => ({
    minWidth: "250px",
    maxWidth: "650px",
    borderRadius: theme.spacing(3),
    position: "relative",
    zIndex: theme.zIndex.tooltip + 1,
}))

const TourTooltip: React.FC<TooltipRenderProps> = ({
    index,
    step,
    tooltipProps,
    primaryProps,
    backProps,
    skipProps,
    closeProps,
    isLastStep,
}) => {
    return (
        <StyledCard {...tooltipProps}>
            <IconButton
                sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                }}
                {...closeProps}
            >
                <CloseIcon />
            </IconButton>
            <CardContent sx={{ p: 3 }}>
                <Typography gutterBottom variant="h4" component="h2">
                    {step.title}
                </Typography>
                <Typography variant="body1" py={1} sx={{ wordWrap: "break-s" }} component="div">
                    {step.content}
                </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent: "flex-end", mx: 2, my: 1 }}>
                {index > 0 ? (
                    <Button variant="text" {...backProps}>
                        Back
                    </Button>
                ) : (
                    <Button color="secondary" variant="text" {...skipProps}>
                        Skip
                    </Button>
                )}
                <Button
                    color={isLastStep ? "secondary" : "primary"}
                    variant="contained"
                    disabled={step.hideFooter}
                    {...primaryProps}
                >
                    {isLastStep ? "Finish" : "Next"}
                </Button>
            </CardActions>
        </StyledCard>
    )
}
export default TourTooltip
