# Cursor MCP 配置

## 配置方法

### 方法一：通过 Cursor 设置界面

1. 打开 Cursor
2. 进入 Settings → MCP
3. 点击 "Add MCP Server"
4. 选择 "stdio" 类型
5. 填写：
   - **Name**: `dm-database`
   - **Command**: `node`
   - **Args**: `/absolute/path/to/dm-mcp-server/dist/index.js --config /absolute/path/to/config.json`
   - **Env**: `DM_MCP_CONFIG=/absolute/path/to/config.json`

### 方法二：手动编辑配置文件

在项目根目录创建 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "node",
      "args": ["/absolute/path/to/dm-mcp-server/dist/index.js", "--config", "/absolute/path/to/config.json"],
      "env": {
        "JAVA_HOME": "/path/to/jdk"
      }
    }
  }
}
```

### 方法三：全局配置

编辑 Cursor 全局配置文件 `~/.cursor/mcp.json`，格式同上。

### 方法四：全命令行参数

```json
{
  "mcpServers": {
    "dm-database": {
      "command": "node",
      "args": [
        "/absolute/path/to/dm-mcp-server/dist/index.js",
        "--jar", "/opt/dmdbms/drivers/jdbc/DmJdbcDriver18.jar",
        "--host", "192.168.1.100",
        "--port", "5236",
        "--user", "SYSDBA",
        "--password", "your_password",
        "--schema", "PROD",
        "--mode", "readwrite"
      ]
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

- Cursor 的 MCP 配置中，`args` 中的路径需要使用绝对路径
- 如果 Cursor 找不到 `node`，请使用完整路径如 `/usr/local/bin/node`
- 密码等敏感信息建议使用配置文件而非命令行参数
