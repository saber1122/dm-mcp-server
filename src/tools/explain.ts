import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection } from "../db/connection.js";
import type { PermissionController } from "../permission.js";

export function registerExplainTool(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController
) {
  server.tool(
    "dm_explain",
    "分析 SQL 执行计划，用于性能调优。需要权限配置中 enableExplain=true。",
    {
      sql: z.string().describe("需要分析执行计划的 SQL 语句"),
    },
    async ({ sql }) => {
      try {
        permission.checkExplain();
        permission.checkSql(sql);

        // 达梦使用 EXPLAIN 获取执行计划
        const explainSql = `EXPLAIN ${sql}`;
        const result = await db.query(explainSql);

        if (result.rows.length === 0) {
          return {
            content: [{ type: "text", text: "无法获取执行计划" }],
            isError: true,
          };
        }

        const lines: string[] = [];
        lines.push("## 执行计划");
        lines.push("");
        lines.push(`**SQL**: \`${sql.replace(/\n/g, " ").substring(0, 200)}${sql.length > 200 ? "..." : ""}\``);
        lines.push("");

        // 执行计划表格
        const header = "| " + result.columns.map((c) => c).join(" | ") + " |";
        const sep = "| " + result.columns.map(() => "---").join(" | ") + " |";
        lines.push(header);
        lines.push(sep);

        for (const row of result.rows) {
          lines.push(
            "| " +
              row.map((v) => String(v ?? "").replace(/\|/g, "\\|")).join(" | ") +
              " |"
          );
        }

        lines.push("");
        lines.push(`耗时 ${result.durationMs}ms`);

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `分析失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
