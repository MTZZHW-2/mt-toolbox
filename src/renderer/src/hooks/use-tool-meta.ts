import { useMemo } from 'react';
import type { ToolItem } from '@renderer/pages/tools.config';
import { toolCategories } from '@renderer/pages/tools.config';

export function useToolMeta(toolId: string): Pick<ToolItem, 'name' | 'description'> {
  return useMemo(() => {
    const currentTool = toolCategories.flatMap((category) => category.tools).find((tool) => tool.id === toolId);
    return { name: currentTool!.name, description: currentTool!.description };
  }, [toolId]);
}
