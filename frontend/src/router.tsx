import RootLayout from "@layout/RootLayout"
import ErrorPage from "@pages/ErrorPage"
import ExplorerPage from "@pages/ExplorerPage"
import RawEventsPage from "@pages/RawEventsPage"
import SettingsPage from "@pages/SettingsPage"
import TaskPage from "@pages/TaskPage"
import WorkerPage from "@pages/WorkerPage"
import React from "react"
import { createBrowserRouter } from "react-router-dom"
import HomePage from "./pages/HomePage"

export const router = createBrowserRouter([
    {
        path: "/",
        element: <RootLayout />,
        errorElement: <ErrorPage />,
        children: [
            { index: true, element: <HomePage />, errorElement: <ErrorPage /> },
            { path: "/settings", element: <SettingsPage /> },
            { path: "/explorer", element: <ExplorerPage /> },
            { path: "/raw_events", element: <RawEventsPage /> },
            { path: "tasks/:taskId", element: <TaskPage /> },
            { path: "workers/:workerId", element: <WorkerPage /> },
        ],
    },
])
