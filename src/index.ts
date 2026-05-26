#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig, ConfigSchema, type Config } from "./config.js";
import * as fs from "fs";
import * as path from "path";
import { DmConnection } from "./db/connection.js";
import { PermissionController } from "./permission.js";
import { registerQueryTool } from "./tools/query.js";
import { registerExecuteTool } from "./tools/execute.js";
import { registerDescribeTool } from "./tools/describe.js";
import { registerListTablesTool, registerListSchemasTool } from "./tools/list.js";
import { registerExplainTool } from "./tools/explain.js";
import { registerDdlTools } from "./tools/ddl.js";
import { registerTransactionTool } from "./tools/transaction.js";
import { registerAdminTool } from "./tools/admin.js";
import { registerConnectionInfoTool } from "./tools/connection_info.js";

// ─── 命令行参数解析（零依赖，不引入 commander） ──────────────

interface CliArgs {
  config?: string;
  jar?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  schema?: string;
  mode?: string;
  help?: boolean;
  version?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--config":
      case "-c":
        args.config = argv[++i];
        break;
      case "--jar":
        args.jar = argv[++i];
        break;
      case "--host":
        args.host = argv[++i];
        break;
      case "--port":
        args.port = parseInt(argv[++i], 10);
        break;
      case "--database":
      case "-d":
        args.database = argv[++i];
        break;
      case "--user":
      case "-u":
        args.username = argv[++i];
        break;
      case "--password":
      case "-p":
        args.password = argv[++i];
        break;
      case "--schema":
      case "-s":
        args.schema = argv[++i];
        break;
      case "--mode":
      case "-m":
        args.mode = argv[++i];
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--version":
      case "-v":
        args.version = true;
        break;
    }
  }
  return args;
}

function printHelp(): void {
  process.stderr.write(`
DM MCP Server — 达梦数据库 MCP 工具服务

用法:
  dm-mcp [选项]
  npx dm-mcp-server [选项]
  npx -y dm-mcp-server [选项]

选项:
  --config, -c <path>    配置文件路径（支持相对路径，相对于项目根目录）
                          不指定时自动在当前目录查找 dm-mcp-config.json
  --jar <path>           达梦 JDBC JAR 文件路径
  --host <host>          数据库主机地址（默认 127.0.0.1）
  --port <port>          数据库端口（默认 5236）
  --database, -d <name>  数据库名（默认 DAMENG）
  --user, -u <name>      用户名
  --password, -p <pass>  密码
  --schema, -s <name>    默认 Schema
  --mode, -m <mode>      权限模式: readonly | readwrite | ddl | admin
  --help, -h             显示帮助信息
  --version, -v          显示版本号

配置查找优先级:
  1. 命令行参数 --config 指定的路径
  2. 环境变量 DM_MCP_CONFIG 指向的路径
  3. 当前目录下的 dm-mcp-config.json

配置文件中的 jarPath/javaHome 支持相对路径（相对于配置文件所在目录）。

示例:
  # 使用项目根目录的配置文件（自动查找 dm-mcp-config.json）
  npx -y dm-mcp-server

  # 指定配置文件（相对路径）
  npx -y dm-mcp-server --config ./my-dm-config.json

  # 全部命令行参数
  npx -y dm-mcp-server --jar ./drivers/DmJdbcDriver18.jar --host 192.168.1.100 --user SYSDBA --password xxx

AI 工具接入（.mcp.json / mcp.json）:
  {
    "mcpServers": {
      "dm-database": {
        "command": "npx",
        "args": ["-y", "dm-mcp-server"],
        "env": { "JAVA_HOME": "/path/to/jdk/home" }
      }
    }
  }

`);
}

function printVersion(): void {
  process.stderr.write("dm-mcp-server v1.0.0\n");
}

// ─── 日志 ──────────────────────────────────────────────────────

function log(config: Config, level: "info" | "warn" | "error" | "debug", message: string) {
  const serverLevel = config.server?.logLevel ?? "info";
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[serverLevel]) {
    const timestamp = new Date().toISOString();
    const prefix = { debug: "DBG", info: "INF", warn: "WRN", error: "ERR" }[level];
    process.stderr.write(`[${timestamp}] [${prefix}] ${message}\n`);
  }
}

