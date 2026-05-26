import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DmConnection } from "../db/connection.js";
import type { PermissionController } from "../permission.js";
import type { Config } from "../config.js";
import { getDisplayJdbcUrl } from "../config.js";

export function registerConnectionInfoTool(
  server: McpServer,
  db: DmConnection,
  permission: PermissionController,
  config: Config
) {
  server.tool(
    "dm_connection_info",
    "查看当前数据库连接信息和实例参数（用于诊断 jdbcParams 是否生效）。",
    {},
    async () => {
      try {
        const jdbcUrl = getDisplayJdbcUrl(config.dm);

        // 查询数据库实例参数
        const paramSql = `
          SELECT
            PARA_NAME,
            PARA_VALUE
          FROM V\$PARAMETER
          WHERE PARA_NAME IN (
            'COMPATIBLE_MODE', 'CHARACTER_SET',
            'INSTANCE_NAME', 'DB_NAME',
            'PORT_NUM', 'CACHE_SIZE'
          )
          ORDER BY PARA_NAME
        `;
        const params = await db.query(paramSql);

        // 查询数据库版本
        const versionSql = `SELECT BANNER FROM V\$VERSION`;
        const versionResult = await db.query(versionSql);

        const lines: string[] = [];
        lines.push("## 连接诊断信息");
        lines.push("");
        lines.push(`**JDBC URL**: \`${jdbcUrl}\``);
        lines.push(`**权限模式**: ${permission.getMode()}`);
        lines.push(`**连接状态**: ${db.isConnected() ? "已连接" : "未连接"}`);
        lines.push("");

        // 数据库版本
        if (versionResult.rows.length > 0) {
          lines.push("**数据库版本**:");
          for (const row of versionResult.rows) {
            lines.push(`- ${String(row[0])}`);
          }
          lines.push("");
        }

        // 实例参数
        if (params.rows.length > 0) {
          lines.push("**数据库实例参数**:");
          lines.push(
            "| 参数名 | 值 |"
          );
          lines.push(
            "|--------|----|"
          );
          for (const row of params.rows) {
            lines.push(`| ${row[0]} | ${row[1]} |`);
          }
          lines.push("");
        }

        // 当前生效的 jdbcParams
        if (config.dm.jdbcParams && Object.keys(config.dm.jdbcParams).length > 0) {
          lines.push("**已配置的 JDBC 参数**:");
          for (const [k, v] of Object.entries(config.dm.jdbcParams)) {
            lines.push(`- ${k} = ${v}`);
          }
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `获取连接信息失败: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
