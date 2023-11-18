import PauseIcon from "@mui/icons-material/Pause"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import React from "react"

interface ToggleConnectProps {
    connect: boolean
    setConnect: (connect: boolean) => void
    disabled?: boolean
}

export const ToggleConnect: React.FC<ToggleConnectProps> = ({ connect, setConnect, disabled }) => {
    return (
        <Tooltip title={connect ? "Freeze" : "Connect"}>
            <IconButton onClick={() => setConnect(!connect)} disabled={disabled}>
                {connect ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
        </Tooltip>
    )
}
