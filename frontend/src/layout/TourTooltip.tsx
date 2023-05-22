import CloseIcon from "@mui/icons-material/Close"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardActions from "@mui/material/CardActions"
import CardContent from "@mui/material/CardContent"
import IconButton from "@mui/material/IconButton"
import { styled } from "@mui/material/styles"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import Zoom from "@mui/material/Zoom"
import useSettingsStore from "@stores/useSettingsStore"
import { useStateStore } from "@stores/useStateStore"
import { useTourStore } from "@stores/useTourStore"
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
    const hasTasks = useStateStore((store) => store.tasks.size > 0)
    const isDemo = useSettingsStore((state) => state.demo)
    return (
        <Zoom in>
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
                        <Button variant="text" disabled={[2, 8, 11].includes(index)} {...backProps}>
                            Back
                        </Button>
                    ) : (
                        <>
                            <Button color="secondary" variant="text" {...skipProps}>
                                Close
                            </Button>
                            {!isDemo && (
                                <Tooltip title="Start tour with Demo Mode">
                                    <span>
                                        <Button
                                            color="primary"
                                            variant="outlined"
                                            {...primaryProps}
                                            onClick={(event) => {
                                                useSettingsStore.setState({ demo: true })
                                                useTourStore.setState({ demoMode: true })
                                                primaryProps.onClick(event)
                                            }}
                                        >
                                            Demo
                                        </Button>
                                    </span>
                                </Tooltip>
                            )}
                        </>
                    )}
                    <Button
                        color={isLastStep ? "secondary" : "primary"}
                        variant="contained"
                        disabled={step.hideFooter || !hasTasks}
                        {...primaryProps}
                    >
                        {index > 0 ? (isLastStep ? "Finish" : "Next") : "Start"}
                    </Button>
                </CardActions>
            </StyledCard>
        </Zoom>
    )
}
export default TourTooltip
