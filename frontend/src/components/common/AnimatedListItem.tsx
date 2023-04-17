import { ListItemProps } from "@mui/material"
import Collapse from "@mui/material/Collapse"
import ListItem from "@mui/material/ListItem"
import React from "react"

const AnimatedList: React.FC<ListItemProps> = (props) => {
    return (
        <Collapse in>
            <ListItem {...props}>{props.children}</ListItem>
        </Collapse>
    )
}
export default AnimatedList
