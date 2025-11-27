import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { ImageOptimizeOptions as BaseImageOptimizeOptions } from 'src/preload/types';
import type { ToolResult } from '@shared/types/common';

interface ImageOptimizeOptions extends BaseImageOptimizeOptions {
  onProgress?: (message: string) => void;
}

/**
 * 优化单张图片
 */
async function optimizeImage(
  inputPath: string,
  outputPath: string,
  options: {
    quality: number;
    maxWidth?: number;
    maxHeight?: number;
    format: 'jpeg' | 'png' | 'webp';
  },
): Promise<void> {
  const { quality, maxWidth, maxHeight, format } = options;

  let sharpInstance = sharp(inputPath);

  // 获取图片元数据
  const metadata = await sharpInstance.metadata();

  // 如果设置了最大宽高，则进行缩放
  if (maxWidth || maxHeight) {
    const resizeWidth = metadata.width && maxWidth && metadata.width > maxWidth ? maxWidth : undefined;
    const resizeHeight = metadata.height && maxHeight && metadata.height > maxHeight ? maxHeight : undefined;

    if (resizeWidth || resizeHeight) {
      sharpInstance = sharpInstance.resize(resizeWidth, resizeHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }

  // 根据格式进行压缩
  switch (format) {
    case 'jpeg':
      sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      sharpInstance = sharpInstance.png({
        quality,
        compressionLevel: 9,
      });
      break;
    case 'webp':
      sharpInstance = sharpInstance.webp({ quality });
      break;
  }

  await sharpInstance.toFile(outputPath);
}

/**
 * 获取输出文件路径
 */
function getOutputFilePath(
  inputPath: string,
  outputDir: string,
  format: 'jpeg' | 'png' | 'webp',
  keepOriginal: boolean,
): string {
  const parsedPath = path.parse(inputPath);
  const basename = parsedPath.name;

  // 根据格式确定扩展名
  const extMap = {
    jpeg: '.jpg',
    png: '.png',
    webp: '.webp',
  };
  const newExt = extMap[format];

  // 如果保持原格式且输出目录与输入目录相同，添加后缀
  if (keepOriginal && outputDir === parsedPath.dir && parsedPath.ext.toLowerCase() === newExt.toLowerCase()) {
    return path.join(outputDir, `${basename}_optimized${newExt}`);
  }

  return path.join(outputDir, `${basename}${newExt}`);
}

/**
 * 图片压缩主函数
 */
export async function optimizeImages(options: ImageOptimizeOptions): Promise<ToolResult> {
  const {
    sourceDir,
    outputDir: customOutputDir,
    quality = 80,
    maxWidth,
    maxHeight,
    format = 'jpeg',
    keepOriginal = true,
    onProgress,
  } = options;

  // 验证源目录
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`源目录不存在: ${sourceDir}`);
  }

  // 确定输出目录
  const outputDir = customOutputDir || path.join(sourceDir, 'optimized');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  onProgress?.('🔍 开始扫描图片文件...\n');

  // 获取所有图片文件
  const imageFiles = fs
    .readdirSync(sourceDir)
    .filter((file) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file))
    .map((file) => path.join(sourceDir, file))
    .filter((filePath) => fs.statSync(filePath).isFile());

  if (imageFiles.length === 0) {
    throw new Error('源目录中没有找到图片文件');
  }

  onProgress?.(`📊 找到 ${imageFiles.length} 张图片\n`);
  onProgress?.(`⚙️  压缩配置: 质量=${quality}%, 格式=${format.toUpperCase()}\n`);
  if (maxWidth || maxHeight) {
    onProgress?.(`📐 尺寸限制: ${maxWidth || '∞'}x${maxHeight || '∞'}\n`);
  }
  onProgress?.('\n开始压缩...\n');

  let successCount = 0;
  let failedCount = 0;
  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;

  // 处理每张图片
  for (let i = 0; i < imageFiles.length; i++) {
    const inputPath = imageFiles[i];
    const filename = path.basename(inputPath);

    try {
      onProgress?.(`[${i + 1}/${imageFiles.length}] 正在处理: ${filename}`);

      const outputPath = getOutputFilePath(inputPath, outputDir, format, keepOriginal);

      // 获取原始文件大小
      const originalStats = fs.statSync(inputPath);
      const originalSize = originalStats.size;

      // 压缩图片
      await optimizeImage(inputPath, outputPath, {
        quality,
        maxWidth,
        maxHeight,
        format,
      });

      // 获取压缩后文件大小
      const optimizedStats = fs.statSync(outputPath);
      const optimizedSize = optimizedStats.size;

      const saved = originalSize - optimizedSize;
      const compressionRatio = ((saved / originalSize) * 100).toFixed(2);

      totalOriginalSize += originalSize;
      totalOptimizedSize += optimizedSize;
      successCount++;
      onProgress?.(` ✅ (节省 ${compressionRatio}%)\n`);
    } catch (error) {
      failedCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress?.(` ❌ 失败: ${errorMessage}\n`);
    }
  }

  // 计算统计信息
  const totalSaved = totalOriginalSize - totalOptimizedSize;
  const averageCompressionRatio = totalOriginalSize > 0 ? ((totalSaved / totalOriginalSize) * 100).toFixed(2) : '0.00';

  onProgress?.('\n📊 压缩完成！\n');
  onProgress?.(`✅ 成功: ${successCount} 张\n`);
  onProgress?.(`❌ 失败: ${failedCount} 张\n`);
  onProgress?.(
    `💾 原始大小: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB → 压缩后: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB\n`,
  );
  onProgress?.(`🎉 共节省: ${(totalSaved / 1024 / 1024).toFixed(2)} MB (${averageCompressionRatio}%)\n`);
  onProgress?.(`📁 输出目录: ${outputDir}\n`);

  return {
    success: true,
    summary: '压缩完成',
  };
}
