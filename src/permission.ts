import type { PermissionConfig } from "./config.js";

export type PermissionMode = "readonly" | "readwrite" | "ddl" | "admin";

const LEVEL: Record<PermissionMode, number> = {
  readonly: 0,
  readwrite: 1,
  ddl: 2,
  admin: 3,
};

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export class PermissionController {
  private readonly level: number;

  constructor(
    private readonly mode: PermissionMode,
    private readonly config: PermissionConfig
  ) {
    this.level = LEVEL[mode];
  }

  /** 获取当前权限模式 */
  getMode(): PermissionMode {
    return this.mode;
  }

  /**
   * 检查 SQL 是否被当前权限允许
   * 不合法时抛出 PermissionError
   */
  checkSql(sql: string): void {
    const upper = sql.trim().toUpperCase();

    // 防止注释注入绕过关键字检测
    const cleaned = upper
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();

    // GRANT / REVOKE → admin
    if (/^\s*(GRANT|REVOKE)\b/.test(cleaned)) {
      this.require("admin", "权限管理操作 (GRANT/REVOKE)");
    }
    // CREATE USER / ALTER USER / DROP USER → admin
    else if (/^\s*(CREATE\s+USER|ALTER\s+USER|DROP\s+USER)\b/.test(cleaned)) {
      this.require("admin", "用户管理操作");
    }
    // EXEC / CALL 存储过程 → admin
    else if (/^\s*(EXEC|EXECUTE|CALL)\b/.test(cleaned)) {
      this.require("admin", "存储过程调用");
    }
    // DDL
    else if (/^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/.test(cleaned)) {
      this.require("ddl", "DDL 操作 (CREATE/ALTER/DROP/TRUNCATE)");
    }
    // DML 写操作
    else if (/^\s*(INSERT|UPDATE|DELETE|MERGE|REPLACE)\b/.test(cleaned)) {
      this.require("readwrite", "DML 写操作 (INSERT/UPDATE/DELETE)");
    }
    // SELECT / WITH / EXPLAIN / SET 等读取操作 → readonly 即可，不需要检查
  }

  /**
   * 检查表是否可访问
   */
  checkTableAccess(tableName: string): void {
    const upper = tableName.toUpperCase();

    // 黑名单检查
    const blocked = (this.config.blockedTables ?? []).map((t) =>
      t.toUpperCase()
    );
    if (blocked.includes(upper)) {
      throw new PermissionError(`表 [${tableName}] 已被封锁，禁止访问`);
    }

    // schema 白名单检查
    const allowed = this.config.allowedSchemas;
    if (allowed && allowed.length > 0 && upper.includes(".")) {
      const schema = upper.split(".")[0];
      const allowedUpper = allowed.map((s) => s.toUpperCase());
      if (!allowedUpper.includes(schema)) {
        throw new PermissionError(
          `Schema [${schema}] 不在允许列表中，允许的 schema: ${allowedUpper.join(", ")}`
        );
      }
    }
  }

  /**
   * 检查是否允许 EXPLAIN
   */
  checkExplain(): void {
    if (!this.config.enableExplain) {
      throw new PermissionError("EXPLAIN 功能已被禁用");
    }
  }

  /** 获取配置的最大返回行数 */
  getMaxResultRows(): number {
    return this.config.maxResultRows;
  }

  /** DDL 操作是否需要确认 */
  isConfirmRequiredForDDL(): boolean {
    return this.config.requireConfirmForDDL;
  }

  /** 公开的最低权限检查方法 */
  requireMin(minMode: PermissionMode): void {
    this.require(minMode, minMode + " 级别操作");
  }

  private require(minMode: PermissionMode, operation: string): void {
    if (this.level < LEVEL[minMode]) {
      throw new PermissionError(
        `当前权限级别 [${this.mode}] 不允许执行 ${operation}，需要 [${minMode}] 或更高权限`
      );
    }
  }
}
