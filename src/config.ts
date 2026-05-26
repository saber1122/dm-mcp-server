import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const DmConfigSchema = z.object({
  jarPath: z.string().describe("达梦 JDBC JAR 文件绝对路径"),
  host: z.string().default("127.0.0.1"),
  port: z.number().default(5236),
  database: z.string().default("DAMENG"),
  username: z.string(),
  password: z.string(),
  schema: z.string().optional(),
  jdbcParams: z
    .record(z.string())
    .optional()
    .describe(
      "JDBC 连接参数 key-value，常用: compatibleMode, characterEncoding, " +
      "useUnicode, useSSL, tinyInt1isBit, serverTimezone, clobAsString 等"
    ),
  connectionPool: z
    .object({
      min: z.number().default(1),
      max: z.number().default(10),
      idleTimeoutMs: z.number().default(30000),
    })
    .optional(),
});

export const PermissionConfigSchema = z.object({
  mode: z.enum(["readonly", "readwrite", "ddl", "admin"]).default("readonly"),
  allowedSchemas: z.array(z.string()).optional(),
  blockedTables: z.array(z.string()).optional(),
  maxResultRows: z.number().default(500),
  enableExplain: z.boolean().default(true),
  requireConfirmForDDL: z.boolean().default(true),
});

export const ServerConfigSchema = z.object({
  name: z.string().default("dm-mcp"),
  version: z.string().default("1.0.0"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const ConfigSchema = z.object({
  dm: DmConfigSchema,
  permission: PermissionConfigSchema,
  server: ServerConfigSchema.optional(),
});

export type DmConfig = z.infer<typeof DmConfigSchema>;
export type PermissionConfig = z.infer<typeof PermissionConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath: string): Config {
  const resolved = path.resolve(configPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`配置文件不存在: ${resolved}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
  const parsed = ConfigSchema.safeParse(raw);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`配置文件校验失败:\n${errors}`);
  }

  return parsed.data;
}

/**
 * 将 jdbcParams 拼接为 JDBC URL querystring
 * 排除 user / password / schema（这些通过 Properties 传入）
 */
export function buildJdbcUrl(config: DmConfig): string {
  const excluded = new Set(["user", "password", "schema"]);
  const params = Object.entries(config.jdbcParams ?? {})
    .filter(([k]) => !excluded.has(k))
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    )
    .join("&");

  return `jdbc:dm://${config.host}:${config.port}${
    params ? "?" + params : ""
  }`;
}

/**
 * 返回脱敏 JDBC URL（用于调试展示）
 */
export function getDisplayJdbcUrl(config: DmConfig): string {
  const excluded = new Set(["user", "password", "schema"]);
  const entries = Object.entries(config.jdbcParams ?? {}).filter(
    ([k]) => !excluded.has(k)
  );
  const qs = entries.map(([k, v]) => `${k}=${v}`).join("&");

  return `jdbc:dm://${config.host}:${config.port}?${
    qs ? qs + "&" : ""
  }schema=${config.schema ?? ""}`;
}
