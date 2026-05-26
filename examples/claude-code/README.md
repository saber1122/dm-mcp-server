# Claude Code MCP 配置

## 方法一：使用 claude mcp add 命令（推荐）

```bash
# 添加 MCP Server（当前项目级别）
claude mcp add dm-mcp \
  --scope project \
  -- node /absolute/path/to/dm-mcp-server/dist/index.js \
  --config /absolute/path/to/config.json

# 添加 MCP Server（全局，所有项目可用）
claude mcp add dm-mcp \
  --scope user \
  -- node /absolute/path/to/dm-mcp-server/dist/index.js \
  --config /absolute/path/to/config.json

# 带环境变量
claude mcp add dm-mcp \
  --scope user \
  -e DM_MCP_CONFIG=/path/to/config.json \
  -e JAVA_HOME=/path/to/jdk \
  -- node /absolute/path/to/dm-mcp-server/dist/index.js
```

## 方法二：手动编辑配置文件

### 项目级别配置
在项目根目录创建 `.claude/settings.json`：

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

### 全局配置
编辑 `~/.claude/settings.json`，格式同上。

## 方法三：全命令行参数（无需配置文件）

```bash
claude mcp add dm-mcp \
  --scope user \
  -- node /absolute/path/to/dm-mcp-server/dist/index.js \
  --jar /opt/dmdbms/drivers/jdbc/DmJdbcDriver18.jar \
  --host 192.168.1.100 \
  --port 5236 \
  --user SYSDBA \
  --password 'your_password' \
  --schema PROD \
  --mode readwrite
```

## 验证连接

```bash
# 查看 Claude Code 中已添加的 MCP Server
claude mcp list

# 在 Claude Code 中测试
# 直接对话: "帮我查询一下 dm_test 表的结构"
# Claude Code 会自动调用 dm_describe 工具
```
