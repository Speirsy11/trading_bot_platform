import type { createDb } from "@tb/db";

type DatabaseClient = ReturnType<typeof createDb>["client"];

export async function assertDatabaseSchemaReady(client: DatabaseClient) {
  const missingRows = await client.unsafe<Array<{ relation_name: string }>>(`
    select relation_name
    from (
      values
        ('settings', to_regclass('public.settings')),
        ('order_audit_log', to_regclass('public.order_audit_log')),
        ('research_sweeps', to_regclass('public.research_sweeps')),
        ('research_results', to_regclass('public.research_results'))
    ) as required(relation_name, relation_ref)
    where relation_ref is null
  `);

  if (missingRows.length === 0) {
    return;
  }

  const missingTables = missingRows.map((row) => row.relation_name);
  const noun = missingTables.length === 1 ? "table" : "tables";

  throw new Error(
    `Database schema is not initialized; missing ${noun}: ${missingTables.join(", ")}. Run \`pnpm db:migrate\` and restart the service.`
  );
}
