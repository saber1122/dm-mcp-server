import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection, QueryResult } from "../db/connection.js";
import type { PermissionController } from "../permission.js";
import type { Config } from "../config.js";

/**
 * 将查询结果格式化为 Markdown 表格
 */
function formatQueryResult(result: QueryResult): string {
  if (result.rows.length === 0) {
    return "(查询结果为空，0 行)";
  }

  // 计算每列宽度
  const colWidths = result.columns.map((col, i) => {
    const maxDataLen = result.rows.reduce(
      (max, row) => Math.max(max, String(row[i] ?? "NULL").length),
      0
    );
    return Math.max(col.length, maxDataLen, 4); // 最小宽度 4
  });

  // 表头
  const header =
    "| " +
    result.columns.map((col, i) => col.padEnd(colWidths[i])).join(" | ") +
    " |";

  // 分隔线
  const separator =
    "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";

  // 数据行
  const dataRows = result.rows
    .map(
      (row) =>
        "| " +
        row
          .map((val, i) => String(val ?? "NULL").padEnd(colWidths[i]))
          .join(" | ") +
        " |"
    )
    .join("\n");

  return `${header}\n${separator}\n${dataRows}\n\n查询到 ${result.rowCount} 行，耗时 ${result.durationMs}ms`;
}

/**
 * 为 SQL 注入行数限制（达梦语法：FETCH FIRST n ROWS ONLY）
 */
function wrapWithLimit(sql: string, limit: number): string {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  const upper = trimmed.toUpperCase();

  // 如果已有 LIMIT 或 FETCH，不重复添加
  if (/\bLIMIT\s+\d+/i.test(trimmed) || /\bFETCH\s+FIRST\b/i.test(trimmed)) {
    return trimmed;
  }

  // WITH 子句处理
  if (upper.startsWith("WITH")) {
    return `${trimmed} FETCH FIRST ${limit} ROWS ONLY`;
  }

  return `${trimmed} FETCH FIRST ${limit} ROWS ONLY`;
}

export function registerQueryTool(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController,
  config: Config
) {
  server.tool(
    "dm_query",
    "执行 SELECT 查询。只读操作，结果以 Markdown 表格返回。会自动限制返回行数防止结果集过大。",
    {
      sql: z.string().describe("SELECT 查询语句"),
      limit: z
        .number()
        .optional()
        .default(100)
        .describe("最大返回行数，默认 100"),
    },
    async ({ sql, limit }) => {
      try {
        permission.checkSql(sql);

        const effectiveLimit = Math.min(
          limit,
          permission.getMaxResultRows()
        );
        const safeSql = wrapWithLimit(sql, effectiveLimit);

        const result = await db.query(safeSql);

        return {
          content: [{ type: "text", text: formatQueryResult(result) }],
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
