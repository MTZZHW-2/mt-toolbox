import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import type { TelegramDownloadOptions as BaseTelegramDownloadOptions } from 'src/preload/types';
import type { TelegramDownloadMode } from '@shared/types/telegram-download';

interface TelegramDownloadOptions extends BaseTelegramDownloadOptions {
  onProgress?: (message: string) => void;
  onInputRequired?: (prompt: string) => Promise<string>;
}

/**
 * 获取 session 文件目录
 * 开发环境：使用项目的 native 目录
 * 生产环境：使用 app.getPath('userData')
 */
function getSessionDirectory(): string {
  if (!app.isPackaged) {
    // 开发环境：使用 native 目录
    return path.join(app.getAppPath(), 'native');
  }
  // 生产环境：使用用户数据目录
  return path.join(app.getPath('userData'), 'telegram-sessions');
}

/**
 * 获取二进制文件路径或 Python 脚本路径
 */
function getBinaryPath(mode: TelegramDownloadMode): { command: string; scriptPath?: string } {
  const platform = process.platform;
  const arch = process.arch;
  let binaryName: string;

  if (mode === 'bot') {
    binaryName = 'bot_downloader';
  } else if (mode === 'channel-comments') {
    binaryName = 'channel_comments_downloader';
  } else {
    binaryName = 'topic_downloader';
  }

  // 开发环境:直接使用 Python 脚本
  if (!app.isPackaged) {
    const venvPython = path.join(app.getAppPath(), 'native/.venv/bin/python3');
    const scriptPath = path.join(app.getAppPath(), `native/${binaryName}.py`);
    return {
      command: venvPython,
      scriptPath,
    };
  }

  // 生产环境:使用打包的二进制文件
  if (platform === 'darwin') {
    binaryName = binaryName + (arch === 'arm64' ? '-macos-arm64' : '-macos-x64');
  } else if (platform === 'linux') {
    binaryName = binaryName + '-linux-x64';
  } else if (platform === 'win32') {
    binaryName = binaryName + '-windows-x64.exe';
  } else {
    throw new Error(`不支持的平台: ${platform}`);
  }
  return {
    command: path.join(process.resourcesPath, 'app.asar.unpacked/resources/bin', binaryName),
  };
}

/**
 * 执行 Telegram 下载
 */
export async function downloadFromTelegram(options: TelegramDownloadOptions): Promise<void> {
  const { apiId, apiHash, url, outputPath = '', startFrom = '1', mode = 'bot', onProgress, onInputRequired } = options;
  const sessionName = 'downloader';
  const sessionDir = getSessionDirectory();

  return new Promise((resolve, reject) => {
    try {
      const { command, scriptPath } = getBinaryPath(mode);
      const isPythonScript = !!scriptPath;

      // 构建参数数组
      const args: string[] = [];
      if (isPythonScript && scriptPath) {
        args.push(scriptPath);
      }
      args.push(
        url,
        '--api-id',
        apiId,
        '--api-hash',
        apiHash,
        '--out',
        outputPath,
        '--session',
        sessionName,
        '--session-dir',
        sessionDir,
      );

      // 频道评论模式才需要 startFrom 参数
      if (mode === 'channel-comments' && startFrom !== '1') {
        args.push('--start-from', String(startFrom));
      }

      const childProcess = spawn(command, args);

      let errorBuffer = '';
      let outputBuffer = ''; // 累积输出，处理不完整的行

      childProcess.stdout?.on('data', async (data) => {
        const message = data.toString();
        outputBuffer += message;

        // 检测是否需要用户输入
        // 登录提示可能不带换行符，所以检查缓冲区
        let userPrompt: string | null = null;
        let promptEnd = outputBuffer.length;

        if (outputBuffer.includes('enter your phone')) {
          userPrompt = '请输入您的手机号码（带国家码，例如：+86）';
          promptEnd = outputBuffer.indexOf('enter your phone') + 'enter your phone'.length + 3; // 包含": "
        } else if (outputBuffer.includes('enter the code')) {
          userPrompt = '请输入您收到的验证码';
          promptEnd = outputBuffer.indexOf('enter the code') + 'enter the code'.length + 11; // 包含" you received: "
        } else if (outputBuffer.includes('enter your password')) {
          userPrompt = '请输入您的两步验证密码';
          promptEnd = outputBuffer.indexOf('enter your password') + 'enter your password'.length + 2; // 包含": "
        }

        if (userPrompt) {
          outputBuffer = outputBuffer.substring(promptEnd); // 保留剩余部分

          if (onInputRequired) {
            try {
              const userInput = await onInputRequired(userPrompt);
              childProcess.stdin?.write(userInput + '\n');
            } catch {
              childProcess.kill();
              reject(new Error('用户取消输入'));
            }
          } else {
            onProgress?.(`⚠️ 需要输入: ${userPrompt}`);
          }
        } else {
          // 处理完整的行
          const lines = outputBuffer.split('\n');
          // 保留最后一行（可能不完整）
          outputBuffer = lines.pop() || '';

          // 输出完整的行
          lines.forEach((line) => {
            if (line.trim()) {
              onProgress?.(line.trim());
            }
          });

          // 如果缓冲区太大（超过1000字符），强制输出
          if (outputBuffer.length > 1000) {
            if (outputBuffer.trim()) {
              onProgress?.(outputBuffer.trim());
            }
            outputBuffer = '';
          }
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        errorBuffer += message;
        const lines: string[] = message.split('\n').filter((line) => line.trim());
        lines.forEach((line) => {
          onProgress?.(`[错误] ${line.trim()}`);
        });
      });

      childProcess.on('close', (code) => {
        // 输出残留的缓冲区内容
        if (outputBuffer.trim()) {
          onProgress?.(outputBuffer.trim());
        }

        if (code === 0) {
          onProgress?.('✅ 下载完成!');
          resolve();
        } else {
          reject(new Error(`下载失败,退出码: ${code}\n${errorBuffer}`));
        }
      });

      childProcess.on('error', (err) => {
        reject(new Error(`无法启动下载程序: ${err.message}`));
      });
    } catch (error) {
      reject(error);
    }
  });
}
