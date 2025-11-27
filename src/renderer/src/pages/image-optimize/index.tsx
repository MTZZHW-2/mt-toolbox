import { useState } from 'react';
import type { LogEntry } from '@shared/types/common';
import { useToolMeta } from '@renderer/hooks/use-tool-meta';

import { LogDisplay } from '@renderer/components/log-display';
import { Button } from '@renderer/components/base/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/base/card';
import { Input } from '@renderer/components/base/input';
import { Label } from '@renderer/components/base/label';
import Select from '@renderer/components/ui/select';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { usePersistedState } from '@renderer/hooks/use-persisted-state';

export default function ImageOptimize() {
  const toolMeta = useToolMeta('image-optimize');

  const [sourceDir, setSourceDir] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [quality, setQuality] = usePersistedState('image-optimize', 'quality', '80');
  const [maxWidth, setMaxWidth] = usePersistedState('image-optimize', 'maxWidth', '');
  const [maxHeight, setMaxHeight] = usePersistedState('image-optimize', 'maxHeight', '');
  const [format, setFormat] = usePersistedState<'jpeg' | 'png' | 'webp'>('image-optimize', 'format', 'jpeg');
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [useCustomOutput, setUseCustomOutput] = useState(false);
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

  const handleSelectOutputDir = async () => {
    try {
      const result = await window.api.openDirectory();
      if (!result.canceled && result.filePaths[0]) {
        setOutputDir(result.filePaths[0]);
      }
    } catch (error) {
      addLog(`❌ 选择目录失败: ${error}`);
    }
  };

  const handleStartOptimize = async () => {
    if (!sourceDir) {
      addLog('错误：请选择源图片目录');
      return;
    }

    const qualityNum = parseInt(quality);
    if (isNaN(qualityNum) || qualityNum < 1 || qualityNum > 100) {
      addLog('错误：质量必须在 1-100 之间');
      return;
    }

    setIsProcessing(true);
    setLogs([]);

    try {
      // 注册进度监听
      const unsubscribe = window.api.onImageOptimizeProgress((message) => {
        addLog(message);
      });

      const result = await window.api.imageOptimize({
        sourceDir,
        outputDir: useCustomOutput && outputDir ? outputDir : undefined,
        quality: qualityNum,
        maxWidth: maxWidth ? parseInt(maxWidth) : undefined,
        maxHeight: maxHeight ? parseInt(maxHeight) : undefined,
        format,
        keepOriginal,
      });

      unsubscribe();

      if (result.success) {
        addLog(`\n✨ ${result.summary}`);
      } else {
        addLog(`\n❌ 压缩失败: ${result.error}`);
      }
    } catch (error) {
      addLog(`\n❌ 压缩出错: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{toolMeta.name}</h1>
          <p className="text-muted-foreground mt-1">{toolMeta.description}</p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-4 overflow-hidden">
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* 目录选择 */}
          <Card>
            <CardHeader>
              <CardTitle>目录设置</CardTitle>
              <CardDescription>选择要处理的图片目录</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>源图片目录</Label>
                <div className="flex gap-2">
                  <Input value={sourceDir} readOnly placeholder="点击选择目录" className="flex-1" />
                  <Button onClick={handleSelectSourceDir} disabled={isProcessing}>
                    选择
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="useCustomOutput"
                  checked={useCustomOutput}
                  onCheckedChange={setUseCustomOutput}
                  disabled={isProcessing}
                />
                <Label htmlFor="useCustomOutput" className="cursor-pointer">
                  使用自定义输出目录
                </Label>
              </div>

              {useCustomOutput && (
                <div className="space-y-2">
                  <Label>输出目录</Label>
                  <div className="flex gap-2">
                    <Input value={outputDir} readOnly placeholder="点击选择目录" className="flex-1" />
                    <Button onClick={handleSelectOutputDir} disabled={isProcessing}>
                      选择
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-sm">留空则输出到源目录下的 optimized 文件夹</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 压缩设置 */}
          <Card>
            <CardHeader>
              <CardTitle>压缩设置</CardTitle>
              <CardDescription>配置图片压缩参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>输出格式</Label>
                <Select
                  value={format}
                  onValueChange={setFormat}
                  options={[
                    { label: 'JPEG', value: 'jpeg' },
                    { label: 'PNG', value: 'png' },
                    { label: 'WebP', value: 'webp' },
                  ]}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label>压缩质量 (1-100)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  placeholder="80"
                  disabled={isProcessing}
                />
                <p className="text-muted-foreground text-sm">数值越高，质量越好，文件越大</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>最大宽度 (可选)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={maxWidth}
                    onChange={(e) => setMaxWidth(e.target.value)}
                    placeholder="不限制"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最大高度 (可选)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={maxHeight}
                    onChange={(e) => setMaxHeight(e.target.value)}
                    placeholder="不限制"
                    disabled={isProcessing}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-sm">超过限制的图片将按比例缩小</p>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="keepOriginal"
                  checked={keepOriginal}
                  onCheckedChange={setKeepOriginal}
                  disabled={isProcessing}
                />
                <Label htmlFor="keepOriginal" className="cursor-pointer">
                  保留原始文件
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button onClick={handleStartOptimize} disabled={isProcessing || !sourceDir} className="flex-1">
              {isProcessing ? '压缩中...' : '开始压缩'}
            </Button>
          </div>
        </div>

        {/* 日志输出 */}
        <div className="flex flex-col overflow-hidden">
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>压缩日志</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <LogDisplay logs={logs} maxHeight="h-auto" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
