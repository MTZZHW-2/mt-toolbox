/**
 * 文件重命名相关类型定义
 * 在前端、后端和 preload 之间共享
 */

export type RenameMode = 'prefix' | 'suffix' | 'number' | 'replace';

export interface RenameRule {
  id: string;
  type: RenameMode;
  enabled: boolean;
  config: {
    prefix?: string;
    suffix?: string;
    startNumber?: number;
    padLength?: number;
    pattern?: string;
    replacement?: string;
    ignoreExtension?: boolean;
  };
}
