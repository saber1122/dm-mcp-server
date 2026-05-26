import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection } from "../db/connection.js";
import type { PermissionController } from "../permission.js";

export function registerTransactionTool(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController
) {
  server.tool(
    "dm_transaction",
    "事务控制：开启事务、提交或回滚。需要 readwrite 或更高权限。",
    {
      action: z
        .enum(["begin", "commit", "rollback"])
        .describe("操作类型: begin(开启) / commit(提交) / rollback(回滚)"),
    },
    async ({ action }) => {
      try {
        switch (action) {
          case "begin": {
            permission.requireMin("readwrite");
            await db.beginTransaction();
            return {
              content: [
                {
                  type: "text",
                  text: "事务已开启。后续 DML 操作不会自动提交，请使用 dm_transaction (commit/rollback) 完成。",
                },
              ],
            };
          }
          case "commit": {
            await db.commit();
            return {
              content: [{ type: "text", text: "事务已提交" }],
            };
          }
          case "rollback": {
            await db.rollback();
            return {
              content: [{ type: "text", text: "事务已回滚" }],
            };
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `事务操作失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
