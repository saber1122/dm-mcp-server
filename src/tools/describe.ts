import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection } from "../db/connection.js";
import type { PermissionController } from "../permission.js";

export function registerDescribeTool(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController
) {
  server.tool(
    "dm_describe",
    "查询表的结构信息：字段名、类型、是否允许 NULL、默认值、注释、索引等。",
    {
      tableName: z
        .string()
        .describe(
          "表名。格式: SCHEMA.TABLE_NAME 或 TABLE_NAME（不填 schema 使用当前用户）"
        ),
    },
    async ({ tableName }) => {
      try {
        permission.checkTableAccess(tableName);

        const info = await db.describeTable(tableName);

        if (info.columns.length === 0) {
          return {
            content: [
              { type: "text", text: `表 ${tableName} 不存在或无访问权限` },
            ],
            isError: true,
          };
        }

        // 格式化列信息
        const colLines: string[] = [];
        colLines.push(`## 表: ${tableName}`);
        colLines.push("");

        // Markdown 表格
        const header = "| 列名 | 类型 | 长度/精度 | 允许NULL | 默认值 | 注释 |";
        const sep =
          "|------|------|-----------|----------|--------|------|";
        colLines.push(header);
        colLines.push(sep);

        for (const col of info.columns) {
          const typeStr =
            col.precision > 0
              ? `${col.typeName}(${col.precision}${col.scale > 0 ? `,${col.scale}` : ""})`
              : col.typeName;
          const nullStr = col.nullable ? "YES" : "NO";
          const defaultStr = col.defaultValue
            ? String(col.defaultValue).substring(0, 20)
            : "-";
          colLines.push(
            `| ${col.name} | ${col.type} | ${typeStr} | ${nullStr} | ${defaultStr} | ${col.comment} |`
          );
        }

        // 索引信息
        if (info.indexes.length > 0) {
          colLines.push("");
          colLines.push("### 索引");
          for (const idx of info.indexes) {
            colLines.push(
              `- **${idx.indexName}** (${idx.columns.join(", ")}) ${idx.unique ? "[UNIQUE]" : ""}`
            );
          }
        }

        colLines.push("");
        colLines.push(`共 ${info.columns.length} 个字段，${info.indexes.length} 个索引`);

        return {
          content: [{ type: "text", text: colLines.join("\n") }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `查询失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
