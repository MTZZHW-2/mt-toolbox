import type { LucideIcon } from 'lucide-react';
import {
  FolderEditIcon,
  TwitterIcon,
  ScanSearchIcon,
  SendIcon,
  ImageIcon,
  FileVideoIcon,
  RepeatIcon,
} from 'lucide-react';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  path: string;
  iconEmoji: string;
  iconComponent: LucideIcon;
}

export interface ToolCategory {
  category: string;
  tools: ToolItem[];
}

export const toolCategories: ToolCategory[] = [
  {
    category: '媒体处理工具',
    tools: [
      {
        id: 'image-deduplication',
        name: '图片查重',
        description: '检测并管理相似的重复图片',
        iconEmoji: '🔍',
        path: '/image-deduplication',
        iconComponent: ScanSearchIcon,
      },
      {
        id: 'video-deduplication',
        name: '视频查重',
        description: '使用视频指纹技术检测重复视频',
        iconEmoji: '🎬',
        path: '/video-deduplication',
        iconComponent: FileVideoIcon,
      },
      {
        id: 'video-converter',
        name: '视频转换',
        description: '批量转换视频格式，自动优化编码参数',
        iconEmoji: '🎞️',
        path: '/video-converter',
        iconComponent: RepeatIcon,
      },
      {
        id: 'image-optimize',
        name: '图片压缩',
        description: '批量压缩图片，支持多种格式和质量调节',
        iconEmoji: '🖼️',
        path: '/image-optimize',
        iconComponent: ImageIcon,
      },
    ],
  },
  {
    category: '文件工具',
    tools: [
      {
        id: 'file-rename',
        name: '文件重命名',
        description: '批量重命名文件，支持多种规则',
        iconEmoji: '📝',
        path: '/file-rename',
        iconComponent: FolderEditIcon,
      },
    ],
  },
  {
    category: '社交媒体工具',
    tools: [
      {
        id: 'twitter-download',
        name: 'Twitter 下载',
        description: '下载 Twitter 用户的媒体文件',
        iconEmoji: '🐦',
        path: '/twitter-download',
        iconComponent: TwitterIcon,
      },
      {
        id: 'telegram-download',
        name: 'Telegram 下载',
        description: '下载 Telegram 资源',
        iconEmoji: '✈️',
        path: '/telegram-download',
        iconComponent: SendIcon,
      },
    ],
  },
];
