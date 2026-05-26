import * as fs from "fs";
import * as path from "path";
import javaBridge from "java-bridge";
const { ensureJvm, importClass, appendClasspath } = javaBridge;
import type { DmConfig } from "../config.js";
import { buildJdbcUrl } from "../config.js";

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  durationMs: number;
}

export interface ExecuteResult {
  affectedRows: number;
  durationMs: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  typeName: string;
  nullable: boolean;
  defaultValue: string | null;
  comment: string;
  precision: number;
  scale: number;
}

export interface TableInfo {
  tableName: string;
  schema: string;
  type: "TABLE" | "VIEW" | "SYSTEM TABLE";
  comment: string;
}

export interface IndexInfo {
  indexName: string;
  columns: string[];
  unique: boolean;
}

export class DmConnection {
  private static jvmLoaded = false;
  private static jvmClasspathAppended = false;

  private conn: any = null;
  private autoCommitFlag = true;

  /**
   * 加载达梦 JDBC JAR 到 JVM classpath
   * @param jarPath JAR 文件路径
   * @param javaHome 可选的 JAVA_HOME 路径
   */
  static async loadJar(jarPath: string, javaHome?: string): Promise<void> {
    if (this.jvmLoaded) return;

    const absPath = path.resolve(jarPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(
        `达梦 JDBC JAR 文件不存在: ${absPath}\n` +
        `请确认 jarPath 配置正确，通常路径类似:\n` +
        `  /opt/dmdbms/drivers/jdbc/DmJdbcDriver18.jar\n` +
        `  C:\\dmdbms\\drivers\\jdbc\\DmJdbcDriver18.jar`
      );
    }

    // 如果指定了 JAVA_HOME，设置 JVM 选项（必须在首次 ensureJvm 之前）
    if (javaHome) {
      ensureJvm({ opts: [`-Djava.home=${javaHome}`] });
    }

    // 添加 JAR 到 classpath（同步方法）
    if (!this.jvmClasspathAppended) {
      appendClasspath(absPath);
      this.jvmClasspathAppended = true;
    }

    // 预加载驱动类触发注册
    try {
      importClass("dm.jdbc.driver.DmDriver");
    } catch (e) {
      throw new Error(
        `加载达梦 JDBC 驱动失败: ${(e as Error).message}\n` +
        `请确认 JAR 文件是达梦官方版本 (DmJdbcDriver18.jar)`
      );
    }

    this.jvmLoaded = true;
  }

  /**
   * 建立数据库连接
   */
  async connect(config: DmConfig): Promise<void> {
    const DriverManager = importClass("java.sql.DriverManager");
    const Properties = importClass("java.util.Properties");

    const jdbcUrl = buildJdbcUrl(config);

    // 使用 importClass 返回的构造函数创建实例
    const props = new Properties();
    props.setPropertySync("user", config.username);
    props.setPropertySync("password", config.password);
    if (config.schema) {
      props.setPropertySync("schema", config.schema);
    }

    this.conn = await DriverManager.getConnection(jdbcUrl, props);
    this.autoCommitFlag = true;

    // 如果配置了 schema，执行 SET SCHEMA
    if (config.schema) {
      try {
        const stmt = await this.conn.createStatement();
        await stmt.execute(`SET SCHEMA "${config.schema}"`);
        await stmt.close();
      } catch {
        // SET SCHEMA 可能失败，忽略
      }
    }
  }

