import CloseIcon from "@mui/icons-material/Close"
import { useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import { styled } from "@mui/material/styles"
import useSettingsStore from "@stores/useSettingsStore"
import React from "react"

const Banner = styled(Box)(({ theme }) => ({
    height: "450px",
    position: "relative",
    borderRadius: theme.spacing(3),
    backgroundColor: theme.palette.primary.main,
    margin: theme.spacing(3),
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
        </Banner>
    )
}
export default WelcomeBanner
