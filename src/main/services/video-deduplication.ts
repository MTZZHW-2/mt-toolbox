import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { imageHash } from 'image-hash';
import sharp from 'sharp';
import type { VideoDeduplicationOptions as BaseVideoDeduplicationOptions } from 'src/preload/types';
import type {
  VideoDeduplicationResult,
  VideoDeduplicationReport,
  SimilarVideoGroup,
} from '@shared/types/video-deduplication';
import { getFFmpegBinaryPath } from '../utils/ffmpeg';

interface VideoData {
  filePath: string;
  filename: string;
  hash: string;
  size: number;
  sizeKB: string;
  duration?: number;
}

interface VideoDeduplicationOptions extends BaseVideoDeduplicationOptions {
  onProgress?: (message: string) => void;
}

/**
 * Promisify image-hash
 */
function imageHashAsync(imagePath: string, bits: number, precise: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    imageHash(imagePath, bits, precise, (error: Error | null, data: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * 获取视频时长
 */
async function getVideoDuration(videoPath: string, ffmpegPath: string): Promise<number> {
  return new Promise((resolve) => {
    const process = spawn(ffmpegPath, ['-i', videoPath, '-f', 'null', '-']);

    let stderr = '';

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', () => {
      const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseFloat(match[3]);
        const duration = hours * 3600 + minutes * 60 + seconds;
        resolve(duration);
      } else {
        resolve(0);
      }
    });

    process.on('error', () => {
      resolve(0);
    });
  });
}

/**
 * 从视频提取帧
 */
async function extractFrame(
  videoPath: string,
  timestamp: number,
  outputPath: string,
  ffmpegPath: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(ffmpegPath, [
      '-ss',
      timestamp.toString(),
      '-i',
      videoPath,
      '-vframes',
      '1',
      '-q:v',
      '2',
      '-y',
      outputPath,
    ]);

    process.on('close', (code) => {
      resolve(code === 0 && fs.existsSync(outputPath));
    });

    process.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * 生成单个视频的指纹 (简化方案)
 *
 * 算法流程:
 * 1. 每隔 1 秒提取一帧
 * 2. 将所有帧缩放到统一尺寸 (144x144)
 * 3. 对每帧计算感知哈希 (8x8 = 64位)
 * 4. 组合所有帧的哈希值
 */
async function generateVideoFingerprint(
  videoPath: string,
  ffmpegPath: string,
  interval: number = 1,
  onProgress?: (message: string) => void,
): Promise<VideoData | null> {
  try {
    // 获取视频时长
    const duration = await getVideoDuration(videoPath, ffmpegPath);
    if (duration <= 0) {
      onProgress?.(`⚠️  无法获取时长: ${path.basename(videoPath)}`);
      return null;
    }

    // 每隔 interval 秒提取一帧
    const timestamps: number[] = [];
    for (let t = 0; t < duration; t += interval) {
      timestamps.push(t);
    }

    if (timestamps.length === 0) {
      timestamps.push(0);
    }

    onProgress?.(`  提取 ${timestamps.length} 帧 (每 ${interval}s)`);

    // 提取帧并计算哈希
    const frameHashes: string[] = [];
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-hash-'));

    try {
      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const framePath = path.join(tempDir, `frame_${i}.jpg`);

        const extracted = await extractFrame(videoPath, timestamp, framePath, ffmpegPath);

        if (extracted) {
          try {
            // 将帧缩放到统一尺寸 144x144
            const resizedPath = path.join(tempDir, `resized_${i}.jpg`);
            await sharp(framePath).resize(144, 144, { fit: 'fill' }).toFile(resizedPath);

            // 使用 8x8 哈希 (64位)
            const hash = await imageHashAsync(resizedPath, 8, true);
            frameHashes.push(hash);

            fs.unlinkSync(framePath);
            fs.unlinkSync(resizedPath);
          } catch {
            // 忽略单帧错误
          }
        }
      }
    } finally {
      try {
        fs.rmdirSync(tempDir);
      } catch {
        // 忽略
      }
    }

    if (frameHashes.length === 0) {
      onProgress?.(`⚠️  无法提取视频帧: ${path.basename(videoPath)}`);
      return null;
    }

    // 组合所有帧哈希
    const combinedHash = frameHashes.join('');
    const stats = fs.statSync(videoPath);

    onProgress?.(`  ✓ ${path.basename(videoPath)} (${frameHashes.length} 帧)`);

    return {
      filePath: videoPath,
      filename: path.basename(videoPath),
      hash: combinedHash,
      size: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2),
      duration: Math.round(duration * 100) / 100,
    };
  } catch (error) {
    onProgress?.(`⚠️  处理失败: ${path.basename(videoPath)} - ${error}`);
    return null;
  }
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
 * 生成目录下所有视频的指纹
 */