  /**
   * 执行 SELECT 查询
   */
  async query(sql: string): Promise<QueryResult> {
    this.ensureConnected();
    const start = Date.now();

    const stmt = await this.conn.createStatement();
    try {
      const rs = await stmt.executeQuery(sql);
      const meta = await rs.getMetaData();
      const colCount = await meta.getColumnCount();

      const columns: string[] = [];
      for (let i = 1; i <= colCount; i++) {
        columns.push(await meta.getColumnLabel(i));
      }

      const rows: any[][] = [];
      while (await rs.next()) {
        const row: any[] = [];
        for (let i = 1; i <= colCount; i++) {
          const val = await rs.getObject(i);
          // 将 Java 对象转为 JS 原生类型
          if (val === null || val === undefined) {
            row.push(null);
          } else if (typeof val === "object" && val.getTime) {
            // java.sql.Timestamp / Date
            row.push(val.getTime());
          } else if (typeof val === "object" && val.length !== undefined) {
            // byte[] / BLOB
            row.push(`[BLOB ${val.length} bytes]`);
          } else {
            row.push(String(val));
          }
        }
        rows.push(row);
      }

      await rs.close();
      return {
        columns,
        rows,
        rowCount: rows.length,
        durationMs: Date.now() - start,
      };
    } finally {
      await stmt.close();
    }
  }

  /**
   * 执行 DML / DDL
   */
  async execute(sql: string): Promise<ExecuteResult> {
    this.ensureConnected();
    const start = Date.now();

    const stmt = await this.conn.createStatement();
    try {
      const affected = await stmt.executeUpdate(sql);
      return {
        affectedRows: Number(affected),
        durationMs: Date.now() - start,
      };
    } finally {
      await stmt.close();
    }
  }

  /**
   * 执行带参数的 SQL（PreparedStatement）
   */
  async executePrepared(
    sql: string,
    params: any[]
  ): Promise<ExecuteResult> {
    this.ensureConnected();
    const start = Date.now();

    const ps = await this.conn.prepareStatement(sql);
    try {
      for (let i = 0; i < params.length; i++) {
        await ps.setObject(i + 1, params[i]);
      }
      const affected = await ps.executeUpdate();
      return {
        affectedRows: Number(affected),
        durationMs: Date.now() - start,
      };
    } finally {
      await ps.close();
    }
  }

  // ─── 元数据查询 ───────────────────────────────────────

  /**
   * 获取表结构信息
   */
  async describeTable(
    tableName: string
  ): Promise<{ columns: ColumnInfo[]; indexes: IndexInfo[] }> {
    this.ensureConnected();
    const [schema, table] = this.parseTableName(tableName);

    // 查询列信息
    const colSql = `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        TYPE_NAME,
        NULLABLE,
        DATA_DEFAULT,
        COMMENTS,
        DATA_PRECISION,
        DATA_SCALE
      FROM ALL_TAB_COLUMNS
      WHERE OWNER = '${schema}'
        AND TABLE_NAME = '${table}'
      ORDER BY COLUMN_ID
    `;
    const colResult = await this.query(colSql);
    const columns: ColumnInfo[] = colResult.rows.map((row) => ({
      name: String(row[0] ?? ""),
      type: String(row[1] ?? ""),
      typeName: String(row[2] ?? ""),
      nullable: row[3] === "Y",
      defaultValue: row[4] ? String(row[4]) : null,
      comment: String(row[5] ?? ""),
      precision: Number(row[6]) || 0,
      scale: Number(row[7]) || 0,
    }));

    // 查询索引信息
    const idxSql = `
      SELECT
        i.INDEX_NAME,
        ic.COLUMN_NAME,
        i.UNIQUENESS
      FROM ALL_INDEXES i
      JOIN ALL_IND_COLUMNS ic ON i.INDEX_NAME = ic.INDEX_NAME AND i.OWNER = ic.INDEX_OWNER
      WHERE i.OWNER = '${schema}'
        AND i.TABLE_NAME = '${table}'
      ORDER BY i.INDEX_NAME, ic.COLUMN_POSITION
    `;
    const idxResult = await this.query(idxSql);

    const indexMap = new Map<string, IndexInfo>();
    for (const row of idxResult.rows) {
      const idxName = String(row[0]);
      if (!indexMap.has(idxName)) {
        indexMap.set(idxName, {
          indexName: idxName,
          columns: [],
          unique: String(row[2]) === "UNIQUE",
        });
      }
      indexMap.get(idxName)!.columns.push(String(row[1]));
    }

    return {
      columns,
      indexes: Array.from(indexMap.values()),
    };
  }

