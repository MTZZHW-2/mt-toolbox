import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RenameRule } from '@shared/types/file-rename';
import type { FileRenameOptions as BaseFileRenameOptions } from 'src/preload/types';

interface FileRenameOptions extends BaseFileRenameOptions {
  onProgress?: (message: string) => void;
}

/**
 * 应用单个重命名规则
 */
function applyRule(filename: string, rule: RenameRule, index: number, totalFiles: number): string {
  const ext = path.extname(filename);
  const nameWithoutExt = path.basename(filename, ext);

  switch (rule.type) {
    case 'prefix':
      return `${rule.config.prefix}${nameWithoutExt}${ext}`;

    case 'suffix':
      return `${nameWithoutExt}${rule.config.suffix}${ext}`;

    case 'replace': {
      const pattern = rule.config.pattern ?? '';
      const replacement = rule.config.replacement ?? '';
      const ignoreExtension = rule.config.ignoreExtension ?? true;

      if (!pattern) return filename;

      // 构造全局、大小写敏感的纯文本替换正则
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');

      try {
        if (ignoreExtension) {
          const newName = nameWithoutExt.replace(regex, replacement);
          return `${newName}${ext}`;
        } else {
          const full = `${nameWithoutExt}${ext}`;
          const replaced = full.replace(regex, replacement);
          return replaced;
        }
      } catch {
        return filename;
      }
    }

    case 'number': {
      const num = (rule.config.startNumber || 1) + index;
      // 如果没有指定填充位数，自动推断
      let padLength = rule.config.padLength;
      if (!padLength) {
        // 根据总文件数自动计算需要的位数
        const maxNum = (rule.config.startNumber || 1) + totalFiles - 1;
        padLength = String(maxNum).length;
      }
      const paddedNum = String(num).padStart(padLength, '0');
      return `${paddedNum}${ext}`;
    }

    default:
      return filename;
  }
}

/**
 * 按顺序应用所有规则
 */
function applyRules(filename: string, rules: RenameRule[], index: number, totalFiles: number): string {
  let result = filename;

  for (const rule of rules) {
    result = applyRule(result, rule, index, totalFiles);
  }

  return result;
}

/**
 * 执行文件重命名
 */
export async function renameFiles(options: FileRenameOptions): Promise<void> {
  const { directory, rules, dryRun = false, onProgress } = options;

  // 验证参数
  if (!directory) {
    throw new Error('未指定目录');
  }

  if (!rules || rules.length === 0) {
    throw new Error('未指定重命名规则');
  }

  // 检查目录是否存在
  if (!fs.existsSync(directory)) {
    throw new Error('目录不存在');
  }

  if (dryRun) {
    onProgress?.('🔍 预览模式：仅显示重命名结果，不会实际修改文件');
  }

  onProgress?.('📂 正在读取目录...');

  // 读取目录下的所有文件，过滤掉系统文件
  const files = fs.readdirSync(directory).filter((file) => {
    // 过滤掉 .DS_Store 等系统文件
    if (file === '.DS_Store') {
      return false;
    }

    const filePath = path.join(directory, file);
    return fs.statSync(filePath).isFile();
  });

  if (files.length === 0) {
    onProgress?.('⚠️  目录中没有文件');
    return;
  }

  onProgress?.(`📊 找到 ${files.length} 个文件`);

  // 生成重命名映射表
  const renameMap: Array<{ oldName: string; newName: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const oldName = files[i];
    const newName = applyRules(oldName, rules, i, files.length);

    if (oldName !== newName) {
      renameMap.push({ oldName, newName });
    }
  }

  if (renameMap.length === 0) {
    onProgress?.('⚠️  没有文件需要重命名');
    return;
  }

  onProgress?.(`🔄 准备重命名 ${renameMap.length} 个文件`);

  // 如果是预览模式，只显示重命名计划，不实际执行
  if (dryRun) {
    onProgress?.('📋 预览重命名结果：');

    // 分批发送，避免消息丢失
    for (let i = 0; i < renameMap.length; i++) {
      onProgress?.(`   ${renameMap[i].oldName} → ${renameMap[i].newName}`);

      // 每 10 条消息后稍作延迟，确保消息能被正确发送
      if ((i + 1) % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    onProgress?.(`✅ 预览完成，共 ${renameMap.length} 个文件将被重命名`);
    return;
  }

  // 第一步：将所有文件重命名为带时间戳的临时文件名，避免冲突
  const tempMap: Array<{ tempName: string; newName: string; oldName: string }> = [];

  onProgress?.('🔄 第一步：添加临时时间戳前缀...');
  for (const item of renameMap) {
    const timestamp = Date.now();
    const tempName = `${timestamp}_${item.oldName}`;

    try {
      fs.renameSync(path.join(directory, item.oldName), path.join(directory, tempName));
      tempMap.push({
        tempName,
        newName: item.newName,
        oldName: item.oldName,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`创建临时文件失败 ${item.oldName}: ${errorMessage}`);
    }
  }

  // 第二步：将临时文件重命名为最终文件名
  onProgress?.('✨ 第二步：重命名为最终文件名...');
  let successCount = 0;
  let errorCount = 0;

  for (const item of tempMap) {
    try {
      fs.renameSync(path.join(directory, item.tempName), path.join(directory, item.newName));
      successCount++;
      onProgress?.(`✅ ${item.oldName} → ${item.newName}`);
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      onProgress?.(`❌ ${item.oldName} 重命名失败: ${errorMessage}`);
      onProgress?.(`⚠️  临时文件保留为: ${item.tempName}`);
    }
  }

  // 总结
  onProgress?.(`\n📈 重命名完成:`);
  onProgress?.(`   成功: ${successCount} 个`);
  if (errorCount > 0) {
    onProgress?.(`   失败: ${errorCount} 个`);
  }
}
