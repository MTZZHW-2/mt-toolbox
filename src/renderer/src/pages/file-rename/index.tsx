import { useState, useEffect } from 'react';
import type { RenameMode, RenameRule } from '@shared/types/file-rename';
import type { LogEntry } from '@shared/types/common';
import { useToolMeta } from '@renderer/hooks/use-tool-meta';

import { Checkbox } from '@renderer/components/ui/checkbox';
import { LogDisplay } from '@renderer/components/log-display';
import { Button } from '@renderer/components/base/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/base/card';
import { Input } from '@renderer/components/base/input';
import { Label } from '@renderer/components/base/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/base/select';
import { Badge } from '@renderer/components/base/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@renderer/components/base/dialog';
import { usePersistedState } from '@renderer/hooks/use-persisted-state';

export default function FileRename() {
  const toolMeta = useToolMeta('file-rename');

  const [srcDir, setSrcDir] = useState('');
  const [rules, setRules] = usePersistedState<RenameRule[]>('file-rename', 'rules', []);
  const [dryRun, setDryRun] = useState(false);

  // Dialog 状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // 当前正在添加/编辑的规则
  const [currentMode, setCurrentMode] = useState<RenameMode>('number');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const [ignoreExtension, setIgnoreExtension] = useState(true);
  const [numberStart, setNumberStart] = useState('1');
  const [numberPad, setNumberPad] = useState('auto');
  const [autoPad, setAutoPad] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 当取消自动推断时，设置默认填充位数
  useEffect(() => {
    if (!autoPad && numberPad === 'auto') {
      setNumberPad('3');
    }
  }, [autoPad, numberPad]);

  const handleSelectSrcDir = async () => {
    const result = await window.api.openDirectory();
    if (result && !result.canceled) {
      setSrcDir(result.filePaths[0]);
    }
  };

  const resetDialogState = () => {
    setCurrentMode('number');
    setNumberStart('1');
    setNumberPad('auto');
    setAutoPad(true);
    setPrefix('');
    setSuffix('');
    setPattern('');
    setReplacement('');
    setIgnoreExtension(true);
    setEditingRuleId(null);
    setDialogOpen(false);
  };

  const handleAddRule = () => {
    // 验证必填字段
    if (currentMode === 'prefix' && !prefix) {
      return;
    }
    if (currentMode === 'suffix' && !suffix) {
      return;
    }
    if (currentMode === 'replace' && !pattern) {
      return;
    }

    const ruleConfig = {
      prefix: currentMode === 'prefix' ? prefix : undefined,
      suffix: currentMode === 'suffix' ? suffix : undefined,
      startNumber: currentMode === 'number' ? parseInt(numberStart) : undefined,
      padLength: currentMode === 'number' ? (autoPad ? undefined : parseInt(numberPad)) : undefined,
      pattern: currentMode === 'replace' ? pattern : undefined,
      replacement: currentMode === 'replace' ? replacement : undefined,
      ignoreExtension: currentMode === 'replace' ? ignoreExtension : undefined,
    };

    if (editingRuleId) {
      // 编辑模式：更新现有规则
      setRules(
        rules.map((rule) => (rule.id === editingRuleId ? { ...rule, type: currentMode, config: ruleConfig } : rule)),
      );
    } else {
      // 添加模式：创建新规则
      const newRule: RenameRule = {
        id: Date.now().toString(),
        type: currentMode,
        enabled: true,
        config: ruleConfig,
      };
      setRules([...rules, newRule]);
    }

    // 清空输入并关闭对话框
    resetDialogState();
  };

  const handleEditRule = (rule: RenameRule) => {
    // 设置编辑状态
    setEditingRuleId(rule.id);
    setCurrentMode(rule.type);

    // 根据规则类型设置对应的值
    if (rule.type === 'prefix' && rule.config.prefix) {
      setPrefix(rule.config.prefix);
    } else if (rule.type === 'suffix' && rule.config.suffix) {
      setSuffix(rule.config.suffix);
    } else if (rule.type === 'replace') {
      setPattern(rule.config.pattern || '');
      setReplacement(rule.config.replacement || '');
      setIgnoreExtension(rule.config.ignoreExtension ?? true);
    } else if (rule.type === 'number') {
      setNumberStart(String(rule.config.startNumber || 1));
      if (rule.config.padLength) {
        setAutoPad(false);
        setNumberPad(String(rule.config.padLength));
      } else {
        setAutoPad(true);
        setNumberPad('auto');
      }
    }

    // 打开对话框
    setDialogOpen(true);
  };

  const handleRemoveRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const handleToggleRule = (id: string) => {
    setRules(rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  };

  const handleClearRules = () => {
    setRules([]);
  };

  const getRuleDescription = (rule: RenameRule): string => {
    switch (rule.type) {
      case 'prefix':
        return `前缀: ${rule.config.prefix}`;
      case 'suffix':
        return `后缀: ${rule.config.suffix}`;
      case 'replace': {
        const patt = rule.config.pattern ?? '';
        const repl = rule.config.replacement ?? '';
        const extra = rule.config.ignoreExtension === false ? '（包含扩展名）' : '（忽略扩展名）';
        return `替换: 「${patt}」→「${repl}」${extra}`;
      }
      case 'number': {
        const padDesc = rule.config.padLength ? `${rule.config.padLength} 位` : '自动';
        return `数字序号，起始: ${rule.config.startNumber}，填充: ${padDesc}`;
      }
    }
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, message }]);
  };

  const handleRename = async () => {
    if (!srcDir) {
      addLog('错误：请选择源文件目录');
      return;
    }

    if (rules.length === 0) {
      addLog('错误：请至少添加一个重命名规则');
      return;
    }

    // 过滤出已启用的规则
    const enabledRules = rules.filter((rule) => rule.enabled);

    if (enabledRules.length === 0) {
      addLog('错误：请至少启用一个重命名规则');
      return;
    }

    setIsProcessing(true);
    setLogs([]);

    try {
      // 注册进度监听
      const unsubscribe = window.api.onFileRenameProgress((message) => {
        addLog(message);
      });

      const result = await window.api.fileRename({
        directory: srcDir,
        rules: enabledRules,
        dryRun,
      });

      // 等待一小段时间确保所有进度消息都已接收
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 清理监听
      unsubscribe();

      if (!result.success) {
        addLog(`❌ 重命名失败: ${result.error}`);
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
            <CardTitle>基本配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="srcDir">源文件目录 *</Label>
              <div className="flex gap-2">
                <Input id="srcDir" placeholder="选择源目录" value={srcDir} readOnly />
                <Button type="button" variant="outline" onClick={handleSelectSrcDir}>
                  选择目录
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>重命名规则</CardTitle>
            <CardDescription>添加多个规则，将按顺序执行</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 已添加的规则列表 */}
            {rules.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>规则</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={handleClearRules}>
                    清空全部
                  </Button>
                </div>
                <div className="bg-muted space-y-2 rounded-md p-3">
                  {rules.map((rule, index) => (
                    <div key={rule.id} className="bg-background flex items-center justify-between rounded p-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`rule-${rule.id}`}
                          checked={rule.enabled}
                          onCheckedChange={() => handleToggleRule(rule.id)}
                        />
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className={`text-sm ${!rule.enabled ? 'text-muted-foreground line-through' : ''}`}>
                          {getRuleDescription(rule)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                          编辑
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveRule(rule.id)}>
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-muted rounded-md p-8 text-center">
                <p className="text-muted-foreground text-sm">还没有添加任何规则</p>
              </div>
            )}

            {/* 添加新规则按钮 */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="w-full">
                  + 添加规则
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingRuleId ? '编辑重命名规则' : '添加重命名规则'}</DialogTitle>
                  <DialogDescription>选择规则类型并配置参数</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>规则类型</Label>
                    <Select value={currentMode} onValueChange={(v) => setCurrentMode(v as RenameMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">数字序号</SelectItem>
                        <SelectItem value="prefix">添加前缀</SelectItem>
                        <SelectItem value="suffix">添加后缀</SelectItem>
                        <SelectItem value="replace">替换</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {currentMode === 'prefix' && (
                    <div className="space-y-2">
                      <Label htmlFor="prefix">前缀 *</Label>
                      <Input
                        id="prefix"
                        placeholder="如: IMG_、2024_"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                      />
                    </div>
                  )}

                  {currentMode === 'suffix' && (
                    <div className="space-y-2">
                      <Label htmlFor="suffix">后缀 *</Label>
                      <Input
                        id="suffix"
                        placeholder="如: _backup、_v2"
                        value={suffix}
                        onChange={(e) => setSuffix(e.target.value)}
                      />
                    </div>
                  )}

                  {currentMode === 'number' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="numberStart">起始序号</Label>
                        <Input
                          id="numberStart"
                          type="number"
                          value={numberStart}
                          onChange={(e) => setNumberStart(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox id="autoPad" checked={autoPad} onCheckedChange={setAutoPad} />
                        <Label htmlFor="autoPad">自动推断填充位数</Label>
                      </div>

                      {!autoPad && (
                        <div className="space-y-2">
                          <Label htmlFor="numberPad">填充位数</Label>
                          <Input
                            id="numberPad"
                            type="number"
                            min="1"
                            max="10"
                            value={numberPad}
                            onChange={(e) => setNumberPad(e.target.value)}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {currentMode === 'replace' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="pattern">匹配内容（纯文本） *</Label>
                        <Input
                          id="pattern"
                          placeholder="要查找的文本"
                          value={pattern}
                          onChange={(e) => setPattern(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="replacement">替换为</Label>
                        <Input
                          id="replacement"
                          placeholder="替换后的文本"
                          value={replacement}
                          onChange={(e) => setReplacement(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="ignoreExt" checked={ignoreExtension} onCheckedChange={setIgnoreExtension} />
                        <Label htmlFor="ignoreExt">忽略扩展名</Label>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetDialogState}>
                    取消
                  </Button>
                  <Button type="button" onClick={handleAddRule}>
                    {editingRuleId ? '保存' : '添加'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>执行选项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="dryRun" checked={dryRun} onCheckedChange={setDryRun} />
              <Label htmlFor="dryRun">仅预览</Label>
            </div>

            <Button onClick={handleRename} disabled={isProcessing} className="w-full">
              {isProcessing ? '处理中...' : dryRun ? '预览重命名' : '开始重命名'}
            </Button>

            <LogDisplay logs={logs} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
