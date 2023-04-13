import darkScrollbar from "@mui/material/darkScrollbar"
import { createTheme } from "@mui/material/styles"

export const darkTheme = createTheme({
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

export const lightTheme = createTheme({
    palette: {
        mode: ght",
   },
})
