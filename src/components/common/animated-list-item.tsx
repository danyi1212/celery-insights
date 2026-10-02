import { cn } from "@lib/utils"
import React from "react"

interface AnimatedListItemProps extends React.ComponentProps<"li"> {
  disablePadding?: boolean
}

const AnimatedListItem: React.FC<AnimatedListItemProps> = ({ disablePadding, className, ...props }) => {
  return (
    <li
      className={cn("animate-in fade-in slide-in-from-top-2 duration-300", !disablePadding && "py-1", className)}
      {...props}
    >
      {props.children}
    </li>
  )
}
export default AnimatedListItem
