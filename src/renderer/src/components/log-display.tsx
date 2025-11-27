import { useEffect, useRef } from 'react';
import type { LogEntry } from '@shared/types/common';

interface LogDisplayProps {
  logs: LogEntry[];
  maxHeight?: string;
}

export function LogDisplay({ logs, maxHeight = 'max-h-96' }: LogDisplayProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) {
    return null;
  }

  return (
    <div className={`bg-muted ${maxHeight} overflow-y-auto rounded-md p-4`}>
      <div className="space-y-1 font-mono text-sm">
        {logs.map((log) => (
          <div key={log.id}>{log.message}</div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
