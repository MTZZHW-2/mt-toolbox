import { useState } from 'react';
import { useToolMeta } from '@renderer/hooks/use-tool-meta';
import type { LogEntry } from '@shared/types/common';

import { Checkbox } from '@renderer/components/ui/checkbox';
import { LogDisplay } from '@renderer/components/log-display';
import { Button } from '@renderer/components/base/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/base/card';
import { Input } from '@renderer/components/base/input';
import { Label } from '@renderer/components/base/label';
import { usePersistedState } from '@renderer/hooks/use-persisted-state';

export default function VideoDeduplication() {
  const toolMeta = useToolMeta('video-deduplication');

  const [sourceDir, setSourceDir] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = usePersistedState(
    'video-deduplication',
    'similarityThreshold',
    '20',
  );
  const [autoDelete, setAutoDelete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, message }]);
  };

  const handleSelectSourceDir = async () => {
    try {
      const result = await window.api.openDirectory();
      if (!result.canceled && result.filePaths[0]) {
        setSourceDir(result.filePaths[0]);
      }
    } catch (error) {
      addLog(`❌ 选择目录失败: ${error}`);
    }
  };

  const handleStartDeduplication = async () => {
    if (!sourceDir) {
      addLog('错误：请选择源视频目录');
      return;
    }

    setIsProcessing(true);
    setLogs([]);

    try {
      // 注册进度监听
      const unsubscribe = window.api.onVideoDeduplicationProgress((message) => {
        addLog(message);
      });

      const result = await window.api.videoDeduplication({
        sourceDir,
        similarityThreshold: parseInt(similarityThreshold) || 5,
        autoDelete,
      });

      // 清理监听
      unsubscribe();

      if (result.success) {
        addLog('✅ 查重完成！');
      } else {
        addLog(`❌ 查重失败: ${result.error}`);
      }
    } catch (error) {
      addLog(`❌ 错误: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{toolMeta.name}</h1>
        <p className="text-muted-foreground">{toolMeta.description}</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>配置</CardTitle>
            <CardDescription>设置查重参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 源目录 */}
            <div className="space-y-2">
              <Label htmlFor="sourceDir">源视频目录 *</Label>
              <div className="flex gap-2">
                <Input id="sourceDir" value={sourceDir} readOnly placeholder="选择包含视频的目录" className="flex-1" />
                <Button onClick={handleSelectSourceDir} disabled={isProcessing}>
                  选择目录
                </Button>
              </div>
            </div>

            {/* 相似度阈值 */}
            <div className="space-y-2">
              <Label htmlFor="threshold">相似度阈值</Label>
              <Input
                id="threshold"
                type="number"
                min="0"
                max="30"
                value={similarityThreshold}
                onChange={(e) => setSimilarityThreshold(e.target.value)}
                disabled={isProcessing}
                className="w-32"
              />
              <p className="text-muted-foreground text-sm">数值越小越严格（0-30），默认为 20</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>执行</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="autoDelete" checked={autoDelete} onCheckedChange={setAutoDelete} />
              <Label htmlFor="autoDelete">自动去重</Label>
            </div>

            <Button onClick={handleStartDeduplication} disabled={isProcessing || !sourceDir} className="w-full">
              {isProcessing ? '正在处理...' : '开始查重'}
            </Button>

            <LogDisplay logs={logs} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
