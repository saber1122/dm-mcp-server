# DM MCP Server

达梦数据库 MCP Server，基于达梦官方 JDBC JAR 包。支持 **Claude Code、Cursor、VS Code (Copilot)、Windsurf** 等主流 AI 编程工具。

## 特性

- 标准 MCP 协议 (`@modelcontextprotocol/sdk`)，`stdio` 传输，兼容所有 MCP 客户端
- 通过 `java-bridge` 动态加载达梦 JDBC JAR，无需预装 Java 环境依赖
- `jdbcParams` 支持任意 JDBC 连接参数（`compatibleMode=mysql` 等）
- 四级权限模型：`readonly` → `readwrite` → `ddl` → `admin`
- 13 个 MCP 工具覆盖查询、DML、DDL、元数据、事务、诊断
- 支持 `--config` 配置文件 + 命令行参数双通道，灵活接入各 AI 工具

## 快速开始

### 1. 安装

```bash
cd dm-mcp-server
npm install
npm run build
```

### 2. 配置

```bash
cp config.example.json config.json
# 编辑 config.json，填入你的数据库连接信息和 JAR 路径
```

**必须修改的字段**：

| 字段 | 说明 |
|------|------|
| `dm.jarPath` | 达梦 JDBC JAR 文件的绝对路径，如 `/opt/dmdbms/drivers/jdbc/DmJdbcDriver18.jar` |
| `dm.host` | 数据库地址 |
| `dm.port` | 端口号，默认 `5236` |
| `dm.username` | 用户名 |
| `dm.password` | 密码 |
| `permission.mode` | 权限模式：`readonly` / `readwrite` / `ddl` / `admin` |

### 3. 接入 AI 编程工具

> 将下面的路径替换为你实际的绝对路径。

---

## Claude Code 接入

### 方法一：`claude mcp add` 命令（推荐）

```bash
# 项目级别（仅当前项目可用）
claude mcp add dm-mcp \
  -- node /path/to/dm-mcp-server/dist/index.js \
  --config /path/to/config.json

# 全局（所有项目可用）
claude mcp add dm-mcp \
  --scope user \
  -- node /path/to/dm-mcp-server/dist/index.js \
  --config /path/to/config.json
```

### 方法二：手动编辑配置文件

项目根目录创建 `.claude/settings.json`：

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "node",
      "args": ["/path/to/dm-mcp-server/dist/index.js", "--config", "/path/to/config.json"],
      "env": {
        "JAVA_HOME": "/path/to/jdk"
      }
    }
  }
}
```

### 验证

```bash
claude mcp list
# 然后在 Claude Code 中对话: "查看 dm_test 表结构"
```

详细说明见 [examples/claude-code/](examples/claude-code/)

---

## Cursor 接入

在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "node",
      "args": ["/path/to/dm-mcp-server/dist/index.js", "--config", "/path/to/config.json"],
      "env": {
        "JAVA_HOME": "/path/to/jdk"
      }
    }
  }
}
```

或通过 Cursor Settings → MCP 界面添加。

详细说明见 [examples/cursor/](examples/cursor/)

---

## VS Code (GitHub Copilot) 接入

编辑 VS Code `settings.json`（`Cmd+,` → 搜索 `mcp`）：

```json
{
  "mcp": {
    "servers": {
      "dm-database": {
        "command": "node",
        "args": ["/path/to/dm-mcp-server/dist/index.js", "--config", "/path/to/config.json"],
        "env": {
          "JAVA_HOME": "/path/to/jdk"
        }
      }
    }
  }
}
```

详细说明见 [examples/vscode/](examples/vscode/)

---

## Windsurf 接入

在项目根目录创建 `.windsurf/mcp.json`：

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "node",
      "args": ["/path/to/dm-mcp-server/dist/index.js", "--config", "/path/to/config.json"],
      "env": {
        "JAVA_HOME": "/path/to/jdk"
      }
    }
  }
}
```

---

## 全命令行模式（无需配置文件）

适合不想创建配置文件的场景，所有参数通过命令行传入：

```bash
claude mcp add dm-mcp -- \
  node /path/to/dm-mcp-server/dist/index.js \
  --jar /opt/dmdbms/drivers/jdbc/DmJdbcDriver18.jar \
  --host 192.168.1.100 \
  --port 5236 \
  --user SYSDBA \
  --password 'your_password' \
  --schema PROD \
  --mode readwrite
