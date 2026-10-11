# Repository clarity review

Reviewed on 2026-10-11, starting from merged OPA commit `5ec3e173`.

The sweep covered tracked first-party documentation, UI copy, code comments, runtime/Python ownership, developer commands and deployment examples. Generated files, lockfiles, third-party UI primitives and license/conduct text were excluded from rewriting. This is a clarity review, not a security audit or proof that every module needs no further work.

## Changes

| Finding | Location | Replacement |
| --- | --- | --- |
| Repeated, stale operator docs | `DOCS_PAGE_CONTENT.md` | An index pointing to the maintained MDX pages |
| Obsolete versions, ports and config ownership | `CLAUDE.md`, `CONTRIBUTING.md` | Current Bun/Python responsibilities and executable commands |
| Setup examples omit required authentication | Setup, deployment and replay pages | Account/secret mounts and HTTPS prerequisites |
| Storage advice repeated under several headings | Deployment patterns, Kubernetes | A comparison table, examples and topology-specific constraints |
| Outdated credential/export guidance | Production notes, contribution guide | Stable database secrets; always-redacted configuration, with payload/log caveats |
| Unused onboarding UI | Old welcome banner, graph and CSS | Removed; the dashboard keeps its active tour/setup controls |
| Promotional or redundant UI copy | Dashboard banner and documentation headers | Short descriptions of the next action or page contents |
| Error text guesses causes | API error alert | Actual HTTP status and a retry/logs instruction |
| Lifecycle logs and comments narrate obvious steps | Python bridge lifecycle | Named app parameter, operational start/stop logs; shutdown-order rationale retained |
| Example memoizes a trivial derived value | Contribution conventions | Compute the count directly during render |
| Historical design reads like current setup | Configuration design | Explicit historical label and links to maintained guides |
| Developer recipe bypasses the supervisor | `just dev-backend` | Start Bun's supervisor and its private Python bridge |

## Retained or deferred

- **MCP contract and observation semantics:** missing data, retries and lineage need precise definitions. Keep the detail; operator recipes remain in `src/content/docs/mcp.mdx`.
- **Security checks and comments:** role ceilings, scope projections, bounded responses and live reauthorization explain constraints that shorter code would hide.
- **Configuration references:** the generated setting catalog and human setup guides serve different purposes. Larger consolidation needs a documented generation workflow.
- **Runtime/query modules:** size alone is not a reason to split them. Any future extraction should identify a concrete ownership or testing benefit.
- **Historical plans and test assertions:** retained where they explain migration decisions or required behavior; no blanket deletion of comments or tests.

## Validation

- Parse the revised TOML examples through the application resolver.
- Build the frontend, including all MDX pages; run frontend checks and bridge lifecycle tests.
- Confirm removed components/styles have no remaining references and developer recipes parse.
