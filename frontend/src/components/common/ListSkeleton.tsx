import List, { ListProps } from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemText from "@mui/material/ListItemText"
import Skeleton from "@mui/material/Skeleton"
import React from "react"

interface ListSkeletonProps extends ListProps {
    count?: number
}

const animationDelay = 0.3
const ListSkeleton: React.FC<ListSkeletonProps> = ({ count = 3, ...props }) => {
    const animationDuration = (count + 2) * animationDelay
    return (
        <List sx={{ width: "100%" }} {...props}>
            {Array.from({ length: count }).map((item, index) => (
                <ListItem key={index}>
                    <ListItemAvatar>
                        <Skeleton
                            animation="pulse"
                            variant="circular"
                            width={40}
                            height={40}
                            sx={{
                                animationDuration: `${animationDuration}s`,
                                animationDelay: `${animationDelay * index}s`,
                            }}
                        />
                    </ListItemAvatar>
                    <ListItemText
                        primary={
                            <Skeleton
                                animation="pulse"
                                height={20}
                                width="80%"
                                sx={{
                                    animationDuration: `${animationDuration}s`,
                                    animationDelay: `${animationDelay * index}s`,
                                }}
                            />
                        }
                        secondary={
                            <Skeleton
                                animation="pulse"
                                height={20}
                                width="60%"
                                sx={{
                                    animationDuration: `${animationDuration}s`,
                                    animationDelay: `${animationDelay * index}s`,
                                }}
                            />
                        }
                    />
                </ListItem>
            ))}
        </List>
    )
}

export default ListSkeleton
