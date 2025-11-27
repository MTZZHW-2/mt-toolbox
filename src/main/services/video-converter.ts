import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { VideoConverterOptions as BaseVideoConverterOptions } from 'src/preload/types';
import type { ToolResult } from '@shared/types/common';
import { getFFmpegBinaryPath } from '../utils/ffmpeg';

interface VideoConverterOptions extends BaseVideoConverterOptions {
  onProgress?: (message: string) => void;
}

/**
 * 扫描目录查找视频文件
 */
function findVideoFiles(dir: string): string[] {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v', '.mpg', '.mpeg'];
  const results: string[] = [];

  function scan(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (videoExtensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // 忽略无法访问的目录
    }
  }

  scan(dir);
  return results;
}

/**
 * 根据输出格式自动选择最佳编解码器配置
 */
function getOptimalCodecConfig(outputFormat: string): {
  videoCodec: string;
  audioCodec: string;
  quality: number;
  preset: string;
} {
  const configs: Record<
    string,
    {
      videoCodec: string;
      audioCodec: string;
      quality: number;
      preset: string;
    }
  > = {
    mp4: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      quality: 23,
      preset: 'medium',
    },
    avi: {
      videoCodec: 'libx264',
      audioCodec: 'mp3',
      quality: 23,
      preset: 'medium',
    },
    mov: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      quality: 23,
      preset: 'medium',
    },
  };

  return configs[outputFormat] || configs.mp4;
}

/**
 * 转换单个视频文件
 */
async function convertVideoFile(
  inputPath: string,
  outputPath: string,
  options: VideoConverterOptions,
  ffmpegPath: string,
  onProgress?: (message: string) => void,
): Promise<boolean> {
  const filename = path.basename(inputPath);

  // 根据输出格式自动选择最佳编解码器配置
  const codecConfig = getOptimalCodecConfig(options.outputFormat);

  return new Promise((resolve) => {
    // 构建 FFmpeg 命令参数
    const args: string[] = ['-i', inputPath, '-y']; // 覆盖已存在的文件

    // 添加视频编解码器
    args.push('-c:v', codecConfig.videoCodec);

    // 添加质量参数
    if (codecConfig.videoCodec === 'vp9') {
      // VP9 使用 CRF
      args.push('-crf', codecConfig.quality.toString());
      args.push('-b:v', '0'); // VP9 需要设置 bitrate 为 0 以使用 CRF
    } else if (codecConfig.videoCodec === 'libx264' || codecConfig.videoCodec === 'libx265') {
      // H.264/H.265 使用 CRF 和预设
      args.push('-crf', codecConfig.quality.toString());
      args.push('-preset', codecConfig.preset);
    }

    // 添加音频编解码器
    args.push('-c:a', codecConfig.audioCodec);
    if (codecConfig.audioCodec === 'aac') {
      args.push('-b:a', '192k');
    }

    args.push(outputPath);

    onProgress?.(`  正在转换: ${filename}`);

    const process = spawn(ffmpegPath, args);

    let stderr = '';

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      // 解析进度信息
      const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = parseFloat(timeMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        onProgress?.(`  转换中: ${filename} (${Math.floor(currentTime)}s)`);
      }
    });

    process.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        onProgress?.(`  ✓ 已转换: ${filename}`);
        resolve(true);
      } else {
        onProgress?.(`  ✗ 转换失败: ${filename}`);
        resolve(false);
      }
    });

    process.on('error', (error) => {
      onProgress?.(`  ✗ 转换失败: ${filename} - ${error.message}`);
      resolve(false);
    });
  });
}

/**
 * 视频格式转换主函数
 */
export async function convertVideos(options: VideoConverterOptions): Promise<ToolResult> {
  const { sourceDir, outputFormat, outputDir, onProgress } = options;

  try {
    // 验证源目录
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`源目录不存在: ${sourceDir}`);
    }

    // 确定输出目录
    const finalOutputDir = outputDir || path.join(sourceDir, 'converted');
    if (!fs.existsSync(finalOutputDir)) {
      fs.mkdirSync(finalOutputDir, { recursive: true });
    }

    onProgress?.('🎬 开始扫描视频文件...');

    // 查找所有视频文件
    const videoFiles = findVideoFiles(sourceDir);

    if (videoFiles.length === 0) {
      throw new Error('未找到任何视频文件');
    }

    // 过滤掉输出目录中的文件，避免重复转换
    const filesToConvert = videoFiles.filter((file) => !file.startsWith(finalOutputDir));

    if (filesToConvert.length === 0) {
      throw new Error('未找到需要转换的视频文件（排除输出目录）');
    }

    onProgress?.(`✅ 找到 ${filesToConvert.length} 个视频文件`);

    // 根据输出格式显示将使用的编解码器
    const codecConfig = getOptimalCodecConfig(outputFormat);
    onProgress?.(
      `🎯 使用编解码器: 视频=${codecConfig.videoCodec.toUpperCase()}, 音频=${codecConfig.audioCodec.toUpperCase()}`,
    );
    onProgress?.('🔄 开始转换视频...');

    // 获取 FFmpeg 路径
    const ffmpegPath = getFFmpegBinaryPath();

    // 转换所有视频
    let successCount = 0;
    let failedCount = 0;

    for (const videoPath of filesToConvert) {
      const filename = path.basename(videoPath);
      const nameWithoutExt = path.basename(filename, path.extname(filename));
      const outputFilename = `${nameWithoutExt}.${outputFormat}`;
      const outputPath = path.join(finalOutputDir, outputFilename);

      const success = await convertVideoFile(videoPath, outputPath, options, ffmpegPath, onProgress);

      if (success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    onProgress?.(`✅ 转换完成! 成功: ${successCount}, 失败: ${failedCount}`);
    onProgress?.(`📁 输出目录: ${finalOutputDir}`);

    return {
      success: true,
      summary: '视频格式转换完成',
    };
  } catch (error) {
    onProgress?.(`❌ 错误: ${error instanceof Error ? error.message : String(error)}`);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
