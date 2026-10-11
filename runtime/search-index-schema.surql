DEFINE TABLE IF NOT EXISTS task_search SCHEMALESS PERMISSIONS FOR select FULL FOR create, update, delete NONE;
DEFINE TABLE IF NOT EXISTS workflow_search SCHEMALESS PERMISSIONS FOR select FULL FOR create, update, delete NONE;
DEFINE FUNCTION OVERWRITE fn::search_grams($text: string) {
  LET $text = string::slice(string::lowercase($text), 0, 512);
  RETURN IF string::len($text) < 3 THEN [] ELSE
    array::distinct(array::map(array::range(0..(string::len($text) - 2)), |$offset| string::slice($text, $offset, $offset + 3))) END;
};

DEFINE FUNCTION OVERWRITE fn::search_project_task($row: object, $before: object) {
  LET $target = type::record('task_search', record::id($row.id));
  LET $old = (SELECT * FROM $target)[0] ?? {};
  UPSERT $target SET record = $row.id,
    g_id = $old.g_id ?? fn::search_grams(<string>$row.id),
    g_type = IF $row.type = $before.type AND $old.id != NONE
    THEN $old.g_type ELSE fn::search_grams($row.type ?? '') END,
    g_worker = IF $row.worker = $before.worker AND $old.id != NONE
    THEN $old.g_worker ELSE fn::search_grams($row.worker ?? '') END,
    g_exception = IF $row.exception = $before.exception AND $old.id != NONE
    THEN $old.g_exception ELSE fn::search_grams($row.exception ?? '') END,
    g_result = IF $row.result = $before.result AND $old.id != NONE
    THEN $old.g_result ELSE fn::search_grams($row.result ?? '') END,
    g_args = IF $row.args = $before.args AND $old.id != NONE
    THEN $old.g_args ELSE fn::search_grams($row.args ?? '') END,
    g_kwargs = IF $row.kwargs = $before.kwargs AND $old.id != NONE
    THEN $old.g_kwargs ELSE fn::search_grams($row.kwargs ?? '') END,
    text_fallback = string::len(string::lowercase(<string>$row.id)) > 512 OR
      string::len(string::lowercase(($row.type ?? ''))) > 512 OR
      string::len(string::lowercase(($row.worker ?? ''))) > 512 OR
      string::len(string::lowercase(($row.exception ?? ''))) > 512 OR
      string::len(string::lowercase(($row.result ?? ''))) > 512 OR
      string::len(string::lowercase(($row.args ?? ''))) > 512 OR
      string::len(string::lowercase(($row.kwargs ?? ''))) > 512,
    kwargs_terms = IF $row.kwargs = $before.kwargs THEN $old.kwargs_terms ?? [] ELSE [] END,
    kwargs_fallback = IF $row.kwargs = $before.kwargs THEN $old.kwargs_fallback ?? true ELSE ($row.kwargs ?? '') != '' END;
  UPDATE $target SET grams = array::distinct(array::flatten([g_id, g_type, g_worker, g_exception, g_result, g_args, g_kwargs]));
};
DEFINE EVENT OVERWRITE ci_search_task ON task
WHEN $event = 'CREATE' OR $event = 'DELETE' OR
  [$before.type, $before.worker, $before.exception, $before.result, $before.args, $before.kwargs] != [$after.type, $after.worker, $after.exception, $after.result, $after.args, $after.kwargs]
THEN {
  IF $event = 'DELETE' {
    DELETE type::record('task_search', record::id($before.id));
  } ELSE {
    fn::search_project_task($after, $before ?? {});
  };
};

DEFINE FUNCTION OVERWRITE fn::search_project_workflow($row: object, $before: object) {
  LET $target = type::record('workflow_search', record::id($row.id));
  LET $old = (SELECT * FROM $target)[0] ?? {};
  UPSERT $target SET record = $row.id,
    g_id = $old.g_id ?? fn::search_grams(<string>$row.id),
    g_root_task_id = IF $row.root_task_id = $before.root_task_id AND $old.id != NONE
    THEN $old.g_root_task_id ELSE fn::search_grams($row.root_task_id ?? '') END,
    g_root_task_type = IF $row.root_task_type = $before.root_task_type AND $old.id != NONE
    THEN $old.g_root_task_type ELSE fn::search_grams($row.root_task_type ?? '') END,
    g_latest_exception_preview = IF $row.latest_exception_preview = $before.latest_exception_preview AND $old.id != NONE
    THEN $old.g_latest_exception_preview ELSE fn::search_grams($row.latest_exception_preview ?? '') END,
    text_fallback = string::len(string::lowercase(<string>$row.id)) > 512 OR
      string::len(string::lowercase(($row.root_task_id ?? ''))) > 512 OR
      string::len(string::lowercase(($row.root_task_type ?? ''))) > 512 OR
      string::len(string::lowercase(($row.latest_exception_preview ?? ''))) > 512;
  UPDATE $target SET grams = array::distinct(array::flatten([g_id, g_root_task_id, g_root_task_type, g_latest_exception_preview]));
};
DEFINE EVENT OVERWRITE ci_search_workflow ON workflow
WHEN $event = 'CREATE' OR $event = 'DELETE' OR
  [$before.root_task_id, $before.root_task_type, $before.latest_exception_preview] != [$after.root_task_id, $after.root_task_type, $after.latest_exception_preview]
THEN {
  IF $event = 'DELETE' {
    DELETE type::record('workflow_search', record::id($before.id));
  } ELSE {
    fn::search_project_workflow($after, $before ?? {});
  };
};
DEFINE INDEX IF NOT EXISTS ci_search_task_grams ON task_search FIELDS grams.*;
DEFINE INDEX IF NOT EXISTS ci_search_task_text_fallback ON task_search FIELDS text_fallback;
DEFINE INDEX IF NOT EXISTS ci_search_task_kwargs_terms ON task_search FIELDS kwargs_terms.*;
DEFINE INDEX IF NOT EXISTS ci_search_task_kwargs_fallback ON task_search FIELDS kwargs_fallback;
DEFINE INDEX IF NOT EXISTS ci_search_workflow_grams ON workflow_search FIELDS grams.*;
DEFINE INDEX IF NOT EXISTS ci_search_workflow_text_fallback ON workflow_search FIELDS text_fallback;
