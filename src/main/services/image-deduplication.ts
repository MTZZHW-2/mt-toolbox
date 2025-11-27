import fs from 'fs';
import path from 'path';
import { imageHash } from 'image-hash';
import type { ImageDeduplicationOptions as BaseImageDeduplicationOptions } from 'src/preload/types';
import type { DeduplicationReport, ImageDeduplicationResult, SimilarGroup } from '@shared/types/image-deduplication';

interface ImageData {
  filePath: string;
  filename: string;
  hash: string;
  size: number;
  sizeKB: string;
}

interface ImageDeduplicationOptions extends BaseImageDeduplicationOptions {
  onProgress?: (message: string) => void;
}

/**
 * 计算图片哈希值
 */
async function getImageHash(imagePath: string): Promise<string> {
  const { fileTypeFromFile } = await import('file-type');
  const fileType = await fileTypeFromFile(imagePath);

  if (!fileType || !fileType.mime.startsWith('image/')) {
    throw new Error('不是有效的图片文件');
  }

  // 根据真实格式确定扩展名
  const realExt = fileType.ext;

  return new Promise((resolve, reject) => {
    imageHash(imagePath, 16, true, (error: Error | null, data: string) => {
      if (error) {
        // 如果还是失败，尝试创建临时文件使用正确扩展名
        const tmpPath = `${imagePath}.tmp.${realExt}`;
        try {
          fs.copyFileSync(imagePath, tmpPath);
          imageHash(tmpPath, 16, true, (err2: Error | null, data2: string) => {
            fs.unlinkSync(tmpPath);
            if (err2) reject(err2);
            else resolve(data2);
          });
        } catch {
          reject(error);
        }
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * 计算两个哈希值的汉明距离
 */
function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

/**
 * 图片查重主函数
 */
export async function deduplicateImages(options: ImageDeduplicationOptions): Promise<ImageDeduplicationResult> {
  const { sourceDir, similarityThreshold = 5, autoDelete = false, onProgress } = options;

  // 验证源目录
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`源目录不存在: ${sourceDir}`);
  }

  // 输出目录固定为源目录下的 duplicates 文件夹
  const duplicatesPath = path.join(sourceDir, 'duplicates');
  if (!fs.existsSync(duplicatesPath)) {
    fs.mkdirSync(duplicatesPath, { recursive: true });
  }

  onProgress?.('🔍 开始检测相似图片...\n');

  // 获取所有图片文件
  const photoFiles = fs
    .readdirSync(sourceDir)
    .filter((file) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file))
    .map((file) => path.join(sourceDir, file))
    .filter((filePath) => fs.statSync(filePath).isFile()); // 只处理文件

  if (photoFiles.length === 0) {
    throw new Error('源目录中没有找到图片文件');
  }

  onProgress?.(`📊 共 ${photoFiles.length} 张图片需要检测\n`);

  // 计算所有图片的哈希值和文件大小
  const photoData: ImageData[] = [];

  for (let i = 0; i < photoFiles.length; i++) {
    const filePath = photoFiles[i];
    const filename = path.basename(filePath);

    try {
      onProgress?.(`⏳ [${i + 1}/${photoFiles.length}] 计算哈希: ${filename}...`);
      const hash = await getImageHash(filePath);
      const stats = fs.statSync(filePath);

      photoData.push({
        filePath,
        filename,
        hash,
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
      });

      onProgress?.(' ✓\n');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      onProgress?.(` ❌ 失败: ${errorMsg}\n`);
    }
  }

  if (photoData.length === 0) {
    throw new Error('没有成功处理任何图片文件');
  }

  // 查找相似图片组
  const similarGroups: SimilarGroup[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < photoData.length; i++) {
    if (processed.has(i)) continue;

    const group: ImageData[] = [photoData[i]];
    processed.add(i);

    for (let j = i + 1; j < photoData.length; j++) {
      if (processed.has(j)) continue;

      const distance = hammingDistance(photoData[i].hash, photoData[j].hash);

      if (distance <= similarityThreshold) {
        group.push(photoData[j]);
        processed.add(j);
      }
    }

    if (group.length > 1) {
      // 按文件大小排序，最大的在前（质量最高）
      group.sort((a, b) => b.size - a.size);
      similarGroups.push({
        groupNumber: similarGroups.length + 1,
        totalImages: group.length,
        images: [],
      });
    }
  }

  // 如果没有找到相似图片
  if (similarGroups.length === 0) {
    onProgress?.('\n✅ 未发现相似图片！\n');

    const report: DeduplicationReport = {
      scanDate: new Date().toISOString(),
      totalPhotos: photoFiles.length,
      similarGroups: [],
      statistics: {
        totalGroups: 0,
        totalDuplicates: 0,
        spaceCanBeSaved: 0,
      },
    };

    return {
      success: true,
      report,
      duplicatesPath,
    };
  }

  onProgress?.('\n🔄 开始移动相似图片...\n');

  // 创建报告对象
  const report: DeduplicationReport = {
    scanDate: new Date().toISOString(),
    totalPhotos: photoFiles.length,
    similarGroups: [],
    statistics: {
      totalGroups: similarGroups.length,
      totalDuplicates: 0,
      spaceCanBeSaved: 0,
    },
  };

  // 重新实现：直接使用之前找到的相似组
  report.similarGroups = [];
  report.statistics.totalDuplicates = 0;
  report.statistics.spaceCanBeSaved = 0;

  // 重新遍历找到的相似组
  const reprocessedGroups: ImageData[][] = [];
  const reprocessed = new Set<number>();

  for (let i = 0; i < photoData.length; i++) {
    if (reprocessed.has(i)) continue;

    const group: ImageData[] = [photoData[i]];
    reprocessed.add(i);

    for (let j = i + 1; j < photoData.length; j++) {
      if (reprocessed.has(j)) continue;

      const distance = hammingDistance(photoData[i].hash, photoData[j].hash);

      if (distance <= similarityThreshold) {
        group.push(photoData[j]);
        reprocessed.add(j);
      }
    }

    if (group.length > 1) {
      group.sort((a, b) => b.size - a.size);
      reprocessedGroups.push(group);
    }
  }

  // 处理每个相似组
  for (let i = 0; i < reprocessedGroups.length; i++) {
    const group = reprocessedGroups[i];
    const groupNum = i + 1;
    const groupPath = path.join(duplicatesPath, `group_${groupNum}`);

    if (!fs.existsSync(groupPath)) {
      fs.mkdirSync(groupPath, { recursive: true });
    }

    const groupInfo: SimilarGroup = {
      groupNumber: groupNum,
      totalImages: group.length,
      images: [],
    };

    let spaceCanBeSaved = 0;

    for (let j = 0; j < group.length; j++) {
      const photo = group[j];
      const isBest = j === 0; // 第一个是质量最高的

      // 生成新文件名
      let newFilename: string;
      if (isBest) {
        const ext = path.extname(photo.filename);
        const nameWithoutExt = path.basename(photo.filename, ext);
        newFilename = `${nameWithoutExt}_★最佳${ext}`;
      } else {
        newFilename = photo.filename;
      }

      const newPath = path.join(groupPath, newFilename);

      // 移动文件到输出目录
      fs.renameSync(photo.filePath, newPath);

      groupInfo.images.push({
        filename: photo.filename,
        newFilename,
        size: photo.size,
        sizeKB: photo.sizeKB,
        hash: photo.hash,
        isBest,
      });

      if (!isBest) {
        spaceCanBeSaved += photo.size;
      }
    }

    report.statistics.totalDuplicates += group.length - 1;
    report.statistics.spaceCanBeSaved += spaceCanBeSaved;
    report.similarGroups.push(groupInfo);
  }

  // 如果选择自动删除模式，将最佳图片移回根目录，删除 duplicates 文件夹
  if (autoDelete) {
    onProgress?.('\n🔄 将最佳图片移回源目录...\n');

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
          // 移除 _★最佳 后缀，恢复原文件名
          const originalName = file.replace(/_★最佳/, '');
          const targetPath = path.join(sourceDir, originalName);
          fs.renameSync(filePath, targetPath);
        }
      }
    }

    // 删除整个 duplicates 文件夹
    fs.rmSync(duplicatesPath, { recursive: true, force: true });
    onProgress?.('✅ 已删除重复图片，保留最佳版本\n');
  }

  // 输出统计信息
  onProgress?.('\n📊 去重统计:\n');
  onProgress?.(`  🔍 总图片数: ${report.totalPhotos}\n`);
  onProgress?.(`  📦 相似图片组: ${report.statistics.totalGroups}\n`);
  onProgress?.(`  🗑️  重复图片数: ${report.statistics.totalDuplicates}\n`);
  const totalSavedMB = (report.statistics.spaceCanBeSaved / 1024 / 1024).toFixed(2);
  onProgress?.(`  💾 可节省空间: ${totalSavedMB} MB\n`);

  if (!autoDelete) {
    onProgress?.(`\n📁 相似图片已移动至: ${duplicatesPath}\n\n`);
  } else {
    onProgress?.(`\n🗑️  重复图片已删除\n\n`);
  }

  return {
    success: true,
    report,
    duplicatesPath: autoDelete ? '' : duplicatesPath,
  };
}
