/**
 * 日志
 */
export interface LogEntry {
  id: string;
  message: string;
}

/**
 * 工具函数的基础返回结果
 */
export type ToolResult =
  | {
      success: true;
      summary?: string;
      error?: never;
    }
  | {
      success: false;
      summary?: never;
      error: string;
    };
