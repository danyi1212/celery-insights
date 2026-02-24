import { Skeleton } from "@components/ui/skeleton"
import React from "react"

interface ListSkeletonProps extends React.ComponentProps<"ul"> {
    count?: number
}

const animationDelay = 0.3
const ListSkeleton: React.FC<ListSkeletonProps> = ({ count = 3, ...props }) => {
    const animationDuration = (count + 2) * animationDelay
    return (
        <ul className="w-full" {...props}>
            {Array.from({ length: count }).map((_, index) => (
                <li key={index} className="flex items-center gap-3 px-4 py-2">
                    <Skeleton
                        className="size-10 shrink-0 rounded-full"
                        style={{
                            animationDuration: `${animationDuration}s`,
                            animationDelay: `${animationDelay * index}s`,
                        }}
                    />
                    <div className="flex-grow space-y-2">
                        <Skeleton
                            className="h-5 w-4/5"
                            style={{
                                animationDuration: `${animationDuration}s`,
                                animationDelay: `${animationDelay * index}s`,
                            }}
                        />
                        <Skeleton
                            className="h-5 w-3/5"
                            style={{
                                animationDuration: `${animationDuration}s`,
                                animationDelay: `${animationDelay * index}s`,
                            }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    )
}

export default ListSkeleton
