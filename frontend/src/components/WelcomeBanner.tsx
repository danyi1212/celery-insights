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

const Banner = styled(Box)(({ theme }) => ({
    height: "450px",
    position: "relative",
    borderRadius: theme.spacing(3),
    margin: theme.spacing(3),
    background: `linear-gradient(to right, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`,
    overflow: "hidden",
}))

const WelcomeBanner: React.FC = () => {
    const theme = useTheme()
    return (
        <Banner>
            <IconButton
                sx={{ position: "absolute", top: theme.spacing(1), right: theme.spacing(2) }}
                onClick={() => useSettingsStore.setState({ hideWelcomeBanner: true })}
            >
                <CloseIcon />
            </IconButton>
            <Box sx={{ position: "absolute", top: 100, left: 80 }}>
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
        </Banner>
    )
}
export default WelcomeBanner
