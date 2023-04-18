import BannerFlowchart from "@components/BannerFlowchart"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import CloseIcon from "@mui/icons-material/Close"
import { useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import IconButton from "@mui/material/IconButton"
import Stack from "@mui/material/Stack"
import { styled } from "@mui/material/styles"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import useSettingsStore from "@stores/useSettingsStore"
import { startTour } from "@stores/useTourStore"
import React from "react"
import { ReactFlowProvider } from "reactflow"

const Banner = styled(Box)(({ theme }) => ({
    height: "450px",
    position: "relative",
    borderRadius: theme.spacing(3),
    margin: theme.spacing(3),
    background: `linear-gradient(to right, ${
        theme.palette.mode === "dark" ? theme.palette.primary.dark : theme.palette.primary.main
    } 0px, ${theme.palette.background.paper} min(1000px, 85%))`,
    overflow: "hidden",
    pointerEvents: "none",
}))

const WelcomeBanner: React.FC = () => {
    const theme = useTheme()
    return (
        <ReactFlowProvider>
            <Banner>
                <Tooltip title="Hide banner" describeChild>
                    <IconButton
                        sx={{
                            position: "absolute",
                            top: theme.spacing(1),
                            right: theme.spacing(2),
                            pointerEvents: "all",
                        }}
                        onClick={() => useSettingsStore.setState({ hideWelcomeBanner: true })}
                    >
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
                <Box sx={{ position: "absolute", top: 60, left: 80, pointerEvents: "all" }}>
                    <Typography variant="h1" fontWeight="bold" fontSize="5rem" gutterBottom>
                        Welcome to Celery&nbsp;Insights!
                    </Typography>
                    <Typography variant="h4" gutterBottom>
                        The ultimate monitoring tool for your cluster.
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ my: 3 }}>
                        <Button color="secondary" variant="contained" size="large" onClick={() => startTour()}>
                            Start Tour
                        </Button>
                        <Button
                            color="secondary"
                            variant="text"
                            size="large"
                            component="a"
                            href="https://github.com/danyi1212/celery-insights"
                        >
                            Getting Started <ArrowForwardIcon fontSize="large" sx={{ ml: 0.5 }} />
                        </Button>
                    </Stack>
                </Box>
                <BannerFlowchart />
            </Banner>
        </ReactFlowProvider>
    )
}
export default WelcomeBanner
