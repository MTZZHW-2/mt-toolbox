import { join } from 'path';
import { app, shell, BrowserWindow } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import log from 'electron-log';
import icon from '../../resources/icon.png?asset';
import {
  registerDialogHandlers,
  registerUserInputHandler,
  registerImageDeduplicationHandler,
  registerVideoDeduplicationHandler,
  registerVideoConverterHandler,
  registerImageOptimizeHandler,
  registerFileRenameHandler,
  registerTwitterDownloadHandler,
  registerTelegramDownloadHandler,
  registerStoreHandlers,
} from './ipc-handlers';

// 在生产环境中,日志会保存到以下位置:
// macOS: ~/Library/Logs/mt-toolbox/main.log
// Windows: %USERPROFILE%\AppData\Roaming\mt-toolbox\logs\main.log
// Linux: ~/.config/mt-toolbox/logs/main.log
log.transports.file.level = 'info';
log.transports.console.level = 'info';

function createWindow(): BrowserWindow {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // 基于 electron-vite 脚手架的渲染进程热重载
  // 开发环境加载远程 URL，生产环境加载本地 html 文件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
// 某些 API 只能在此事件发生后使用
app.whenReady().then(() => {
  // 为 Windows 设置应用用户模型 ID
  electronApp.setAppUserModelId('com.mtzzhw.mt-toolbox');

  // 开发环境下默认通过 F12 打开或关闭开发者工具
  // 生产环境下忽略 CommandOrControl + R 快捷键
  // 查看 https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // 注册文件对话框处理器
  registerDialogHandlers();
  // 注册通用用户输入处理器
  registerUserInputHandler();
  // 注册配置存储处理器
  registerStoreHandlers();

  const mainWindow = createWindow();
  // 注册工具 IPC 处理器
  registerImageDeduplicationHandler(mainWindow);
  registerVideoDeduplicationHandler(mainWindow);
  registerVideoConverterHandler(mainWindow);
  registerImageOptimizeHandler(mainWindow);
  registerFileRenameHandler(mainWindow);
  registerTwitterDownloadHandler(mainWindow);
  registerTelegramDownloadHandler(mainWindow);

  app.on('activate', function () {
    // 在 macOS 上，当点击 dock 图标且没有其他窗口打开时
    // 通常会重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 除了 macOS 外，当所有窗口都被关闭时退出应用
// 在 macOS 上，应用程序及其菜单栏通常会保持活动状态
// 直到用户使用 Cmd + Q 显式退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
