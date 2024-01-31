import SearchResultList from "@components/search/SearchResultList"
import SearchIcon from "@mui/icons-material/Search"
import Popover from "@mui/material/Popover"
import Box from "@mui/material/Box"
import InputBase from "@mui/material/InputBase"
import { alpha, styled } from "@mui/material/styles"
import React, { useState } from "react"

const Search = styled("div")(({ theme }) => ({
    position: "relative",
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.text.primary, 0.15),
    "&:hover": {
        backgroundColor: alpha(theme.palette.text.primary, 0.25),
    },
    marginRight: theme.spacing(2),
    marginLeft: 0,
    width: "100%",
    [theme.breakpoints.up("sm")]: {
        marginLeft: theme.spacing(3),
        width: "auto",
    },
}))

const SearchIconWrapper = styled("div")(({ theme }) => ({
    padding: theme.spacing(0, 2),
    height: "100%",
    position: "absolute",
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
}))

const StyledInputBase = styled(InputBase)(({ theme }) => ({
    color: "inherit",
    "& .MuiInputBase-input": {
        padding: theme.spacing(1, 1, 1, 0),
        // vertical padding + font size from searchIcon
        paddingLeft: `calc(1em + ${theme.spacing(4)})`,
        transition: theme.transitions.create("width"),
        width: "100%",
        [theme.breakpoints.up("md")]: {
            width: "30ch",
        },
    },
}))

const SearchBox = () => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
    const open = Boolean(anchorEl)
    const [query, setQuery] = useState("")

    const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)
    const handleOpenMenu = (event: React.MouseEvent<HTMLDivElement>) => setAnchorEl(event.currentTarget)
    const handleCloseMenu = () => setAnchorEl(null)

    const id = open ? "search-menu" : undefined
    return (
        <>
            <Search
                id="search-bar"
                aria-controls={id}
                aria-haspopup="true"
                aria-expanded={open ? "true" : undefined}
                onClick={handleOpenMenu}
            >
                <SearchIconWrapper>
                    <SearchIcon />
                </SearchIconWrapper>
                <StyledInputBase
                    placeholder="Search…"
                    inputProps={{ "aria-label": "search" }}
                    onChange={handleQueryChange}
                    value={query}
                />
            </Search>
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                sx={{ mt: 3 }}
                onClose={handleCloseMenu}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "left",
                }}
                disableAutoFocus
            >
                <Box width="450px" display="flex" alignItems="center" justifyContent="center">
                    <SearchResultList query={query} />
                </Box>
            </Popover>
        </>
    )
}

export default SearchBox
