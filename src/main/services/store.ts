import type Store from 'electron-store';
import type { RenameRule } from '@shared/types/file-rename';

// 定义存储的配置类型
interface StoreSchema {
  'twitter-download': {
    cookies?: string;
    includeRetweets?: boolean;
    downloadPath?: string;
  };
  'file-rename': {
    rules?: RenameRule[];
  };
  'image-deduplication': {
    similarityThreshold?: string;
  };
  'video-deduplication': {
    similarityThreshold?: string;
  };
  'telegram-download': {
    apiId?: string;
    apiHash?: string;
  };
}

// 使用动态导入来加载 electron-store (v11 是 ES 模块)
let storeInstance: Store<StoreSchema> | null = null;

async function initStore(): Promise<Store<StoreSchema>> {
  if (!storeInstance) {
    const Store = (await import('electron-store')).default;
    storeInstance = new Store<StoreSchema>({
      name: 'app-config',
      defaults: {
        'twitter-download': {},
        'file-rename': {},
        'image-deduplication': {},
        'video-deduplication': {},
        'telegram-download': {},
      },
    });
  }
  return storeInstance;
}

// 导出 store 操作函数
export async function getStore(): Promise<Store<StoreSchema>> {
  return await initStore();
}

export type { StoreSchema };
