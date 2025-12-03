import { useState } from 'react';
import type { LogEntry } from '@shared/types/common';
import type { TelegramDownloadMode } from '@shared/types/telegram-download';
import { useToolMeta } from '@renderer/hooks/use-tool-meta';

import { LogDisplay } from '@renderer/components/log-display';
import { Button } from '@renderer/components/base/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/base/card';
import { Input } from '@renderer/components/base/input';
import { Label } from '@renderer/components/base/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/base/dialog';
import Select from '@renderer/components/ui/select';
import { usePersistedState } from '@renderer/hooks/use-persisted-state';
import { SettingsIcon } from 'lucide-react';

export default function TelegramDownload() {
  const toolMeta = useToolMeta('telegram-download');

  const [apiId, setApiId] = usePersistedState('telegram-download', 'apiId', '');
  const [apiHash, setApiHash] = usePersistedState('telegram-download', 'apiHash', '');

  const [mode, setMode] = useState<TelegramDownloadMode>('bot');
  const [url, setUrl] = useState('');
  const [outputPath, setOutputPath] = usePersistedState(
    'telegram-download',
    'outputPath',
    async () => (await window.api.getDownloadsPath()) || '',
  );
  const [maxPages, setMaxPages] = usePersistedState('telegram-download', 'maxPages', '100');
  const [startFrom, setStartFrom] = useState('1');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 用户输入对话框状态
  const [inputDialogOpen, setInputDialogOpen] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [userInput, setUserInput] = useState('');

  // API 配置对话框状态
  const [apiConfigDialogOpen, setApiConfigDialogOpen] = useState(false);

  const addLog = (message: string) => {
    setLogs((prev) => {
      // 检查是否是进度更新
      const isProgress = message.startsWith('__PROGRESS__');
      const cleanMessage = isProgress ? message.replace('__PROGRESS__', '') : message;

      if (isProgress) {
        // 如果上一条日志也是进度，则替换它（通过检查是否包含进度条特征）
        if (prev.length > 0) {
          const lastMsg = prev[prev.length - 1].message;
          const lastIsProgress = lastMsg.includes('[') && lastMsg.includes(']') && lastMsg.includes('%');

          if (lastIsProgress) {
            return [...prev.slice(0, -1), { id: `${Date.now()}-${Math.random()}`, message: cleanMessage }];
          }
        }

        // 第一条进度日志
        return [...prev, { id: `${Date.now()}-${Math.random()}`, message: cleanMessage }];
      }

      // 普通日志，直接添加
      return [...prev, { id: `${Date.now()}-${Math.random()}`, message: cleanMessage }];
    });
  };

  const handleSelectDownloadPath = async () => {
    try {
      const result = await window.api.openDirectory();
      if (!result.canceled && result.filePaths[0]) {
        setOutputPath(result.filePaths[0]);
      }
    } catch (error) {
      addLog(`❌ 选择目录失败: ${error}`);
    }
  };

  const handleStartDownload = async () => {
    if (!url) {
      addLog('错误：请填写链接');
      return;
    }

    // 检查是否已配置 API
    if (!apiId || !apiHash) {
      addLog('⚠️ 请先配置 Telegram API ID 和 API Hash');
      setApiConfigDialogOpen(true);
      return;
    }

    setIsProcessing(true);
    setLogs([]);

    try {
      // 注册进度监听
      const unsubscribeProgress = window.api.onTelegramDownloadProgress((message) => {
        addLog(message);
      });

      // 注册输入请求监听
      const unsubscribeInput = window.api.onUserInputRequired((prompt, source) => {
        if (source === 'telegram-download') {
          setInputPrompt(prompt);
          setUserInput('');
          setInputDialogOpen(true);
        }
      });

      const result = await window.api.telegramDownload({
        mode,
        apiId,
        apiHash,
        url,
        outputPath,
        maxPages,
        startFrom,
      });

      // 清理监听
      unsubscribeProgress();
      unsubscribeInput();

      if (!result.success) {
        addLog(`❌ 下载失败: ${result.error}`);
      }
    } catch (error) {
      addLog(`❌ 错误: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputSubmit = async () => {
    setInputDialogOpen(false);
    await window.api.userInputResponse(userInput);
  };

  const handleInputCancel = async () => {
    setInputDialogOpen(false);
    await window.api.userInputResponse(null);
    addLog('❌ 用户取消输入');
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">{toolMeta.name}</h1>
        <p className="text-muted-foreground">{toolMeta.description}</p>
      </div>

      <div className="grid gap-6">
        {/* API 配置卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>API 配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Telegram API 凭证</Label>
                  {apiId && apiHash ? (
                    <p className="text-muted-foreground text-sm">✅ 已配置 API ID 和 API Hash</p>
                  ) : (
                    <p className="text-muted-foreground text-sm">⚠️ 请先配置 API ID 和 API Hash</p>
                  )}
                </div>
                <Button variant="outline" onClick={() => setApiConfigDialogOpen(true)} disabled={isProcessing}>
                  <SettingsIcon className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 下载配置卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>下载配置</CardTitle>
            <CardDescription>设置下载参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mode">下载模式 *</Label>
              <Select
                value={mode}
                onValueChange={(value) => setMode(value as TelegramDownloadMode)}
                options={[
                  { value: 'bot', label: 'Bot 深链下载' },
                  { value: 'channel-comments', label: '频道评论下载' },
                  { value: 'topic', label: '话题下载' },
                ]}
                placeholder="选择下载模式"
                disabled={isProcessing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Telegram 链接 *</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  mode === 'bot'
                    ? 'https://t.me/username?start=参数'
                    : mode === 'channel-comments'
                      ? 'https://t.me/ChannelUsername/MessageID'
                      : 'https://t.me/ChannelUsername/TopicID'
                }
                disabled={isProcessing}
              />
            </div>

            {/* 下载目录 */}
            <div className="space-y-2">
              <Label htmlFor="outputPath">下载目录</Label>
              <div className="flex gap-2">
                <Input
                  id="outputPath"
                  value={outputPath}
                  readOnly
                  placeholder="默认为系统下载文件夹"
                  className="flex-1"
                />
                <Button onClick={handleSelectDownloadPath} disabled={isProcessing}>
                  选择目录
                </Button>
              </div>
            </div>

            {/* 最大翻页次数 - 仅 Bot 模式 */}
            {mode === 'bot' && (
              <div className="space-y-2">
                <Label htmlFor="maxPages">最大翻页次数</Label>
                <Input
                  id="maxPages"
                  type="number"
                  min="0"
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  disabled={isProcessing}
                  className="w-32"
                />
                <p className="text-muted-foreground text-sm">设为 0 表示不限制</p>
              </div>
            )}

            {/* 起始位置 - 仅频道评论模式 */}
            {mode === 'channel-comments' && (
              <div className="space-y-2">
                <Label htmlFor="startFrom">从第几个资源开始下载</Label>
                <Input
                  id="startFrom"
                  type="number"
                  min="1"
                  value={startFrom}
                  onChange={(e) => setStartFrom(e.target.value)}
                  disabled={isProcessing}
                  className="w-32"
                />
                <p className="text-muted-foreground text-sm">默认从第 1 个资源开始</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 执行卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>执行</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleStartDownload} disabled={isProcessing || !url} className="w-full">
              {isProcessing ? '下载中...' : '开始下载'}
            </Button>

            <LogDisplay logs={logs} />
          </CardContent>
        </Card>
      </div>

      {/* 用户输入对话框 */}
      <Dialog open={inputDialogOpen} onOpenChange={setInputDialogOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Telegram 登录</DialogTitle>
            <DialogDescription>{inputPrompt}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="请输入..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInputSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleInputCancel}>
              取消
            </Button>
            <Button onClick={handleInputSubmit}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API 配置对话框 */}
      <Dialog open={apiConfigDialogOpen} onOpenChange={setApiConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>配置 Telegram API</DialogTitle>
            <DialogDescription>
              请访问
              <a
                href="https://my.telegram.org/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                https://my.telegram.org/apps
              </a>
              获取您的 API ID 和 API Hash
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiId">API ID *</Label>
              <Input
                id="apiId"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                placeholder="例如：12345678"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiHash">API Hash *</Label>
              <Input
                id="apiHash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                placeholder="例如：0123456789abcdef0123456789abcdef"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiConfigDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (apiId && apiHash) {
                  setApiConfigDialogOpen(false);
                  addLog('✅ API 配置已保存');
                } else {
                  addLog('❌ 请填写完整的 API ID 和 API Hash');
                }
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
