import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type {
  ImageDeduplicationOptions,
  VideoDeduplicationOptions,
  VideoConverterOptions,
  ImageOptimizeOptions,
  FileRenameOptions,
  TwitterDownloadOptions,
  TelegramDownloadOptions,
  API,
} from './types';

// 渲染进程的自定义 API
export const api: API = {
  // 对话框
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
  getDownloadsPath: () => ipcRenderer.invoke('app:get-downloads-path'),

  // 图片查重
  imageDeduplication: (options: ImageDeduplicationOptions) =>
    ipcRenderer.invoke('image-deduplication:execute', options),
  onImageDeduplicationProgress: (callback: (message: string) => void) => {
    ipcRenderer.on('image-deduplication:progress', (_event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('image-deduplication:progress');
  },

  // 视频查重
  videoDeduplication: (options: VideoDeduplicationOptions) =>
    ipcRenderer.invoke('video-deduplication:execute', options),
  onVideoDeduplicationProgress: (callback: (message: string) => void) => {
    ipcRenderer.on('video-deduplication:progress', (_event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('video-deduplication:progress');
  },

  // 视频格式转换
  videoConverter: (options: VideoConverterOptions) => ipcRenderer.invoke('video-converter:execute', options),
  onVideoConverterProgress: (callback: (message: string) => void) => {
    ipcRenderer.on('video-converter:progress', (_event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('video-converter:progress');
  },

  // 图片压缩
  imageOptimize: (options: ImageOptimizeOptions) => ipcRenderer.invoke('image-optimize:execute', options),
  onImageOptimizeProgress: (callback: (message: string) => void) => {
    ipcRenderer.on('image-optimize:progress', (_event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('image-optimize:progress');
  },

  // 文件重命名
  fileRename: (options: FileRenameOptions) => ipcRenderer.invoke('file-rename:execute', options),
  onFileRenameProgress: (callback: (message: string) => void) => {
    ipcRenderer.on('file-rename:progress', (_event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('file-rename:progress');
  },

  // Twitter 下载
  twitterDownload: (options: TwitterDownloadOptions) => ipcRenderer.invoke('twitter-download:execute', options),
  onTwitterDownloadProgress: (callback: (message: string) => void) => {
    ipcRenderer.on('twitter-download:progress', (_event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('twitter-download:progress');
  },

  // Telegram 下载
  telegramDownload: (options: TelegramDownloadOptions) => ipcRenderer.invoke('telegram-download:execute', options),
  onTelegramDownloadProgress: (callback: (message: string) => void) => {
    ipcRenderer.on('telegram-download:progress', (_event, message) => callback(message));
    return () => ipcRenderer.removeAllListeners('telegram-download:progress');
  },

  // 通用用户输入（可用于任何需要交互的功能）
  onUserInputRequired: (callback: (prompt: string, source: string) => void) => {
    ipcRenderer.on('user-input:required', (_event, prompt, source) => callback(prompt, source));
    return () => ipcRenderer.removeAllListeners('user-input:required');
  },
  userInputResponse: (input: string | null) => ipcRenderer.invoke('user-input:response', input),

  // 配置存储
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeDelete: (key: string) => ipcRenderer.invoke('store:delete', key),
  storeClear: () => ipcRenderer.invoke('store:clear'),
};

// 使用 `contextBridge` API 向渲染进程暴露 Electron API
// 仅在启用上下文隔离时生效，否则直接添加到 DOM 全局对象
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch {
    // console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}
