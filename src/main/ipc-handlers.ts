import type { BrowserWindow } from 'electron';
import { app, dialog, ipcMain } from 'electron';
import { renameFiles } from './services/file-rename';
import { downloadTwitterMedia } from './services/twitter-download';
import { deduplicateImages } from './services/image-deduplication';
import { deduplicateVideos } from './services/video-deduplication';
import { convertVideos } from './services/video-converter';
import { optimizeImages } from './services/image-optimize';
import { downloadFromTelegram } from './services/telegram-download';
import { getStore } from './services/store';

// 全局用户输入状态管理
let pendingInputResolve: ((value: string) => void) | null = null;
let pendingInputReject: (() => void) | null = null;
// 注册通用用户输入处理器
export function registerUserInputHandler(): void {
  ipcMain.handle('user-input:response', async (_event, userInput: string | null) => {
    if (pendingInputResolve) {
      if (userInput !== null) {
        pendingInputResolve(userInput);
      } else if (pendingInputReject) {
        pendingInputReject();
      }
      pendingInputResolve = null;
      pendingInputReject = null;
    }
    return { success: true };
  });
}

// 注册文件对话框处理器
export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:open-file', async () => {
    return await dialog.showOpenDialog({
      properties: ['openFile'],
    });
  });

  ipcMain.handle('dialog:open-directory', async () => {
    return await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
  });

  // 获取系统下载文件夹路径
  ipcMain.handle('app:get-downloads-path', () => {
    return app.getPath('downloads');
  });
}

// 注册图片查重处理器
export function registerImageDeduplicationHandler(mainWindow: BrowserWindow): void {
  ipcMain.handle('image-deduplication:execute', async (_event, options) => {
    try {
      const result = await deduplicateImages({
        sourceDir: options.sourceDir,
        similarityThreshold: options.similarityThreshold,
        autoDelete: options.autoDelete,
        onProgress: (message) => {
          mainWindow.webContents.send('image-deduplication:progress', message);
        },
      });

      return {
        ...result,
        summary: '查重完成',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// 注册视频查重处理器
export function registerVideoDeduplicationHandler(mainWindow: BrowserWindow): void {
  ipcMain.handle('video-deduplication:execute', async (_event, options) => {
    try {
      const result = await deduplicateVideos({
        sourceDir: options.sourceDir,
        similarityThreshold: options.similarityThreshold,
        autoDelete: options.autoDelete,
        onProgress: (message) => {
          mainWindow.webContents.send('video-deduplication:progress', message);
        },
      });

      return {
        ...result,
        summary: '查重完成',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// 注册视频格式转换处理器
export function registerVideoConverterHandler(mainWindow: BrowserWindow): void {
  ipcMain.handle('video-converter:execute', async (_event, options) => {
    try {
      const result = await convertVideos({
        ...options,
        onProgress: (message) => {
          mainWindow.webContents.send('video-converter:progress', message);
        },
      });

      return {
        ...result,
        summary: '转换完成',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// 注册图片压缩处理器
export function registerImageOptimizeHandler(mainWindow: BrowserWindow): void {
  ipcMain.handle('image-optimize:execute', async (_event, options) => {
    try {
      const result = await optimizeImages({
        ...options,
        onProgress: (message) => {
          mainWindow.webContents.send('image-optimize:progress', message);
        },
      });

      return {
        ...result,
        summary: '压缩完成',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// 注册文件重命名处理器
export function registerFileRenameHandler(mainWindow: BrowserWindow): void {
  ipcMain.handle('file-rename:execute', async (_event, options) => {
    try {
      await renameFiles({
        directory: options.directory,
        rules: options.rules,
        dryRun: options.dryRun,
        onProgress: (message) => {
          mainWindow.webContents.send('file-rename:progress', message);
        },
      });

      return {
        success: true,
        summary: '重命名完成',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// 注册 Twitter 媒体下载处理器
export function registerTwitterDownloadHandler(mainWindow: BrowserWindow): void {
  ipcMain.handle('twitter-download:execute', async (_event, options) => {
    try {
      await downloadTwitterMedia({
        username: options.username,
        cookies: options.cookies,
        downloadPath: options.downloadPath,
        includeRetweets: options.includeRetweets || false,
        onProgress: (message) => {
          mainWindow.webContents.send('twitter-download:progress', message);
        },
      });

      return {
        success: true,
        summary: '下载完成',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// 注册 Telegram 下载处理器
export function registerTelegramDownloadHandler(mainWindow: BrowserWindow): void {
  ipcMain.handle('telegram-download:execute', async (_event, options) => {
    try {
      await downloadFromTelegram({
        ...options,
        onProgress: (message) => {
          mainWindow.webContents.send('telegram-download:progress', message);
        },
        onInputRequired: (prompt) => {
          return new Promise<string>((resolve, reject) => {
            pendingInputResolve = resolve;
            pendingInputReject = reject;
            // 发送通用输入请求到前端，附带来源信息
            mainWindow.webContents.send('user-input:required', prompt, 'telegram-download');
          });
        },
      });

      return {
        success: true,
        summary: '下载完成',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

// 注册配置存储处理器
export function registerStoreHandlers(): void {
  // 保存配置
  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    try {
      const store = await getStore();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (store as any).set(key, value);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 获取配置
  ipcMain.handle('store:get', async (_event, key: string) => {
    try {
      const store = await getStore();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (store as any).get(key);
      return { success: true, value };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 删除配置
  ipcMain.handle('store:delete', async (_event, key: string) => {
    try {
      const store = await getStore();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (store as any).delete(key);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 清空所有配置
  ipcMain.handle('store:clear', async () => {
    try {
      const store = await getStore();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (store as any).clear();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
