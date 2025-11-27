import { useState } from 'react';
import type { LogEntry } from '@shared/types/common';
import { useToolMeta } from '@renderer/hooks/use-tool-meta';

import { Button } from '@renderer/components/base/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/base/card';
import { Input } from '@renderer/components/base/input';
import { Label } from '@renderer/components/base/label';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { usePersistedState } from '@renderer/hooks/use-persisted-state';

export default function TwitterMediaDownload() {
  const toolMeta = useToolMeta('twitter-download');

  const [username, setUsername] = useState('');
  const [cookies, setCookies] = usePersistedState('twitter-download', 'cookies', '');
  const [downloadPath, setDownloadPath] = usePersistedState(
    'twitter-download',
    'downloadPath',
    async () => (await window.api.getDownloadsPath()) || '',
  );
  const [includeRetweets, setIncludeRetweets] = usePersistedState('twitter-download', 'includeRetweets', false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const handleSelectDownloadPath = async () => {
    const result = await window.api.openDirectory();
    if (result && !result.canceled) {
      setDownloadPath(result.filePaths[0]);
    }
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, message }]);
  };

  const handleDownload = async () => {
    if (!username) {
      addLog('错误：请填写 Twitter 用户名');
      return;
    }

    if (!cookies) {
      addLog('错误：请填写 Twitter Cookies');
      return;
    }

    setIsDownloading(true);
    setLogs([]);

    try {
      // 注册进度监听
      const unsubscribe = window.api.onTwitterDownloadProgress((message) => {
        addLog(message);
      });

      const result = await window.api.twitterDownload({
        username,
        cookies,
        downloadPath: downloadPath || undefined,
        includeRetweets,
      });

      if (result.success) {
        addLog('✅ 下载完成！');
        addLog(`总计: ${result.summary}`);
      } else {
        addLog(`❌ 下载失败: ${result.error}`);
      }

      // 清理监听
      unsubscribe();
    } catch (error) {
      addLog(`❌ 错误: ${error}`);
    } finally {
      setIsDownloading(false);
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
            <CardDescription>设置下载参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Twitter 用户名 *</Label>
              <Input
                id="username"
                placeholder="例如: elonmusk"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cookies">Twitter Cookies *</Label>
              <Input
                id="cookies"
                placeholder="粘贴完整的 Cookie 字符串"
                value={cookies}
                onChange={(e) => setCookies(e.target.value)}
              />
              <p className="text-muted-foreground text-sm">从浏览器开发者工具中复制完整的 Cookie 字符串</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="downloadPath">下载目录</Label>
              <div className="flex gap-2">
                <Input id="downloadPath" placeholder="选择下载目录" value={downloadPath} readOnly />
                <Button type="button" variant="outline" onClick={handleSelectDownloadPath}>
                  选择目录
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">默认为系统下载文件夹</p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="includeRetweets" checked={includeRetweets} onCheckedChange={setIncludeRetweets} />
              <Label htmlFor="includeRetweets">包含转推内容</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>执行</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleDownload} disabled={isDownloading} className="w-full">
              {isDownloading ? '下载中...' : '开始下载'}
            </Button>

            {logs.length > 0 && (
              <div className="bg-muted max-h-96 overflow-y-auto rounded-md p-4">
                <div className="space-y-1 font-mono text-sm">
                  {logs.map((log) => (
                    <div key={log.id}>{log.message}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
