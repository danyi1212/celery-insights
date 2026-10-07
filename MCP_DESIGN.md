# Celery Insights MCP interface

Status: implemented v1 contract. Bun serves these five read-only tools through `/mcp`;
connection settings are documented in [CONFIGURATION.md](CONFIGURATION.md#mcp-access-for-agents).

## Purpose

Give an agent enough evidence to answer a Celery question with a small response and few follow-up calls. Discovery uses information the agent is likely to know: task name, worker hostname, and approximate invocation time. Inspection uses identifiers returned by discovery.

The interface observes the cluster. It does not spawn, revoke, retry, or otherwise control tasks or workers.

| Tool | Typical question |
| --- | --- |
| `search_workflows` | Where is the task I just spawned? Which recent executions have problems? |
| `inspect_workflow` | What happened inside this execution? Which branch is still running? |
| `inspect_task` | What input did it receive? What did it return? Why did it fail? |
| `list_workers` | Which workers are available? Which workers can execute this task? |
| `inspect_worker` | What is this worker running, reserving, or scheduling? |

## Shared rules

### Observations and identifiers

- A task count means distinct observed task IDs, not execution attempts. A retry does not add another task to that count.
- A workflow is the grouping currently recorded by Celery Insights, including standalone tasks. It is not necessarily a complete reconstruction of a planned Celery canvas.
- Parent and child references describe observed lineage, not proof of a dependency or the reason a task is waiting.
- IDs are opaque strings. Return plain task/workflow IDs and worker hostnames, without SurrealDB record wrappers. Agents should pass them back unchanged.
- Discovery includes workflow IDs and a few useful task references. It does not list every task ID.
- Missing input, output, timestamps, or relationships are reported as unavailable. Missing data does not mean an empty input, a successful result, or an independent task.

### Counts and workflow status

Use `task_counts` for whole-workflow counts and `matching_task_counts` for the tasks that satisfy discovery filters. Both count distinct observed task IDs by exact task name, using this shape:

```ts
type TaskCounts = {
  total: number
  by_name: Array<{
    name: string | null
    count: number
  }>
}
```

`by_name` contains nonzero counts; `null` groups tasks whose names are unavailable. Counts within a task-name group use the same shape, restricted to that name. Compact counts include `omitted_name_count` when additional names are available through the `task_names` view.

Return `status` as an aggregate over all observed tasks in the workflow, regardless of discovery filters or displayed samples. If any task is not complete, the workflow is `running`. Only when every observed task is in a terminal state (`SUCCESS`, `FAILURE`, `REVOKED`, or `REJECTED`) is the workflow `finished`. Preserve unexpected task states and treat them as unfinished unless explicitly known to be terminal. A workflow with no observed tasks has an unavailable status.

`finished` means all observed tasks are complete, not that every task succeeded. Do not derive workflow status from the existing `active_count`, matching tasks, or task-name counts, and do not imply that observed membership reconstructs the entire planned workflow.

Return `has_errors: boolean | null` separately from progress. The search argument is an optional boolean; the response allows `null` for unavailable evidence:

| Value | Meaning |
| --- | --- |
| `true` | At least one member task has observed error evidence, including an earlier error followed by successful recovery. |
| `false` | No error evidence is known for the observed members. This means no observed errors, not proof that the execution never encountered an error. |
| `null` | There are no observed members, or available data cannot establish whether error evidence exists. |

Error evidence means a recorded task failure (`FAILURE`, `failed_at`, or a `task-failed` event), a recorded exception/traceback, or a retry event carrying an exception/traceback. A retry without error evidence, rejection, or revocation alone does not count as an error: these may be intentional control flow.

Use retained task history and persisted error evidence, not just current task states. A task that encounters an exception, retries, and succeeds still makes `has_errors=true`. The workflow result also includes `error_task_count`: distinct observed member tasks with known error evidence, not the number of error events or retry attempts. Return `null` when an exact count cannot be established; a known positive example is sufficient for `has_errors=true` even when its count is unavailable.

Both `status` and `has_errors` describe the whole observed workflow, regardless of name/worker/time filters or displayed samples. Their independent values express four useful combinations:

| `status` | `has_errors` | Interpretation |
| --- | --- | --- |
| `running` | `false` | Work remains; no errors have been observed. |
| `running` | `true` | Work remains and at least one task has encountered an error. |
| `finished` | `false` | All observed tasks are terminal; no errors have been observed. This still does not imply success, for example after intentional revocation. |
| `finished` | `true` | All observed tasks are terminal and errors occurred, whether unresolved or recovered. Inspect task evidence to distinguish those outcomes. |

Progress can move back to `running` if more members are observed. Positive error evidence must survive subsequent success updates. Legacy records or incomplete capture may miss prior errors; report known limitations in `meta.warnings` rather than inventing a clean history.

### Response metadata

Every result contains `meta`:

| Field | Meaning |
| --- | --- |
| `read_at` | UTC ISO timestamp when the response was assembled; not proof that ingestion is current. |
| `mode` | `live`, `snapshot`, or `ingestion_disabled`. |
| `warnings` | Short, actionable observations about unavailable data, stale inspections, or incomplete lineage. Empty when none are known. |

Collection results additionally contain `page`:

```ts
type Page = {
  returned: number
  total: number | null // Exact count in this collection's scope, if available.
  has_more: boolean
  next_cursor: string | null
}
```

An unknown total is `null`, never a guess. Other bounded collections include explicit omitted counts, or an availability indicator if their size is unknown. Do not silently cut an array or string.

### Response budgets and pagination

Proposed initial limits:

| Collection | Default | Maximum |
| --- | --- | --- |
| Search workflow candidates | 5 | 20 |
| Workflow task rows | 25 | 100 |
| Workflow task-name groups | 8 | 50 |
| Worker rows | 10 | 50 |
| Worker activity rows | 15 | 100 |
| Registered task names / queues | 25 | 100 |
| Task history events | 10 | 50 |

Also cap the serialized tool data at 24 KiB per response. Payload previews are at most 512 characters per input/output field. Payload sections return at most 8 KiB of text per response, within the overall cap. These are tuning values to validate with realistic agent questions.

The server may return fewer rows than `limit` to meet the byte budget, preserving a usable cursor.
If one record's required identifiers and context cannot fit, return `query_budget_exceeded` with
an explicit explanation rather than silently dropping it or returning a cursor that cannot advance.
Payloads are retrieved in bounded chunks. Each database query has a two-second timeout, and a tool
call has a ten-second query budget.

Cursors are opaque and carry the original scope and resolved time window. A continuation may supply only the cursor plus any required workflow/task/worker identifier. Reject conflicting selectors. Expired or invalid cursors produce an explicit error.

Use deterministic ordering and keyset pagination rather than mutable offsets. Cursors do not promise a frozen database snapshot: tasks can arrive, change state, or be removed by retention between calls. Unfiltered workflow task enumeration uses immutable task IDs for ordering; filtered membership can change. State this limitation in tool descriptions, and never describe a partially observed workflow as complete.

## 1. `search_workflows`

Find workflow candidates using a task name, worker, approximate time, progress, or observed errors. A single result should often answer where a task is, whether work remains, and whether errors have occurred.

### Receives

| Argument | Type | Default | Semantics |
| --- | --- | --- | --- |
| `task_name` | string, optional | absent | Case-insensitive name fragment, matching any member task. |
| `worker` | string, optional | absent | Case-insensitive hostname fragment on a member task. |
| `within` | string, optional | `"1h"` | Positive integer plus `m`, `h`, or `d`, such as `"15m"`, `"2h"`, or `"1d"`, up to 30 days; `"all"` searches retained history. |
| `status` | `"all" \| "running" \| "finished"` | `"all"` | Filter by aggregate workflow status; `"all"` applies no status restriction. |
| `has_errors` | boolean, optional | absent | `true`: observed errors anywhere in the workflow, including recovered errors; `false`: no observed errors; omitted: no error filter. |
| `limit` | integer, optional | 5 | Candidate count, maximum 20. |
| `cursor` | string, optional | absent | Continue the same search. |

`status` and `has_errors` are independent and intersect when supplied together. For example, `status="running", has_errors=true` finds workflows that still have unfinished members and have encountered an error; `status="finished", has_errors=true` includes both failed executions and executions that recovered successfully. An unknown error value matches neither `has_errors=true` nor `has_errors=false`; omitting `has_errors` includes it. Likewise, an unknown progress value is included only with `status="all"`. Return both resolved selectors in `effective_filters`, using `null` for an omitted error filter.

Status and errors concern the whole workflow. Task name, worker, and invocation time must match the same member task when supplied together. For example, a workflow containing `reports.render` on worker A and an unrelated task on worker B does not match `task_name="reports.render", worker="B"`. However, a name-matching workflow may satisfy `has_errors=true` because a different member task encountered an error.

Time rules:

- With `task_name` or `worker`, apply `within` to the matching task's `sent_at`, falling back to its stable earliest observation. Return which timestamp was used.
- Without those selectors, apply `within` to the workflow's latest observed task activity.
- Resolve the window once and return its UTC start/end and `time_basis` in `effective_filters`. Continuations retain that window.
- An old running task may be excluded by the invocation window. Use `within="all"` to search all retained unfinished work, or `inspect_worker` for current worker activity.

Name relevance is deterministic: exact full-name match, then exact final name segment, then substring match; ties use matching invocation time descending and workflow ID. Without a name filter, order by the applicable activity/invocation timestamp descending, then workflow ID.

All explicit filters are enforced. Do not silently broaden them or use fuzzy typo correction.

### Returns

Top level: `meta`, `effective_filters`, `workflows`, `page`, and `diagnostics`.

Each workflow candidate contains:

| Field | Contents |
| --- | --- |
| `workflow_id`, `root_task_name` | Inspection handle and root name, which may be unavailable. |
| `first_observed_at`, `last_activity_at` | Observation timestamps, not a claim about the complete execution lifetime. |
| `status`, `has_errors`, `error_task_count` | Whole-workflow progress and observed error evidence/count, as defined in shared rules. |
| `task_counts` | Whole-workflow observed task counts by name. |
| `matching_task_counts` | Counts for members matching name/worker/time filters; `null` when no member filters apply. |
| `task_names` | Up to 8 groups: `name`, `task_counts`; matching names first, then groups with failures/retries, then running work, then count/name. |
| `omitted_task_name_count` | Number of groups absent from this summary. |
| `workers` | Up to 3 observed worker hostnames, with `omitted_worker_count`. |
| `matching_task` | A representative matching task: ID, name, state, worker, invocation time and time basis. `null` if no member filters apply. |
| `problem_task` | At most one member task with observed error evidence, including recovered errors, with its current state and a short exception preview when available; `null` if none is known. Prefer unresolved failures, then errors in unfinished tasks, then recovered errors. |

The representative task is the best-ranked matching member, not an assertion that it is the invocation the user meant. When several invocations match, counts preserve that ambiguity. A matching task and a problem task may be different members; label them separately.

Empty search results are successful results. `diagnostics` may contain bounded name/hostname suggestions or the latest known matching invocation outside the window. Omit these if finding them would exceed the query budget; never launch an unlimited retained-history scan just to explain an empty result.

### Example

```json
{
  "task_name": "reports.render",
  "within": "15m"
}
```

Illustrative candidate, excluding shared metadata:

```json
{
  "workflow_id": "workflow-123",
  "root_task_name": "reports.generate",
  "first_observed_at": "2026-10-02T09:00:00Z",
  "last_activity_at": "2026-10-02T09:03:00Z",
  "status": "running",
  "has_errors": true,
  "error_task_count": 1,
  "task_counts": {
    "total": 42,
    "by_name": [
      { "name": "reports.render", "count": 20 },
      { "name": "reports.fetch", "count": 20 },
      { "name": "reports.publish", "count": 2 }
    ]
  },
  "matching_task_counts": {
    "total": 20,
    "by_name": [{ "name": "reports.render", "count": 20 }]
  },
  "task_names": [
    { "name": "reports.render", "task_counts": { "total": 20, "by_name": [{ "name": "reports.render", "count": 20 }] } },
    { "name": "reports.fetch", "task_counts": { "total": 20, "by_name": [{ "name": "reports.fetch", "count": 20 }] } },
    { "name": "reports.publish", "task_counts": { "total": 2, "by_name": [{ "name": "reports.publish", "count": 2 }] } }
  ],
  "omitted_task_name_count": 0,
  "workers": ["celery@reports-1"],
  "omitted_worker_count": 0,
  "matching_task": {
    "task_id": "task-render-20",
    "name": "reports.render",
    "state": "FAILURE",
    "worker": "celery@reports-1",
    "invoked_at": "2026-10-02T09:02:00Z",
    "time_basis": "sent_at"
  },
  "problem_task": {
    "task_id": "task-render-20",
    "name": "reports.render",
    "state": "FAILURE",
    "exception_preview": "TimeoutError('render service unavailable')"
  }
}
```

## 2. `inspect_workflow`

Understand a workflow, locate relevant tasks, and browse all observed members without returning a huge graph at once.

### Receives

| Argument | Type | Default | Semantics |
| --- | --- | --- | --- |
| `workflow_id` | string, required | — | ID returned by discovery or task inspection. |
| `view` | `"overview" \| "tasks" \| "task_names"` | `"overview"` | Summary, member rows, or exhaustive grouped names. |
| `parent_task_id` | string, optional | absent | Direct observed children of this task; only with `view="tasks"`. |
| `task_name` | string, optional | absent | Member name fragment; only with `view="tasks"`. |
| `limit` | integer, optional | view default | Page size for `tasks` or `task_names`; invalid for `overview`. |
| `cursor` | string, optional | absent | Continue the selected collection. |

If both parent and name are supplied, intersect them. A parent must belong to this workflow. No arbitrary graph-depth parameter is needed: follow child references deliberately.

### Returns

All views return `meta` and `workflow`: ID, root task reference if observed, observation timestamps, `status`, `has_errors`, `error_task_count`, and whole-workflow `task_counts`. Error summaries include prior errors followed by recovery, not just currently failed tasks.

| View | Additional fields |
| --- | --- |
| `overview` | `task_names` with omitted count; up to 3 `problem_tasks` and 3 `running_tasks`, each with eligible/omitted counts; `tasks` containing all members if there are at most 25 and they fit the byte budget, otherwise no member enumeration; `member_list_included` explicitly distinguishes those cases. |
| `tasks` | `effective_filters`, `tasks`, `page`; whole-workflow counts remain separate from this filtered collection's total. |
| `task_names` | `task_names`, `page`; groups ordered by exact full name, with counts over all observed members. |

A task row contains:

```ts
type WorkflowTask = {
  task_id: string
  name: string | null
  state: string
  worker: string | null
  invoked_at: string | null
  invocation_time_basis: "sent_at" | "first_observed_at" | null
  started_at: string | null
  finished_at: string | null
  elapsed_seconds: number | null
  retries: number | null
  parent_task_id: string | null
  parent_record_available: boolean | null
  observed_child_count: number
  exception_preview: string | null
}
```

Do not include every child ID in a row. Count distinct observed children consistently from available parent/child references; `parent_task_id` may refer outside the returned page. `parent_record_available=false` means the record is missing, not that the task is a root. Conflicting lineage produces a warning rather than an invented graph edge.

Task rows include `execution_status` (`active`, `not_active`, or `unknown` for a reported `STARTED` task; otherwise `null`) and `execution_observed_at`. Execution observations come from successful worker active-list inspections and expire after two minutes. `running_tasks` includes only fresh positive observations. Workflow `status="running"` continues to mean unfinished observed membership, as defined above. Observation timestamps come from the monitor's clock and are compared with worker event timestamps and the reader's clock, so the feature assumes roughly synchronised clocks. The two-minute window applies in both directions: an observation up to two minutes ahead of the reader's clock still counts, and larger skew makes a running task read `unknown` until it passes, never `active`.

For an unfinished task, elapsed time is time since `started_at`; for a finished task, use recorded runtime or timestamps when available. It is not automatically a duration for an entire workflow.

### Example calls

```json
{ "workflow_id": "workflow-123" }
```

```json
{ "workflow_id": "workflow-123", "view": "tasks", "task_name": "reports.render" }
```

```json
{ "workflow_id": "workflow-123", "view": "tasks", "parent_task_id": "task-fanout" }
```

The default is useful for diagnosis. The `tasks` and `task_names` views make every observed member and name accessible without relying on the overview's samples.

## 3. `inspect_task`

Read a specific invocation's state, relationships, input, output, errors, and observed event history.

### Receives

| Argument | Type | Default | Semantics |
| --- | --- | --- | --- |
| `task_id` | string, required | — | Returned task ID, or an exact ID already known to the caller. |
| `section` | `"overview" \| "input" \| "output" \| "error" \| "history"` | `"overview"` | Evidence to return. |
| `limit` | integer, optional | 10 | Event page size; valid only for `history`, maximum 50. |
| `cursor` | string, optional | absent | Continue a payload section or event history. |

### Returns

Every section includes `meta` and a compact `task` reference: ID, name, state, worker, and workflow ID if known.

| Section | Additional fields |
| --- | --- |
| `overview` | Invocation/start/finish/update times, runtime or elapsed time, retries, ETA/expiry, exchange/routing key, parent reference, observed child count, input/output previews, exception preview, and a bounded traceback excerpt. |
| `input` | Chunks of stored `args` and `kwargs`, with field availability and pagination. |
| `output` | Chunks of stored `result`, with availability and pagination. |
| `error` | Stored exception and traceback chunks. Return the exception and final relevant traceback lines first; continuations expose remaining stored text in defined order. Mark an excerpt as an excerpt. |
| `history` | Observed events, oldest first by timestamp then event ID, with `page`. Rows contain event ID/type/time, observed state if applicable, worker, and bounded exception information. Omit repetitive payloads. |

Payload fields use this representation:

```ts
type TextField = {
  availability: "available" | "unavailable"
  format: "text" // Stored Celery/Python representation; not guaranteed JSON.
  text: string | null
  response_truncated: boolean
  source_truncated: boolean | null // null means ingestion did not record this fact.
}
```

`input`, `output`, and `error` sections add `has_more` and `next_cursor`. Cursor state identifies the section and fields being continued; the agent need not calculate character offsets. `has_more` describes stored text that can still be retrieved, not text discarded upstream.

Overview previews identify the section to request for more. An unavailable result must not be described as a successful return of `null`. Retry count and observed event history do not guarantee a complete history of every attempt.

### Example calls

```json
{ "task_id": "task-render-20" }
```

```json
{ "task_id": "task-render-20", "section": "error" }
```

For a small task, overview should answer the question without an additional call. Large payloads require explicit retrieval through the relevant section.

## 4. `list_workers`

Discover workers and their capabilities, with enough current activity context to identify the worker worth inspecting.

### Receives

| Argument | Type | Default | Semantics |
| --- | --- | --- | --- |
| `hostname` | string, optional | absent | Case-insensitive hostname fragment. |
| `task_name` | string, optional | absent | Case-insensitive fragment of a registered task name; a capability filter. |
| `status` | `"all" \| "online" \| "offline"` | `"all"` | Recorded worker availability. |
| `limit` | integer, optional | 10 | Maximum 50. |
| `cursor` | string, optional | absent | Continue the worker list. |

Supplied filters intersect. Workers with unavailable registration data cannot be asserted to match a capability filter; return a bounded diagnostic count for workers that could not be evaluated. A worker currently running a task is not necessarily known to have registered it in the latest available inspection.

### Returns

Top level: `meta`, `effective_filters`, `workers`, `page`, and `diagnostics`. Online workers sort before offline workers, then by full hostname. Preserve and label unknown availability states instead of assuming online.

Each worker contains:

- Exact `hostname`, recorded `status`, and `last_updated`.
- `inspection`: availability and `observed_at` for each section used in the response. An unknown timestamp is `null`.
- `activity_counts`: running, reserved, and scheduled counts; a missing inspection section has a `null` count rather than zero.
- Up to 5 task-name groups with running/reserved/scheduled counts and an omitted-group count. These are snapshot counts, not counts of unique tasks across all sections.
- Up to 5 consumed queue names with availability and omitted count.
- Registered task count if available; with a task-name filter, up to 5 matching registered names and an omitted count.

Do not return full stats blobs, registered name lists, arguments, or results. When inspection sections were observed at different times, avoid presenting their sum as a simultaneous workload measurement.

### Example

```json
{ "task_name": "reports.render", "status": "online" }
```

This finds online workers whose observed registration includes the name. To find executions on a worker, use `search_workflows`; to see its inspected activity, use `inspect_worker`.

## 5. `inspect_worker`

Inspect an identified worker's activity and, when requested, its task registrations or consumed queues.

### Receives

| Argument | Type | Default | Semantics |
| --- | --- | --- | --- |
| `hostname` | string, required | — | Exact hostname, usually returned by `list_workers`. |
| `section` | `"overview" \| "activity" \| "registered" \| "queues"` | `"overview"` | Selected worker evidence. |
| `task_name` | string, optional | absent | Name fragment; valid for `activity` and `registered`. |
| `limit` | integer, optional | section default | Page size; invalid for `overview`. |
| `cursor` | string, optional | absent | Continue the selected collection. |

### Returns

Every section returns `meta`, `worker` (hostname/status/update time), and inspection availability/timestamps for the source sections it uses.

| Section | Additional fields |
| --- | --- |
| `overview` | Activity counts and bounded task-name groups; concurrency when available; queue summary; up to 15 activity rows prioritized running, reserved, then scheduled, with omitted counts per category. |
| `activity` | `effective_filters`, activity rows, and `page`, ordered running/reserved/scheduled, then task ID within each category. |
| `registered` | Matching full registered names, `effective_filters`, and `page`, ordered by name. |
| `queues` | Consumed queues with name, exchange, routing key, and `page`, ordered by name then exchange/routing key. |

Activity rows contain `task_id`, `name`, `activity` (`running`, `reserved`, or `scheduled`), `started_at`, `eta`, and `workflow_id` when a corresponding task record is available. Do not return task arguments here. An inspect-only task may have no event record; preserve its ID and report that workflow/task evidence is unavailable.

Worker inspection is periodic and its sections may be captured at different times. A task may appear in more than one section during a transition. Preserve category/source information instead of fabricating a single authoritative task state. Do not actively poll Celery in response to an MCP call.

### Example calls

```json
{ "hostname": "celery@reports-1" }
```

```json
{ "hostname": "celery@reports-1", "section": "activity", "task_name": "reports.render" }
```

## Errors

| Code | Meaning / recovery |
| --- | --- |
| `invalid_arguments` | Invalid enum, time window, limit, or unsupported argument combination; identify the offending field. |
| `not_found` | Exact task/workflow/worker record is absent. It may never have been observed or may have been removed by retention; do not assert which without evidence. |
| `invalid_cursor` / `cursor_expired` | Restart the original query. |
| `unavailable` | Database or requested observation is unavailable; distinguish infrastructure failure from a missing payload section. |
| `query_budget_exceeded` | The query could not finish within its budget; suggest a narrower name/worker/time scope where applicable. |
| `unauthorized` | Credentials are absent or invalid for the configured deployment. |

Infrastructure failure is not an empty search. Unavailable payload/inspection fields are normally successful results with explicit availability, allowing the rest of the evidence to remain useful.

## Implementation placement and data prerequisites

Bun owns the MCP endpoint and queries SurrealDB directly. Put matching, aggregation, pagination, and response shaping in a module under `runtime/`; the MCP adapter validates arguments and exposes that module's interface. Keep queries parameterized and select only fields needed for the requested view. MCP calls should work on replicas without a local Python ingester, and in snapshot replay mode.

Transport: stateless Streamable HTTP at `/mcp`, with schema-defined structured results and read-only tool annotations, implemented with the official TypeScript MCP SDK. Each request returns JSON; GET/SSE and persistent sessions are not supported.

Queries use the read-only database viewer connection. Requests use Bearer authentication with
`MCP_TOKEN`, falling back to `SURREALDB_FRONTEND_PASS`; unprotected local deployments can omit
the credential. Hosts are explicitly allowlisted and an Origin, if supplied, must match the request.

Current code informs several prerequisites and limitations:

| Current behavior | Consequence for this interface |
| --- | --- |
| `runtime/surreal-schema.ts` defines workflow summaries, member IDs, state/name/worker indexes, and task/event timestamps. | Reuse the model, but derive explicit state distributions and bounded member/name queries. Benchmark query plans; response limits alone do not bound database work. |
| `server/events/ingester.py` recomputes workflow `first_seen_at` from member `last_updated`. | It is not a stable earliest-observation timestamp. Add persistent task/workflow earliest-observation fields for discovery's promised fallback and labels. |
| Workflow membership is currently assigned from each event's `root_id`, falling back to the task ID. | Verify that events lacking lineage do not detach a previously grouped task; preserve known lineage and report incomplete membership where detectable. |
| `server/workers/poller.py` combines several sequential inspect calls; heartbeats also update worker records. | Add timestamps/availability per inspect section. `worker.last_updated` cannot establish inspection freshness. |
| Worker inspection is stored as a JSON string. | Parsing may load more data than a response needs. Measure this cost; consider separate indexed inspection records if worker snapshots are large. |
| `server/tasks/result_fetcher.py` stores Python representations and can truncate stored results. | Return text, preserve `result_truncated`, and do not promise recovery of discarded output or structured argument matching. |
| Current workflow summaries count current failures/retries, not all tasks that previously encountered errors. | Persist per-task error evidence across success/retry updates and derive workflow `has_errors`/`error_task_count` from all members. Use retained events/fields for legacy backfill without claiming unobserved history. Avoid scanning every event on each search. |
| `server/cleanup.py` removes retained workflow/task/event data. | Counts and history describe retained observations; missing IDs may have expired. |

Aggregates must describe their full stated scope, not just the rows sampled for display. Compute them in bounded queries or maintain appropriate ingestion summaries. If a query cannot establish an exact count, return availability explicitly rather than silently counting a limited sample. Benchmark broad searches, huge fan-outs, many unique names, and large worker inspection blobs.

## Future refinements

1. **Business identifiers:** Do agents commonly know an order ID, filename, or similar input value? If so, consider an explicit `input_contains` filter. Stored representations make structured field matching unreliable today.
2. **Discovery defaults:** Is one hour and five candidates a useful first response? Should `status="running"` searches default to all retained history instead?
3. **Error evidence:** Are failure/exception observations sufficient? Retry, rejection, and revocation without error evidence are currently excluded. Do agents also need a separate filter for currently unresolved failures?
4. **Identity during discovery:** Are a representative matching task and one problem task worth their response cost, or should discovery expose only workflow handles?
5. **Workflow overview:** Do agents need more failure rows, running rows, or structural context by default? Is the grouped-name view useful enough to keep?
6. **Payload exposure:** Should task overview include input/output previews by default, or require explicit section retrieval?
7. **Consistency:** Is live pagination with explicit limits sufficient, or do some investigations require a frozen membership snapshot?
8. **Authentication:** Is Bearer access with a separate MCP token sufficient, or do deployments need OAuth-based credential discovery?

## Scenarios for evaluating the design

- A newly spawned task finishes before the first search: default `status="all"` still finds it.
- Twenty invocations share a task name: search shows candidates and matching counts without pretending to identify the intended invocation.
- A workflow has 100,000 children: overview remains small; task-name and child/member pagination allow deliberate inspection.
- Task A and worker B occur in different members of one workflow: their intersection does not produce a false match.
- A workflow has failures and running tasks simultaneously: `status="running"` and `has_errors=true` preserve both facts.
- A task retries after an exception and succeeds: the workflow can be `finished` while retaining `has_errors=true`; error count counts the task once.
- A workflow finishes after intentional revocation without an exception: `finished` does not imply success, and revocation alone does not imply an error.
- An error occurs in a different member from the task-name match: the whole-workflow error filter still includes the candidate.
- A worker has fresh heartbeats but stale/unavailable activity inspection: the response does not claim it is idle.
- A worker has an inspect-only task: its ID remains visible even if task/workflow inspection cannot find a stored record.
- A result is truncated upstream: the response distinguishes recoverable response omission from unrecoverable source truncation.
- The database is unavailable or a query times out: return an error, not a claim that no matching task exists.
- Retention deletes a record between discovery and inspection: explain the observation limit without guessing the task's outcome.