// ─── 主流程 ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (args.version) {
    printVersion();
    process.exit(0);
  }

  // ─── 1. 加载配置 ─────────────────────────────
  let config: Config;

  // 配置文件查找优先级：命令行 --config > 环境变量 DM_MCP_CONFIG > CWD/dm-mcp-config.json
  const cwd = process.cwd();
  const autoConfigCandidates = [
    path.join(cwd, "dm-mcp-config.json"),
    path.join(cwd, "config.json"),
  ];
  const autoConfig = autoConfigCandidates.find((p) => fs.existsSync(p));
  const configPath = args.config ?? process.env.DM_MCP_CONFIG ?? autoConfig ?? undefined;

  if (args.jar || args.host || args.username || args.password) {
    // 命令行参数模式：创建最小配置
    const cliConfig: Record<string, unknown> = {
      dm: {
        jarPath: args.jar,
        host: args.host ?? "127.0.0.1",
        port: args.port ?? 5236,
        database: args.database ?? "DAMENG",
        username: args.username,
        password: args.password,
        schema: args.schema,
      },
      permission: {
        mode: args.mode ?? "readonly",
      },
    };

    // 如果指定了配置文件，先加载它作为基础，再用命令行参数覆盖
    if (configPath) {
      try {
        const base = JSON.parse(fs.readFileSync(path.resolve(configPath), "utf-8"));
        // 深度合并 dm 字段
        const baseDm = base.dm ?? {};
        const basePerm = base.permission ?? {};
        (cliConfig.dm as Record<string, unknown>) = { ...baseDm, ...(cliConfig.dm as Record<string, unknown>) };
        (cliConfig.permission as Record<string, unknown>) = { ...basePerm, ...(cliConfig.permission as Record<string, unknown>) };
        if (base.server) cliConfig.server = base.server;
      } catch {
        // 配置文件不存在，纯用命令行参数
      }
    }

    const parsed = ConfigSchema.safeParse(cliConfig);
    if (!parsed.success) {
      const errors = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      process.stderr.write(`参数校验失败:\n${errors}\n`);
      process.exit(1);
    }
    config = parsed.data;
  } else if (configPath) {
    // 配置文件模式
    try {
      config = loadConfig(configPath);
    } catch (err) {
      process.stderr.write(`配置加载失败: ${(err as Error).message}\n`);
      process.stderr.write(`使用 --help 查看用法，或通过 --config 指定配置文件\n`);
      process.exit(1);
    }
  } else {
    process.stderr.write(
      `未找到配置文件。请在项目根目录创建 dm-mcp-config.json，或通过 --config 指定配置文件路径。\n` +
      `使用 --help 查看用法。\n`
    );
    process.exit(1);
  }

  const serverName = config.server?.name ?? "dm-mcp";
  const serverVersion = config.server?.version ?? "1.0.0";

  log(config, "info", `DM MCP Server v${serverVersion} 启动中...`);
  log(config, "info", `配置文件: ${configPath}`);
  log(config, "info", `JAR 路径: ${config.dm.jarPath}`);
  log(config, "info", `数据库: ${config.dm.host}:${config.dm.port}`);
  log(config, "info", `权限模式: ${config.permission.mode}`);

  // ─── 2. 加载 JDBC JAR ──────────────────────
  try {
    const resolvedJavaHome = config.dm.javaHome ?? process.env.JAVA_HOME ?? undefined;
    if (resolvedJavaHome) {
      log(config, "info", `JAVA_HOME: ${resolvedJavaHome}`);
    }
    log(config, "info", "正在加载达梦 JDBC JAR...");
    await DmConnection.loadJar(config.dm.jarPath, resolvedJavaHome);
    log(config, "info", "JDBC JAR 加载成功");
  } catch (err) {
    log(config, "error", `JAR 加载失败: ${(err as Error).message}`);
    process.exit(1);
  }

  // ─── 3. 建立数据库连接 ─────────────────────
  const db = new DmConnection();

  try {
    log(config, "info", "正在连接数据库...");
    await db.connect(config.dm);
    log(config, "info", "数据库连接成功");
  } catch (err) {
    log(config, "error", `数据库连接失败: ${(err as Error).message}`);
    process.exit(1);
  }

  // ─── 4. 初始化权限控制器 ──────────────────
  const permission = new PermissionController(
    config.permission.mode,
    config.permission
  );

  // ─── 5. 创建 MCP Server ────────────────────
  const server = new McpServer({
    name: serverName,
    version: serverVersion,
  });

  // ─── 6. 注册所有工具 ───────────────────────
  registerQueryTool(server, db, permission, config);
  registerExecuteTool(server, db, permission);
  registerDescribeTool(server, db, permission);
  registerListTablesTool(server, db, permission);
  registerListSchemasTool(server, db, permission);
  registerExplainTool(server, db, permission);
  registerDdlTools(server, db, permission);
  registerTransactionTool(server, db, permission);
  registerAdminTool(server, db, permission);
  registerConnectionInfoTool(server, db, permission, config);

  log(config, "info", "已注册 13 个 MCP 工具，等待客户端连接...");

  // ─── 7. 启动 Stdio 传输 ────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // ─── 8. 优雅退出 ───────────────────────────
  const shutdown = async (signal: string) => {
    log(config, "info", `收到 ${signal} 信号，正在关闭...`);
    try {
      await db.close();
      log(config, "info", "数据库连接已关闭");
    } catch {
      // 忽略关闭异常
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  process.stderr.write(`DM MCP Server 启动失败: ${(err as Error).message}\n`);
  process.exit(1);
});
