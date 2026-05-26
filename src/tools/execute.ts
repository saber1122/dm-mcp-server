import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection } from "../db/connection.js";
import type { PermissionController } from "../permission.js";

export function registerExecuteTool(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController
) {
  server.tool(
    "dm_execute",
    "执行 DML 语句（INSERT / UPDATE / DELETE）。需要 readwrite 或更高权限。",
    {
      sql: z
        .string()
        .describe(
          "INSERT / UPDATE / DELETE 等 DML 语句"
        ),
      autoCommit: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否自动提交事务，默认 true"),
    },
    async ({ sql, autoCommit }) => {
      try {
        permission.checkSql(sql);

        // 如果手动管理事务模式
        if (!db.getAutoCommit()) {
          const result = await db.execute(sql);
          return {
            content: [
              {
                type: "text",
                text: `执行成功（未提交），影响行数: ${result.affectedRows}，耗时 ${result.durationMs}ms\n使用 dm_transaction (commit/rollback) 来提交或回滚`,
              },
            ],
          };
        }

        const result = await db.execute(sql);

        return {
          content: [
            {
              type: "text",
              text: `执行成功，影响行数: ${result.affectedRows}，耗时 ${result.durationMs}ms`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `执行失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // 参数化执行
  server.tool(
    "dm_execute_prepared",
    "使用参数化方式执行 SQL（防 SQL 注入）。使用 ? 作为占位符。",
    {
      sql: z
        .string()
        .describe("带 ? 占位符的 SQL 语句"),
      params: z
        .array(z.any())
        .describe("参数值数组，按 ? 出现顺序对应"),
      autoCommit: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否自动提交事务，默认 true"),
    },
    async ({ sql, params, autoCommit }) => {
      try {
        permission.checkSql(sql);

        const result = await db.executePrepared(sql, params);

        return {
          content: [
            {
              type: "text",
              text: `参数化执行成功，影响行数: ${result.affectedRows}，耗时 ${result.durationMs}ms`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `执行失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
