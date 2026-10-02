import { Surreal } from "surrealdb"
import { config } from "../runtime/config"
import { runSchemaMigration } from "../runtime/surreal-schema"
const url = process.env.SURREAL_UPGRADE_URL ?? "ws://127.0.0.1:18558/rpc"
await runSchemaMigration({ ...config, surrealdbUrl: url })
const db = new Surreal()
await db.connect(url, { authentication: { username: "root", password: "root" } })
await db.use({ namespace: "celery_insights", database: "main" })
if (process.argv[2] === "seed") {
  await db
    .query(
      `CREATE task:upgrade_parent SET type='upgrade.parent', state='SUCCESS', workflow_id='upgrade_parent', last_updated=time::now(), runtime=1.5, result='preserved'; CREATE task:upgrade_child SET type='upgrade.child', state='FAILURE', workflow_id='upgrade_parent', root_id='upgrade_parent', parent_id='upgrade_parent', last_updated=time::now(), exception='expected failure'; CREATE event:upgrade_event SET event_type='task-succeeded', task_id='upgrade_parent', timestamp=time::now(); CREATE worker:upgrade_worker SET hostname='upgrade-worker', status='online', last_updated=time::now();`,
    )
    .collect()
  await db
    .query(
      `CREATE workflow:upgrade_parent SET root_task_id='upgrade_parent', aggregate_state='FAILURE', task_count=2; RELATE workflow:upgrade_parent->workflow_task:⟨upgrade_parent:upgrade_parent⟩->task:upgrade_parent; RELATE workflow:upgrade_parent->workflow_task:⟨upgrade_parent:upgrade_child⟩->task:upgrade_child;`,
    )
    .collect()
}
const result = await db
  .query<
    [
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
    ]
  >(
    "SELECT * FROM task ORDER BY id; SELECT * FROM workflow; SELECT * FROM workflow_task; SELECT * FROM event; SELECT * FROM worker;",
  )
  .collect()
if (
  result[0].length !== 2 ||
  result[1].length !== 1 ||
  result[2].length !== 2 ||
  result[3].length !== 1 ||
  result[4].length !== 1
)
  throw Error("Persistence count mismatch " + JSON.stringify(result))
if (!result[0].some((t) => t.result === "preserved") || !result[0].some((t) => t.exception === "expected failure"))
  throw Error("Task data changed")
console.warn(JSON.stringify(result))
await db.close()
