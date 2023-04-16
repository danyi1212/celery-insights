import darkScrollbar from "@mui/material/darkScrollbar"
import { createTheme } from "@mui/material/styles"

const PRIMARY = "#a9cc54"
const SECONDARY = "#c4783d"

export const darkTheme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: PRIMARY,
        },
        secondary: {
            main: SECONDARY,
        },
        background: {
            paper: "#161918",
            default: "#141716",
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: (themeParam) => ({
                body: themeParam.palette.mode === "dark" ? darkScrollbar() : null,
            }),
        },
    },
})

export const lightTheme = createTheme({
    palette: {
        mode: "light",
        primary: {
            main: PRIARY,
        },
        secondary: {
            main: SECONARY,
        },
        background: {
            default: "#dee5ce",
            paper: "#f5fee",
        },
    },
    components: {
        MuiDrawer: {
            styleOverrides: {
                paper: (themeParams) => ({
                    backgroundColor: themeParams.theme.palette.primary.lght,
                }),
            },
        },
    },
})
