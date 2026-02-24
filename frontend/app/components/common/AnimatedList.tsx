import { ListProps } from "@mui/material"
import List from "@mui/material/List"
import React from "react"
import { TransitionGroup } from "react-transition-group"

const AnimatedList: React.FC<ListProps> = (props) => {
    return (
        <List {...props}>
            <TransitionGroup>{props.children}</TransitionGroup>
        </List>
    )
}
export default AnimatedList
