import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { Surreal } from "surrealdb"
import type { Config } from "./config"
import { bunLogger } from "./logger"
import { kwargsSearchTerms } from "../src/lib/task-search"

export const SEARCH_CONTROL_SCHEMA = `
DEFINE TABLE IF NOT EXISTS search_config SCHEMALESS PERMISSIONS FOR select FULL FOR create, update, delete NONE;
DEFINE TABLE IF NOT EXISTS search_instance SCHEMALESS PERMISSIONS NONE;
`

// The Python CSV regression suite loads this same schema against native SurrealDB.
export const SEARCH_PROJECTION_SCHEMA = readFileSync(new URL("./search-index-schema.surql", import.meta.url), "utf8")

export const REMOVE_SEARCH_PROJECTIONS = `
REMOVE EVENT IF EXISTS ci_search_task ON task;
REMOVE EVENT IF EXISTS ci_search_workflow ON workflow;
REMOVE TABLE IF EXISTS task_search;
REMOVE TABLE IF EXISTS workflow_search;
REMOVE FUNCTION IF EXISTS fn::search_project_task;
REMOVE FUNCTION IF EXISTS fn::search_project_workflow;
REMOVE FUNCTION IF EXISTS fn::search_grams;
`

// All instances lease the same database setting. A rolling deployment with conflicting settings fails
// before changing shared maintenance. Stop the old instances (or wait for their leases) to change modes.
export class SearchIndexes {
  private readonly instance = randomUUID()
  private heartbeat?: ReturnType<typeof setInterval>

  constructor(private readonly db: Surreal) {}

  async start(enabled: boolean): Promise<void> {
    await this.db.query(SEARCH_CONTROL_SCHEMA).collect()
    await this.db
      .query(
        `BEGIN TRANSACTION;
      IF array::len(SELECT id FROM search_instance WHERE expires_at > time::now() AND enabled != $enabled) > 0 {
        THROW 'Search indexing configuration conflicts with another active instance sharing this database';
      };
      DELETE search_instance WHERE expires_at <= time::now();
      LET $previous = (SELECT * FROM search_config:current)[0] ?? {};
      UPSERT search_config:current SET enabled = $enabled,
        ready = IF $previous.enabled = $enabled THEN $previous.ready ?? false ELSE false END;
      UPSERT type::record('search_instance', $instance) SET enabled = $enabled, expires_at = time::now() + 60s;
      COMMIT TRANSACTION;`,
        { enabled, instance: this.instance },
      )
      .collect()
    this.heartbeat = setInterval(() => {
      void this.db
        .query("UPDATE type::record('search_instance', $instance) SET expires_at = time::now() + 60s", {
          instance: this.instance,
        })
        .collect()
        .catch((error) => bunLogger.error(`Search configuration lease failed: ${error}`))
    }, 10_000)
    try {
      if (!enabled) {
        await this.db.query("UPDATE search_config:current SET ready = false;").collect()
        await this.db.query(REMOVE_SEARCH_PROJECTIONS).collect()
        return
      }
      // Mark reads as fallback throughout schema creation and backfill, including a resumed failed build.
      await this.db.query("UPDATE search_config:current SET ready = false;").collect()
      await this.db.query(SEARCH_PROJECTION_SCHEMA).collect()
      for (const table of ["task", "workflow"]) {
        let after: unknown = null
        while (true) {
          const [rows] = await this.db
            .query<Record<string, unknown>[][]>(
              `SELECT ${table === "task" ? "id, kwargs, kwargs_search_source" : "id"} FROM ${table} WHERE $after = NULL OR id > $after ORDER BY id LIMIT 200`,
              { after },
            )
            .collect()
          if (!rows.length) break
          // Read each record again inside the transaction so backfill cannot overwrite a concurrent change.
          await this.db
            .query(
              `FOR $id IN $ids {
            LET $row = (SELECT * FROM $id)[0];
            IF $row != NONE { fn::search_project_${table}($row, $row); };
          };`,
              { ids: rows.map((row) => row.id) },
            )
            .collect()
          if (table === "task") {
            for (const row of rows) {
              const raw = typeof row.kwargs === "string" ? row.kwargs : null
              const source = typeof row.kwargs_search_source === "string" ? row.kwargs_search_source : null
              const terms = kwargsSearchTerms(raw, source)
              await this.db
                .query(
                  `UPDATE type::record('task_search', record::id($id)) SET
                kwargs_terms = $terms, kwargs_fallback = $fallback
                WHERE record.kwargs = $raw;`,
                  { id: row.id, raw: raw ?? undefined, terms: terms.terms, fallback: terms.fallback },
                )
                .collect()
            }
          }
          after = rows.at(-1)!.id
        }
      }
      await this.db.query("UPDATE search_config:current SET ready = true;").collect()
      bunLogger.info("Search projections ready")
    } catch (error) {
      await this.stop()
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat)
    await this.db.query("DELETE type::record('search_instance', $instance)", { instance: this.instance }).collect()
  }
}

export const startSearchIndexes = async (db: Surreal, config: Config): Promise<SearchIndexes> => {
  const indexes = new SearchIndexes(db)
  await indexes.start(config.searchIndexingEnabled && !config.debugBundlePath)
  return indexes
}