```

### 命令行参数

| 参数 | 缩写 | 说明 |
|------|------|------|
| `--config` | `-c` | 配置文件路径 |
| `--jar` | | JDBC JAR 文件路径 |
| `--host` | | 数据库主机 |
| `--port` | | 端口号 |
| `--database` | `-d` | 数据库名 |
| `--user` | `-u` | 用户名 |
| `--password` | `-p` | 密码 |
| `--schema` | `-s` | 默认 Schema |
| `--mode` | `-m` | 权限模式 |

---

## 工具清单

| 工具 | 权限 | 说明 |
|------|------|------|
| `dm_query` | readonly+ | 执行 SELECT，自动限制行数 |
| `dm_execute` | readwrite+ | 执行 DML（INSERT/UPDATE/DELETE） |
| `dm_execute_prepared` | readwrite+ | 参数化执行（防 SQL 注入） |
| `dm_describe` | readonly+ | 查询表结构（字段、类型、索引） |
| `dm_list_tables` | readonly+ | 列举表/视图，支持模糊匹配 |
| `dm_list_schemas` | readonly+ | 列举所有 schema |
| `dm_explain` | readonly+ | SQL 执行计划分析 |
| `dm_create_table` | ddl+ | 建表（自动注入 IF NOT EXISTS） |
| `dm_drop_table` | ddl+ | 删表（需二次确认） |
| `dm_ddl_execute` | ddl+ | 执行其他 DDL |
| `dm_transaction` | readwrite+ | 事务控制（begin/commit/rollback） |
| `dm_admin_execute` | admin | GRANT/REVOKE/存储过程 |
| `dm_connection_info` | readonly+ | 连接诊断信息 |

---

## JDBC 参数说明

通过 `jdbcParams` 配置任意 JDBC 连接参数：

```json
{
  "jdbcParams": {
    "compatibleMode": "mysql",
    "characterEncoding": "UTF-8",
    "useUnicode": "true",
    "useSSL": "false",
    "tinyInt1isBit": "false",
    "serverTimezone": "Asia/Shanghai",
    "clobAsString": "true"
  }
}
```

| 参数 | 说明 |
|------|------|
| `compatibleMode` | 兼容模式：`mysql` / `oracle` |
| `characterEncoding` | 字符集：`UTF-8` |
| `useUnicode` | 启用 Unicode：`true` |
| `useSSL` | 启用 SSL：`false` |
| `tinyInt1isBit` | TINYINT(1) 映射为 BIT：`false`（保持数字） |
| `serverTimezone` | 时区：`Asia/Shanghai` |
| `clobAsString` | CLOB 返回字符串：`true` |

---

## 权限模型

```
admin（最高）
  └── ddl
        └── readwrite
              └── readonly（最低）
```

权限递进继承。配置 `"mode": "readonly"` 时，所有 DML/DDL 操作会被拦截。

额外控制：
- `allowedSchemas` — 白名单，仅允许访问指定 Schema
- `blockedTables` — 黑名单，禁止访问指定表
- `maxResultRows` — SELECT 最大返回行数
- `requireConfirmForDDL` — DDL 操作是否需要二次确认表名

---

## 项目结构

```
dm-mcp-server/
├── src/
│   ├── index.ts              # 入口 + CLI 参数解析
│   ├── config.ts             # 配置 schema (zod)
│   ├── permission.ts         # 四级权限控制器
│   ├── db/
│   │   └── connection.ts     # JDBC 连接 (java-bridge)
│   └── tools/
│       ├── query.ts          # dm_query
│       ├── execute.ts        # dm_execute / dm_execute_prepared
│       ├── describe.ts       # dm_describe
│       ├── list.ts           # dm_list_tables / dm_list_schemas
│       ├── explain.ts        # dm_explain
│       ├── ddl.ts            # dm_create_table / dm_drop_table / dm_ddl_execute
│       ├── transaction.ts    # dm_transaction
│       ├── admin.ts          # dm_admin_execute
│       └── connection_info.ts # dm_connection_info
├── examples/                 # 各 AI 工具配置示例
│   ├── claude-code/
│   ├── cursor/
│   ├── vscode/
│   └── windsurf/
├── config.example.json       # 配置模板
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
