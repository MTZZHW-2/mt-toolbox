import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * 获取 FFmpeg 二进制文件路径
 */
export function getFFmpegBinaryPath(): string {
  const platform = process.platform;
  const arch = process.arch;

  // 根据平台选择对应的 FFmpeg 二进制文件
  const binaryMap: Record<string, string> = {
    'darwin-arm64': 'ffmpeg/ffmpeg-macos-arm64',
    'darwin-x64': 'ffmpeg/ffmpeg-macos-x64',
    'win32-x64': 'ffmpeg/ffmpeg-windows-x64.exe',
    'linux-x64': 'ffmpeg/ffmpeg-linux-x64',
  };

  const binaryName = binaryMap[`${platform}-${arch}`];

  if (!binaryName) {
    throw new Error(
      `不支持的平台: ${platform}-${arch}\n` +
        `FFmpeg 功能需要支持的平台。\n` +
        `支持的平台: macOS (Intel/Apple Silicon), Windows x64, Linux x64`,
    );
  }

  let ffmpegPath: string;

  if (!app.isPackaged) {
    // 开发环境：从项目根目录的 resources 访问
    ffmpegPath = path.join(app.getAppPath(), 'resources/bin', binaryName);
  } else {
    // 生产环境：从应用 resources 目录访问
    ffmpegPath = path.join(process.resourcesPath, 'app.asar.unpacked/resources/bin', binaryName);
  }

  if (!fs.existsSync(ffmpegPath)) {
    throw new Error('未找到 FFmpeg 二进制文件');
  }

  return ffmpegPath;
}
