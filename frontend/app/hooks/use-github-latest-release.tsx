import { useQuery } from "@tanstack/react-query"

interface GitHubRelease {
    tag_name: string
    html_url: string
    name: string | null
    body: string | null
    prerelease: boolean
    published_at: string | null
}

const getLatestRelease = async (): Promise<GitHubRelease> => {
    const res = await fetch("https://api.github.com/repos/danyi1212/celery-insights/releases/latest")
    if (!res.ok) throw new Error(`GitHub API request failed: ${res.status}`)
    return res.json()
}

export const useGithubLatestRelease = () =>
    useQuery({
        queryKey: ["latest-release"],
        queryFn: getLatestRelease,
        refetchInterval: 1000 * 60 * 15, // Every 15 minutes
    })
