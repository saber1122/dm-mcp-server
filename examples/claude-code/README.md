# Claude Code MCP 配置

## 方法一：使用 claude mcp add 命令（推荐）

```bash
# 项目级别（仅当前项目可用，自动在项目根目录查找 dm-mcp-config.json）
claude mcp add dm-mcp \
  --scope project \
  -e JAVA_HOME=/path/to/jdk/home \
  -- npx -y dm-mcp-server

# 全局（所有项目可用）
claude mcp add dm-mcp \
  --scope user \
  -e JAVA_HOME=/path/to/jdk/home \
  -- npx -y dm-mcp-server
```

> **说明**:
> - 不需要指定 `--config`，MCP Server 会自动在当前项目根目录查找 `dm-mcp-config.json`
> - `JAVA_HOME` 必须指向 JDK 根目录，**不要包含 `/bin`**
> - 如果已通过 `npm link` 全局安装，可以用 `dm-mcp-server` 替代 `npx -y dm-mcp-server`
> - 也可以在 `dm-mcp-config.json` 的 `dm.javaHome` 字段中配置，这样 `env` 中就不需要 `JAVA_HOME`

## 方法二：手动编辑 .mcp.json

在项目根目录创建 `.mcp.json`：

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

或者如果已经 `npm link`（本地开发）：

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "dm-mcp-server",
      "env": {
        "JAVA_HOME": "/path/to/jdk/home"
      }
    }
  }
}
```

## 指定自定义配置文件路径

如果配置文件不在项目根目录或文件名不同：

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

## 配置文件自动查找规则

不传 `--config` 时，MCP Server 按以下顺序查找配置文件：

1. 环境变量 `DM_MCP_CONFIG` 指定的路径
2. 当前目录（即项目根目录）下的 `dm-mcp-config.json`
3. 当前目录下的 `config.json`

配置文件中的 `jarPath` 和 `javaHome` 支持相对路径（相对于配置文件所在目录）。

## 验证连接

```bash
# 查看 Claude Code 中已添加的 MCP Server
claude mcp list

# 在 Claude Code 中测试
# 直接对话: "帮我查询一下 dm_test 表的结构"
# Claude Code 会自动调用 dm_describe 工具
```
