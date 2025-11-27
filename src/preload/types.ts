import type { OpenDialogReturnValue } from 'electron';
import type { RenameRule } from '@shared/types/file-rename';
import type { ImageDeduplicationResult } from '@shared/types/image-deduplication';
import type { VideoDeduplicationResult } from '@shared/types/video-deduplication';
import type { ToolResult } from '@shared/types/common';
import type { ElectronAPI } from '@electron-toolkit/preload';

export interface ImageDeduplicationOptions {
  sourceDir: string;
  similarityThreshold?: number;
  autoDelete?: boolean;
}

export interface VideoDeduplicationOptions {
  sourceDir: string;
  similarityThreshold?: number;
  autoDelete?: boolean;
}

export interface ImageOptimizeOptions {
  sourceDir: string;
  outputDir?: string;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp';
  keepOriginal?: boolean;
}

export interface FileRenameOptions {
  directory: string;
  rules: RenameRule[];
  dryRun?: boolean;
}

export interface TwitterDownloadOptions {
  username: string;
  cookies: string;
  downloadPath?: string;
  includeRetweets?: boolean;
}

export interface TelegramDownloadOptions {
  apiId: string;
  apiHash: string;
  url: string;
  outputPath?: string;
  maxPages?: string;
}

export interface VideoConverterOptions {
  sourceDir: string;
  outputFormat: 'mp4' | 'avi' | 'mov';
  outputDir?: string;
}

export interface StoreResult {
  success: boolean;
  value?: unknown;
  error?: string;
}

export interface API {
  // 对话框
  openFile: () => Promise<OpenDialogReturnValue>;
  openDirectory: () => Promise<OpenDialogReturnValue>;
  getDownloadsPath: () => Promise<string>;

  // 图片查重
  imageDeduplication: (options: ImageDeduplicationOptions) => Promise<ImageDeduplicationResult>;
  onImageDeduplicationProgress: (callback: (message: string) => void) => () => void;

  // 视频查重
  videoDeduplication: (options: VideoDeduplicationOptions) => Promise<VideoDeduplicationResult>;
  onVideoDeduplicationProgress: (callback: (message: string) => void) => () => void;

  // 视频格式转换
  videoConverter: (options: VideoConverterOptions) => Promise<ToolResult>;
  onVideoConverterProgress: (callback: (message: string) => void) => () => void;

  // 图片压缩
  imageOptimize: (options: ImageOptimizeOptions) => Promise<ToolResult>;
  onImageOptimizeProgress: (callback: (message: string) => void) => () => void;

  // 文件重命名
  fileRename: (options: FileRenameOptions) => Promise<ToolResult>;
  onFileRenameProgress: (callback: (message: string) => void) => () => void;

  // Twitter 下载
  twitterDownload: (options: TwitterDownloadOptions) => Promise<ToolResult>;
  onTwitterDownloadProgress: (callback: (message: string) => void) => () => void;

  // Telegram 下载
  telegramDownload: (options: TelegramDownloadOptions) => Promise<ToolResult>;
  onTelegramDownloadProgress: (callback: (message: string) => void) => () => void;

  // 用户输入
  onUserInputRequired: (callback: (prompt: string, source: string) => void) => () => void;
  userInputResponse: (input: string | null) => Promise<ToolResult>;

  // 配置存储
  storeSet: (key: string, value: unknown) => Promise<StoreResult>;
  storeGet: (key: string) => Promise<StoreResult>;
  storeDelete: (key: string) => Promise<StoreResult>;
  storeClear: () => Promise<StoreResult>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: API;
  }
}
