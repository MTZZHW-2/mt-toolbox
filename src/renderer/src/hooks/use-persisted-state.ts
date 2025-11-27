import { useState, useEffect } from 'react';
import { useDebounceValue } from 'usehooks-ts';

// 全局保存队列，按 storeKey 分组
const savingLocks = new Map<string, Promise<void>>();

/**
 * 持久化单个状态的 Hook
 * 支持自动加载和保存单个值到本地存储
 *
 * @template T - 状态值的类型
 * @param storeKey - 存储键名
 * @param fieldKey - 字段键名
 * @param initialValue - 初始值或返回初始值的异步函数
 * @param debounceDelay - 防抖延迟时间（毫秒），默认 500ms
 * @returns [value, setValue, isLoading] - 值、设置器函数和加载状态
 *
 * @example
 * const [count, setCount] = usePersistedState('my-config', 'count', 0);
 * const [count, setCount] = usePersistedState('my-config', 'count', () => 0);
 */
export function usePersistedState<T>(
  storeKey: string,
  fieldKey: string,
  initialValue: T | (() => T | Promise<T>),
  debounceDelay: number = 500,
): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(() => {
    if (typeof initialValue === 'function') {
      const result = (initialValue as () => T | Promise<T>)();
      return result instanceof Promise ? (undefined as T) : result;
    }
    return initialValue;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedFromStore, setHasLoadedFromStore] = useState(false);

  // 防抖
  const [debouncedValue] = useDebounceValue(value, debounceDelay);

  // 初始化：加载保存的配置或异步初始值
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 先尝试加载保存的配置
        const result = await window.api.storeGet(storeKey);
        if (result.success && result.value) {
          const savedConfig = result.value as Record<string, unknown>;
          // 如果有保存的值，使用保存的值
          if (fieldKey in savedConfig) {
            setValue(savedConfig[fieldKey] as T);
            setHasLoadedFromStore(true);
            setIsLoading(false);
            return;
          }
        }

        // 如果没有保存的值，且 initialValue 是异步函数，执行它
        if (typeof initialValue === 'function') {
          const result = (initialValue as () => T | Promise<T>)();
          if (result instanceof Promise) {
            const asyncValue = await result;
            setValue(asyncValue);
          }
        }
      } catch {
        // 加载失败时静默处理
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey, fieldKey]);

  // 自动保存配置（防抖）
  useEffect(() => {
    // 跳过初始加载时的保存
    if (isLoading) return;

    // 如果值从未从存储中加载过，且等于初始值，则不保存
    // 这避免了在初始化时保存默认值，但允许用户主动改回默认值后保存
    if (!hasLoadedFromStore && debouncedValue === initialValue) return;

    // 读取现有配置，合并更新
    const saveConfig = async () => {
      // 等待同一 storeKey 的其他保存操作完成
      while (savingLocks.has(storeKey)) {
        await savingLocks.get(storeKey);
      }

      // 创建当前保存操作的 Promise
      let resolveLock: () => void;
      const lockPromise = new Promise<void>((resolve) => {
        resolveLock = resolve;
      });
      savingLocks.set(storeKey, lockPromise);

      try {
        const result = await window.api.storeGet(storeKey);
        const existingConfig = (result.success && result.value) || {};
        await window.api.storeSet(storeKey, {
          ...existingConfig,
          [fieldKey]: debouncedValue,
        });
      } catch {
        // 保存失败时静默处理
      } finally {
        // 释放锁
        savingLocks.delete(storeKey);
        resolveLock!();
      }
    };

    saveConfig();
  }, [debouncedValue, storeKey, fieldKey, isLoading, hasLoadedFromStore, initialValue]);

  return [value, setValue, isLoading];
}
