import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection } from "../db/connection.js";
import type { PermissionController } from "../permission.js";

export function registerDdlTools(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController
) {
  // ─── 建表 ───────────────────────────────────
  server.tool(
    "dm_create_table",
    "执行 CREATE TABLE 语句。需要 ddl 或更高权限。",
    {
      sql: z
        .string()
        .describe("完整的 CREATE TABLE 语句"),
      ifNotExists: z
        .boolean()
        .optional()
        .default(true)
        .describe("是否使用 IF NOT EXISTS，防止重复建表"),
    },
    async ({ sql, ifNotExists }) => {
      try {
        permission.checkSql(sql);

        let finalSql = sql.trim().replace(/;+\s*$/, "");

        // 自动注入 IF NOT EXISTS
        if (
          ifNotExists &&
          !/IF\s+NOT\s+EXISTS/i.test(finalSql)
        ) {
          finalSql = finalSql.replace(
            /CREATE\s+TABLE\s+/i,
            "CREATE TABLE IF NOT EXISTS "
          );
        }

        const result = await db.execute(finalSql);

        return {
          content: [
            {
              type: "text",
              text: `建表成功，耗时 ${result.durationMs}ms`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `建表失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // ─── 删表 ───────────────────────────────────
  server.tool(
    "dm_drop_table",
    "删除表。需要 ddl 或更高权限。必须输入确认名称（与表名一致）才能执行，防止误删。",
    {
      tableName: z
        .string()
        .describe("表名，格式 SCHEMA.TABLE_NAME 或 TABLE_NAME"),
      cascade: z
        .boolean()
        .optional()
        .default(false)
        .describe("是否级联删除依赖对象"),
      confirm: z
        .string()
        .describe(
          "安全确认：必须输入与 tableName 完全一致的值，否则操作被拒绝"
        ),
    },
    async ({ tableName, cascade, confirm }) => {
      try {
        // 安全确认
        if (confirm !== tableName) {
          return {
            content: [
              {
                type: "text",
                text: `安全确认失败: 输入的确认值 [${confirm}] 与表名 [${tableName}] 不匹配，操作已取消。\n请确保 confirm 参数值与 tableName 完全一致。`,
              },
            ],
            isError: true,
          };
        }

        permission.checkSql(`DROP TABLE ${tableName}`);
        permission.checkTableAccess(tableName);

        const sql = `DROP TABLE IF EXISTS ${tableName}${
          cascade ? " CASCADE" : ""
        }`;
        const result = await db.execute(sql);

        return {
          content: [
            {
              type: "text",
              text: `表 [${tableName}] 已删除${cascade ? "（级联）" : ""}，耗时 ${result.durationMs}ms`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `删除失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // ─── 执行任意 DDL ──────────────────────────
  server.tool(
    "dm_ddl_execute",
    "执行 DDL 语句（CREATE / ALTER / DROP 等，不含建表删表）。需要 ddl 或更高权限。",
    {
      sql: z.string().describe("DDL 语句"),
    },
    async ({ sql }) => {
      try {
        permission.checkSql(sql);

        const result = await db.execute(sql);

        return {
          content: [
            {
              type: "text",
              text: `DDL 执行成功，耗时 ${result.durationMs}ms`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `DDL 执行失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
