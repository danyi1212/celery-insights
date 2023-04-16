import BannerFlowchart from "@components/BannerFlowchart"
import CloseIcon from "@mui/icons-material/Close"
import { useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import IconButton from "@mui/material/IconButton"
import { styled } from "@mui/material/styles"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import useSettingsStore from "@stores/useSettingsStore"
import React from "react"
import { ReactFlowProvider } from "reactflow"

const Banner = styled(Box)(({ theme }) => ({
    height: "450px",
    position: "relative",
    borderRadius: theme.spacing(3),
    margin: theme.spacing(3),
    background: `linear-gradient(to right, ${theme.palette.primary.main} 0px, ${theme.palette.background.paper} min(1000px, 85%))`,
    overflow: "hidden",
    pointerEvents: "none",
}))

const WelcomeBanner: React.FC = () => {
    const theme = useTheme()
    return (
        <ReactFlowProvider>
            <Banner>
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
                <Box sx={{ position: "absolute", top: 60, left: 80, pointerEvents: "all" }}>
                    <Typography variant="h1" fontWeight="bold" fontSize="5rem" gutterBottom>
                        Welcome to Celery&nbsp;Insights
                    </Typography>
                    <Typography variant="h4" gutterBottom>
                        The ultimate monitoring tool for your Celery Cluster.
                    </Typography>
                    <Tooltip title="Coming soon!" arrow>
                        <Button color="secondary" variant="contained" size="large" sx={{ mx: 6, my: 2 }}>
                            Start Tutorial
                        </Button>
                    </Tooltip>
                </Box>
                <BannerFlowchart />
            </Banner>
        </ReactFlowProvider>
    )
}
export default WelcomeBanner
