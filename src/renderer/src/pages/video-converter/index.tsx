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

export default function VideoConverter() {
  const toolMeta = useToolMeta('video-converter');

  const [sourceDir, setSourceDir] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [outputFormat, setOutputFormat] = usePersistedState('video-converter', 'outputFormat', 'mp4');
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

  const handleStartConversion = async () => {
    if (!sourceDir) {
      addLog('错误：请选择源视频目录');
      return;
    }

    setIsProcessing(true);
    setLogs([]);

    try {
      // 注册进度监听
      const unsubscribe = window.api.onVideoConverterProgress((message) => {
        addLog(message);
      });

      const result = await window.api.videoConverter({
        sourceDir,
        outputFormat: outputFormat as 'mp4' | 'avi' | 'mov',
        outputDir: useCustomOutput && outputDir ? outputDir : undefined,
      });

      // 清理监听
      unsubscribe();

      if (result.success) {
        addLog('✅ 转换完成！');
      } else {
        addLog(`❌ 转换失败: ${result.error}`);
      }
    } catch (error) {
      addLog(`❌ 错误: ${error}`);
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
              <CardDescription>选择要处理的视频目录</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>源视频目录</Label>
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
                  <p className="text-muted-foreground text-sm">留空则输出到源目录下的 converted 文件夹</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 转换设置 */}
          <Card>
            <CardHeader>
              <CardTitle>转换设置</CardTitle>
              <CardDescription>配置视频格式参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>输出格式</Label>
                <Select
                  value={outputFormat}
                  onValueChange={setOutputFormat}
                  options={[
                    { label: 'MP4', value: 'mp4' },
                    { label: 'AVI', value: 'avi' },
                    { label: 'MOV', value: 'mov' },
                  ]}
                  disabled={isProcessing}
                />
                <p className="text-muted-foreground text-sm">系统将自动选择最佳编解码器和参数</p>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button onClick={handleStartConversion} disabled={isProcessing || !sourceDir} className="flex-1">
              {isProcessing ? '转换中...' : '开始转换'}
            </Button>
          </div>
        </div>

        {/* 日志输出 */}
        <div className="flex flex-col overflow-hidden">
          <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <CardTitle>转换日志</CardTitle>
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
