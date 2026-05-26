import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection } from "../db/connection.js";
import type { PermissionController } from "../permission.js";

export function registerAdminTool(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController
) {
  server.tool(
    "dm_admin_execute",
    "执行管理级 SQL：GRANT / REVOKE / 存储过程调用 / CREATE USER 等。需要 admin 权限。",
    {
      sql: z
        .string()
        .describe(
          "管理级 SQL 语句 (GRANT / REVOKE / EXEC / CALL / CREATE USER 等)"
        ),
      description: z
        .string()
        .optional()
        .describe("操作说明，用于审计日志"),
    },
    async ({ sql, description }) => {
      try {
        permission.checkSql(sql);

        const desc = description ? ` [${description}]` : "";
        const result = await db.execute(sql);

        return {
          content: [
            {
              type: "text",
              text: `管理操作执行成功${desc}，耗时 ${result.durationMs}ms`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `管理操作失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