  /**
   * 列举表
   */
  async listTables(
    options?: {
      schema?: string;
      pattern?: string;
      type?: "TABLE" | "VIEW" | "ALL";
    }
  ): Promise<TableInfo[]> {
    this.ensureConnected();
    const schema = options?.schema;
    const pattern = options?.pattern ? options.pattern.toUpperCase() : "%";
    const type = options?.type ?? "ALL";

    const typeCondition =
      type === "ALL"
        ? "TABLE_TYPE IN ('TABLE', 'VIEW')"
        : `TABLE_TYPE = '${type}'`;

    const schemaCondition = schema
      ? `OWNER = '${schema.toUpperCase()}'`
      : "1=1";

    const sql = `
      SELECT
        TABLE_NAME,
        OWNER,
        TABLE_TYPE,
        NVL(COMMENTS, '') AS COMMENTS
      FROM ALL_TABLES at
      LEFT JOIN ALL_TAB_COMMENTS tc
        ON at.OWNER = tc.OWNER AND at.TABLE_NAME = tc.TABLE_NAME
      WHERE ${schemaCondition}
        AND ${typeCondition}
        AND at.TABLE_NAME LIKE '${pattern.replace(/'/g, "''")}'
      ORDER BY OWNER, TABLE_NAME
    `;

    const result = await this.query(sql);
    return result.rows.map((row) => ({
      tableName: String(row[0]),
      schema: String(row[1]),
      type: (String(row[2]) as "TABLE" | "VIEW") || "TABLE",
      comment: String(row[3]),
    }));
  }

  /**
   * 列举 schema
   */
  async listSchemas(): Promise<string[]> {
    this.ensureConnected();
    const sql = `
      SELECT DISTINCT USERNAME
      FROM ALL_USERS
      WHERE USERNAME NOT IN (
        'SYS', 'SYSSSO', 'SYSDBA', 'SYSAUDITOR', 'SYSVSO'
      )
      ORDER BY USERNAME
    `;
    const result = await this.query(sql);
    return result.rows.map((row) => String(row[0]));
  }

  // ─── 事务控制 ─────────────────────────────────────────

  async beginTransaction(): Promise<void> {
    this.ensureConnected();
    await this.conn.setAutoCommit(false);
    this.autoCommitFlag = false;
  }

  async commit(): Promise<void> {
    this.ensureConnected();
    await this.conn.commit();
    await this.conn.setAutoCommit(true);
    this.autoCommitFlag = true;
  }

  async rollback(): Promise<void> {
    this.ensureConnected();
    await this.conn.rollback();
    await this.conn.setAutoCommit(true);
    this.autoCommitFlag = true;
  }

  setAutoCommit(autoCommit: boolean): void {
    this.autoCommitFlag = autoCommit;
  }

  getAutoCommit(): boolean {
    return this.autoCommitFlag;
  }

  // ─── 连接管理 ─────────────────────────────────────────

  async close(): Promise<void> {
    if (this.conn) {
      try {
        await this.conn.close();
      } catch {
        // 忽略关闭异常
      }
      this.conn = null;
    }
  }

  isConnected(): boolean {
    return this.conn !== null;
  }

  private ensureConnected(): void {
    if (!this.conn) {
      throw new Error("数据库连接未建立，请先调用 connect()");
    }
  }

  private parseTableName(
    tableName: string
  ): [schema: string, table: string] {
    const upper = tableName.toUpperCase();
    if (upper.includes(".")) {
      const parts = upper.split(".");
      return [parts[0], parts.slice(1).join(".")];
    }
    // 无 schema 时查询当前用户
    return ["USER", upper];
  }
}
