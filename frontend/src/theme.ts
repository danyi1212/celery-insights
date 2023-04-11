import darkScrollbar from "@mui/material/darkScrollbar"
import { createTheme } from "@mui/material/styles"

// A custom theme for this app
const theme = createTheme({
    palette: {
        mode: "dark",
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: (themeParam) => ({
                body: themeParam.palette.mode === "dark" ? darkScrollbar() : null,
            }),
        },
    },
})

export default theme
