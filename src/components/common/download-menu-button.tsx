import { Button } from "@components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import type { LucideIcon } from "lucide-react"
import { Download } from "lucide-react"

interface DownloadMenuItem {
  label: string
  icon?: LucideIcon
  onSelect: () => void
}

interface DownloadMenuButtonProps {
  label?: string
  items: DownloadMenuItem[]
  disabled?: boolean
}

const DownloadMenuButton = ({ label = "Download options", items, disabled = false }: DownloadMenuButtonProps) => (
  <DropdownMenu>
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={label} disabled={disabled}>
            <Download className="size-4" />
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
    <DropdownMenuContent align="end">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <DropdownMenuItem key={item.label} onClick={item.onSelect}>
            {Icon ? <Icon className="size-4" /> : null}
            {item.label}
          </DropdownMenuItem>
        )
      })}
    </DropdownMenuContent>
  </DropdownMenu>
)

export default DownloadMenuButton
