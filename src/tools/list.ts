import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection } from "../db/connection.js";
import type { PermissionController } from "../permission.js";

export function registerListTablesTool(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController
) {
  server.tool(
    "dm_list_tables",
    "列举数据库中的表或视图。支持按 schema 过滤和表名模糊匹配。",
    {
      schema: z
        .string()
        .optional()
        .describe("schema 名称，不填列举所有可访问的 schema 的表"),
      pattern: z
        .string()
        .optional()
        .describe("表名模糊匹配，支持 % 通配符，如 '%ORDER%'"),
      type: z
        .enum(["TABLE", "VIEW", "ALL"])
        .optional()
        .default("ALL")
        .describe("列举类型: TABLE / VIEW / ALL"),
    },
    async ({ schema, pattern, type }) => {
      try {
        if (schema) {
          permission.checkTableAccess(`${schema}.dummy`);
        }

        const tables = await db.listTables({ schema, pattern, type });

        if (tables.length === 0) {
          const filterDesc = schema
            ? `schema=${schema}, pattern=${pattern ?? "%"}`
            : "所有";
          return {
            content: [
              {
                type: "text",
                text: `未找到匹配的表 (${filterDesc}, type=${type})`,
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(
          `共 ${tables.length} 个${type === "ALL" ? "对象" : type.toLowerCase()}`
        );
        lines.push("");
        lines.push(
          "| 序号 | Schema | 表名 | 类型 | 注释 |"
        );
        lines.push(
          "|------|--------|------|------|------|"
        );

        tables.forEach((t, i) => {
          lines.push(
            `| ${i + 1} | ${t.schema} | ${t.tableName} | ${t.type} | ${t.comment} |`
          );
        });

        return {
          content: [{ type: "text", text: lines.join("\n") }],
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

export function registerListSchemasTool(
  server: McpServer,
  db: DmConnection,
  _permission: PermissionController
) {
  server.tool(
    "dm_list_schemas",
    "列举当前用户可访问的所有 schema（用户）。",
    {},
    async () => {
      try {
        const schemas = await db.listSchemas();

        if (schemas.length === 0) {
          return {
            content: [{ type: "text", text: "未找到可访问的 schema" }],
          };
        }

        const lines = schemas.map((s, i) => `${i + 1}. ${s}`);
        lines.push("");
        lines.push(`共 ${schemas.length} 个 schema`);

        return {
          content: [{ type: "text", text: lines.join("\n") }],
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
