import { buildTaskSearch, buildWorkflowSearch, keywordSearchTerm, trimQuery } from "./task-search"

// Candidate lists contain record references, so SELECTs fetch only candidates before applying the
// original predicates, sort, counts and pagination. No index is required for the fallback branch.
const candidateSource = (
  table: string,
  extra = "",
) => `IF (SELECT VALUE ready FROM search_config:current)[0] = true THEN
  (SELECT VALUE record FROM ${table}_search WHERE grams CONTAINS $searchGram OR text_fallback = true ${extra})
  ELSE type::table('${table}') END`

export const buildIndexedTaskSearch = (query: string) => {
  const search = buildTaskSearch(query)
  const trimmed = trimQuery(query).toLowerCase()
  if ([...trimmed].length < 3) return { ...search, prelude: [] as string[], source: "task" }
  return {
    ...search,
    prelude: [
      `LET $searchTasks = ${candidateSource("task", "OR kwargs_terms CONTAINS $searchTerm OR ($searchTerm != NULL AND kwargs_fallback = true)")};`,
    ],
    source: "$searchTasks",
    bindings: {
      ...search.bindings,
      searchGram: [...trimmed].slice(-3).join(""),
      searchTerm: keywordSearchTerm(query),
    },
  }
}

export const buildIndexedWorkflowSearch = (query: string) => {
  const original = buildWorkflowSearch(query)
  const taskSearch = buildIndexedTaskSearch(query)
  const trimmed = trimQuery(query).toLowerCase()
  if ([...trimmed].length < 3) return { ...original, source: "workflow" }
  const memberPrelude = original.prelude.length
    ? [
        ...taskSearch.prelude,
        original.prelude[0],
        `LET $searchWorkflows = array::distinct(SELECT VALUE workflow_id FROM ${taskSearch.source} WHERE workflow_id IN $rangeWorkflows AND (${taskSearch.clause}));`,
      ]
    : []
  return {
    ...original,
    prelude: [
      ...memberPrelude,
      `LET $searchWorkflowRows = ${candidateSource("workflow", original.prelude.length ? "OR record.root_task_id IN $searchWorkflows" : "")};`,
    ],
    source: "$searchWorkflowRows",
    bindings: { ...taskSearch.bindings },
  }
}