async function generateVideoFingerprints(
  sourceDir: string,
  onProgress?: (message: string) => void,
): Promise<VideoData[]> {
  // 查找所有视频文件
  onProgress?.('正在扫描视频文件...');
  const videoFiles = findVideoFiles(sourceDir);

  if (videoFiles.length === 0) {
    throw new Error('未找到任何视频文件');
  }

  onProgress?.(`找到 ${videoFiles.length} 个视频文件`);

  // 获取 FFmpeg 路径
  const ffmpegPath = getFFmpegBinaryPath();

  // 生成所有视频的指纹
  onProgress?.('正在生成视频指纹...');
  const videoDataList: VideoData[] = [];

  for (const videoPath of videoFiles) {
    // 每隔 1 秒提取一帧 (类似 videohash 的默认行为)
    const videoData = await generateVideoFingerprint(videoPath, ffmpegPath, 1, onProgress);
    if (videoData) {
      videoDataList.push(videoData);
    }
  }

  return videoDataList;
}

/**
 * 计算两个视频指纹的汉明距离
 * 返回不同位的数量,数值越小越相似
 */
function hammingDistance(hash1: string, hash2: string): number {
  const len1 = hash1.length;
  const len2 = hash2.length;

  if (len1 === 0 || len2 === 0) {
    return Infinity;
  }

  // 比较较短的长度
  const minLen = Math.min(len1, len2);
  let distance = 0;

  for (let i = 0; i < minLen; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  // 如果长度不同,长度差异也计入距离
  distance += Math.abs(len1 - len2);

  return distance;
}

/**
 * 视频查重主函数
 */
export async function deduplicateVideos(options: VideoDeduplicationOptions): Promise<VideoDeduplicationResult> {
  // 阈值为汉明距离 (0~20),数值越小越严格
  const { sourceDir, similarityThreshold = 5, autoDelete = false, onProgress } = options;

  try {
    // 验证源目录
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`源目录不存在: ${sourceDir}`);
    }

    // 输出目录固定为源目录下的 duplicates 文件夹
    const duplicatesPath = path.join(sourceDir, 'duplicates');
    if (!fs.existsSync(duplicatesPath)) {
      fs.mkdirSync(duplicatesPath, { recursive: true });
    }

    onProgress?.('📹 开始扫描视频文件...');

    // 生成所有视频的指纹
    const videos = await generateVideoFingerprints(sourceDir, onProgress);

    if (videos.length === 0) {
      throw new Error('未找到任何视频文件');
    }

    onProgress?.(`✅ 已扫描 ${videos.length} 个视频`);
    onProgress?.('🔍 正在查找相似视频...');

    // 查找相似视频组
    const similarGroups: SimilarVideoGroup[] = [];
    const processed = new Set<string>();
    let groupNumber = 1;
    let totalDuplicates = 0;
    let spaceCanBeSaved = 0;

    for (let i = 0; i < videos.length; i++) {
      if (processed.has(videos[i].filePath)) continue;

      const group: VideoData[] = [videos[i]];
      processed.add(videos[i].filePath);

      // 查找相似的视频
      for (let j = i + 1; j < videos.length; j++) {
        if (processed.has(videos[j].filePath)) continue;

        const distance = hammingDistance(videos[i].hash, videos[j].hash);

        if (distance <= similarityThreshold) {
          group.push(videos[j]);
          processed.add(videos[j].filePath);
        }
      }

      // 如果组内有多个视频,说明找到了相似的
      if (group.length > 1) {
        // 选择最大的文件作为最佳版本
        group.sort((a, b) => b.size - a.size);

        // 创建分组目录
        const groupPath = path.join(duplicatesPath, `group_${groupNumber}`);
        if (!fs.existsSync(groupPath)) {
          fs.mkdirSync(groupPath, { recursive: true });
        }

        // 移动整组视频
        const movedVideos: SimilarVideoGroup['videos'] = [];
        let groupSpaceSaved = 0;

        for (let j = 0; j < group.length; j++) {
          const video = group[j];
          const isBest = j === 0; // 第一个是质量最高的

          // 生成新文件名
          let newFilename: string;
          if (isBest) {
            const ext = path.extname(video.filename);
            const nameWithoutExt = path.basename(video.filename, ext);
            newFilename = `${nameWithoutExt}_★最佳${ext}`;
          } else {
            newFilename = video.filename;
          }

          const destPath = path.join(groupPath, newFilename);

          // 移动文件到分组目录
          fs.renameSync(video.filePath, destPath);
          onProgress?.(`📦 已移动: ${video.filename} -> duplicates/group_${groupNumber}/${newFilename}`);

          movedVideos.push({
            filename: video.filename,
            newFilename,
            size: video.size,
            sizeKB: video.sizeKB,
            hash: video.hash,
            duration: video.duration,
            isBest,
          });

          if (!isBest) {
            groupSpaceSaved += video.size;
          }
        }

        totalDuplicates += group.length - 1;
        spaceCanBeSaved += groupSpaceSaved;

        similarGroups.push({
          groupNumber,
          totalVideos: group.length,
          videos: movedVideos,
        });

        groupNumber++;
      }
    }

    // 生成报告
    const report: VideoDeduplicationReport = {
      scanDate: new Date().toISOString(),
      totalVideos: videos.length,
      similarGroups,
      statistics: {
        totalGroups: similarGroups.length,
        totalDuplicates,
        spaceCanBeSaved,
      },
    };

    // 如果选择自动删除模式,将最佳视频移回根目录,删除 duplicates 文件夹
    if (autoDelete) {
      onProgress?.('🔄 将最佳视频移回源目录...');

      // 遍历 duplicates 文件夹中的所有分组
      const groups = fs.readdirSync(duplicatesPath);
      for (const groupFolder of groups) {
        const groupPath = path.join(duplicatesPath, groupFolder);
        if (!fs.statSync(groupPath).isDirectory()) continue;

        // 查找带 _★最佳 后缀的文件
        const files = fs.readdirSync(groupPath);
        for (const file of files) {
          if (file.includes('_★最佳')) {
            const filePath = path.join(groupPath, file);
            // 移除 _★最佳 后缀,恢复原文件名
            const originalName = file.replace(/_★最佳/, '');
            const targetPath = path.join(sourceDir, originalName);
            fs.renameSync(filePath, targetPath);
          }
        }
      }

      // 删除整个 duplicates 文件夹
      fs.rmSync(duplicatesPath, { recursive: true, force: true });
      onProgress?.('✅ 已删除重复视频,保留最佳版本');
    }

    onProgress?.(`✅ 查重完成! 找到 ${similarGroups.length} 组相似视频`);
    onProgress?.(`💾 可节省空间: ${(spaceCanBeSaved / (1024 * 1024)).toFixed(2)} MB`);

    return {
      success: true,
      summary: '视频查重完成',
      report,
      duplicatesPath,
    };
  } catch (error) {
    onProgress?.(`❌ 错误: ${error instanceof Error ? error.message : String(error)}`);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
