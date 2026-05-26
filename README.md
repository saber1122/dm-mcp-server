# DM MCP Server

达梦数据库 MCP Server，基于达梦官方 JDBC JAR 包。支持 **Claude Code、Cursor、VS Code (Copilot)、Windsurf** 等主流 AI 编程工具。

## 特性

- 标准 MCP 协议 (`@modelcontextprotocol/sdk`)，`stdio` 传输，兼容所有 MCP 客户端
- 通过 `java-bridge` 动态加载达梦 JDBC JAR，无需预装 Java 环境依赖
- `jdbcParams` 支持任意 JDBC 连接参数（`compatibleMode=mysql` 等）
- 四级权限模型：`readonly` → `readwrite` → `ddl` → `admin`
- 13 个 MCP 工具覆盖查询、DML、DDL、元数据、事务、诊断
- **自动查找项目根目录的 `dm-mcp-config.json`**，配置极简

## 快速开始

### 1. 安装

```bash
# 方式一：从 npm 安装（发布后）
npm install -g dm-mcp-server

# 方式二：本地开发
cd dm-mcp-server
npm install
npm run build
npm link
```

### 2. 创建配置文件

在**项目根目录** `.claude/config.json` 中配置（Claude Code 推荐方式）：

```json
{
  "dm": {
    "jarPath": "./drivers/DmJdbcDriver18.jar",
    "javaHome": "/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home",
    "host": "192.168.1.100",
    "port": 5236,
    "database": "DAMENG",
    "username": "SYSDBA",
    "password": "your_password",
    "schema": "PROD",
    "jdbcParams": {
      "compatibleMode": "mysql",
      "characterEncoding": "UTF-8"
    }
  },
  "permission": {
    "mode": "readonly"
  }
}
```

> `jarPath` 和 `javaHome` 支持**相对路径**（相对于配置文件所在目录），也支持绝对路径。

**必填字段**：

| 字段 | 说明 |
|------|------|
| `dm.jarPath` | 达梦 JDBC JAR 文件路径 |
| `dm.host` | 数据库地址 |
| `dm.port` | 端口号，默认 `5236` |
| `dm.username` | 用户名 |
| `dm.password` | 密码 |
| `permission.mode` | 权限模式：`readonly` / `readwrite` / `ddl` / `admin` |

### 3. 接入 AI 编程工具

**最简配置 — 所有工具通用**：

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "npx",
      "args": ["-y", "dm-mcp-server"],
      "env": {
        "JAVA_HOME": "/path/to/jdk/home"
      }
    }
  }
}
```

> 不需要指定配置文件路径！MCP Server 会自动在 `.claude/` 目录下查找配置文件。
> `JAVA_HOME` 也可以写在配置文件的 `dm.javaHome` 字段中。

---

## Claude Code 接入

### 最简方式（推荐）

```bash
# 项目级别
claude mcp add dm-mcp \
  --scope project \
  -e JAVA_HOME=/path/to/jdk/home \
  -- npx -y dm-mcp-server

# 全局（所有项目）
claude mcp add dm-mcp \
  --scope user \
  -e JAVA_HOME=/path/to/jdk/home \
  -- npx -y dm-mcp-server
```

### 项目 `.mcp.json`

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "npx",
      "args": ["-y", "dm-mcp-server"],
      "env": {
        "JAVA_HOME": "/path/to/jdk/home"
      }
    }
  }
}
```

### 自定义配置文件路径

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "npx",
      "args": ["-y", "dm-mcp-server", "--config", "./my-config.json"],
      "env": {
        "JAVA_HOME": "/path/to/jdk/home"
      }
    }
  }
}
```

详细说明见 [examples/claude-code/](examples/claude-code/)

---

## Cursor 接入

项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "npx",
      "args": ["-y", "dm-mcp-server"],
      "env": {
        "JAVA_HOME": "/path/to/jdk/home"
      }
    }
  }
}
```

详细说明见 [examples/cursor/](examples/cursor/)

---

## VS Code (GitHub Copilot) 接入

编辑 VS Code `settings.json`（`Cmd+,` → 搜索 `mcp`）：

```json
{
  "mcp": {
    "servers": {
      "dm-database": {
        "command": "npx",
        "args": ["-y", "dm-mcp-server"],
        "env": {
          "JAVA_HOME": "/path/to/jdk/home"
        }
      }
    }
  }
}
```

详细说明见 [examples/vscode/](examples/vscode/)

---

## Windsurf 接入

项目根目录创建 `.windsurf/mcp.json`：

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "npx",
      "args": ["-y", "dm-mcp-server"],
      "env": {
        "JAVA_HOME": "/path/to/jdk/home"
      }
    }
  }
}
```

---

## 配置查找规则

不传 `--config` 时，MCP Server 按以下顺序查找配置文件：

1. 命令行参数 `--config` 指定的路径
2. 环境变量 `DM_MCP_CONFIG` 指定的路径
3. `.claude/dm-mcp-config.json`
4. `.claude/config.json`
5. 当前目录 `dm-mcp-config.json`
6. 当前目录 `config.json`

配置文件中的 `jarPath` 和 `javaHome` 支持相对路径（相对于配置文件所在目录）。

---

## 全命令行模式（无需配置文件）

适合不想创建配置文件的场景：

```bash
claude mcp add dm-mcp -- \
  npx -y dm-mcp-server \
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
| `--config` | `-c` | 配置文件路径（支持相对路径） |
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
│   ├── config.ts             # 配置 schema (zod) + 相对路径解析
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
