import React from "react"
import { TransitionGroup } from "react-transition-group"

const AnimatedList: React.FC<React.ComponentProps<"ul">> = (props) => {
  return (
    <ul {...props}>
      <TransitionGroup>{props.children}</TransitionGroup>
    </ul>
  )
}
export default AnimatedList
