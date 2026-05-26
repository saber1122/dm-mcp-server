# Cursor MCP 配置

## 方法一：通过 Cursor 设置界面

1. 打开 Cursor
2. 进入 Settings → MCP
3. 点击 "Add MCP Server"
4. 选择 "stdio" 类型
5. 填写：
   - **Name**: `dm-database`
   - **Command**: `npx`
   - **Args**: `-y dm-mcp-server`
   - **Env**: `JAVA_HOME=/path/to/jdk/home`

## 方法二：手动编辑配置文件

在项目根目录创建 `.cursor/mcp.json`：

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

MCP Server 会自动在项目根目录查找 `dm-mcp-config.json`。

## 全局配置

编辑 Cursor 全局配置文件 `~/.cursor/mcp.json`，格式同上。

## 指定自定义配置文件

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

## 使用提示

配置完成后重启 Cursor，然后在 Agent 模式中：

- "帮我查询一下 users 表的前 10 条数据" → 自动调用 `dm_query`
- "查看 orders 表结构" → 自动调用 `dm_describe`
- "列出所有 schema" → 自动调用 `dm_list_schemas`
- "创建一个新表..." → 需要 `ddl` 权限，调用 `dm_create_table`

## 注意事项

- 如果已通过 `npm link` 全局安装，可以用 `dm-mcp-server` 替代 `npx -y dm-mcp-server`
- 也可以在 `dm-mcp-config.json` 的 `dm.javaHome` 字段中配置 JAVA_HOME
- 密码等敏感信息请使用配置文件而非命令行参数
