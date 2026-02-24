import { createRootRoute, Outlet, Link as RouterLink } from "@tanstack/react-router"
import ConsolidatedProviders from "@layout/ConsolidatedProviders"
import Header from "@layout/header/Header"
import JoyrideTour from "@layout/JoyrideTour"
import Menu, { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED } from "@layout/menu/Menu"
import Box from "@mui/material/Box"
import CssBaseline from "@mui/material/CssBaseline"
import Link from "@mui/material/Link"
import { ThemeProvider } from "@mui/material/styles"
import Typography from "@mui/material/Typography"
import { usePreferredTheme } from "@hooks/usePreferredTheme"
import useSettings from "@stores/useSettingsStore"

const RootComponent = () => {
    const menuExpanded = useSettings((state) => state.menuExpanded)

    return (
        <ConsolidatedProviders>
            <Box display="flex" className="App">
                <Menu />
                <Box
                    component="main"
                    flexGrow="1"
                    minHeight="100vh"
                    sx={{
                        marginLeft: menuExpanded ? `${DRAWER_WIDTH}px` : `${DRAWER_WIDTH_COLLAPSED}px`,
                        transition: (theme) => theme.transitions.create(["margin"]),
                    }}
                >
                    <Header />
                    <Box pt={(theme) => theme.spacing(8)} height="100%" m={0}>
                        <Outlet />
                    </Box>
                </Box>
                <JoyrideTour />
            </Box>
        </ConsolidatedProviders>
    )
}

const ErrorComponent = ({ error }: { error: Error }) => {
    console.error(error)
    const theme = usePreferredTheme()
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box minHeight="100vh" display="flex" justifyContent="center" alignItems="center" flexDirection="column">
                <Typography variant="h1">{error.name}</Typography>
                <Typography variant="h5">{error.message}</Typography>
                <Link component={RouterLink} to="/">
                    Back Home
                </Link>
            </Box>
        </ThemeProvider>
    )
}

const NotFoundComponent = () => {
    const theme = usePreferredTheme()
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box minHeight="100vh" display="flex" justifyContent="center" alignItems="center" flexDirection="column">
                <Typography variant="h1">404 Not Found</Typography>
                <Typography variant="h5">Sorry, the page you are looking for does not exist.</Typography>
                <Link component={RouterLink} to="/">
                    Back Home
                </Link>
            </Box>
        </ThemeProvider>
    )
}

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ErrorComponent,
    notFoundComponent: NotFoundComponent,
})
