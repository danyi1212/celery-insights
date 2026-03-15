declare module "*.mdx" {
  import type { ComponentType } from "react"

  const MDXComponent: ComponentType
  export default MDXComponent
}

declare module "*.mdx.source" {
  const markdown: string
  export default markdown
}
