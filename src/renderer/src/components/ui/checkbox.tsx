import * as React from 'react';

import { Checkbox as BaseCheckbox } from '@renderer/components/base/checkbox';

export interface CheckboxProps extends Omit<React.ComponentProps<typeof BaseCheckbox>, 'checked' | 'onCheckedChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<React.ElementRef<typeof BaseCheckbox>, CheckboxProps>(
  ({ checked, onCheckedChange, ...props }, ref) => {
    // 处理 onCheckedChange 回调，过滤掉 'indeterminate' 状态
    const handleCheckedChange = React.useCallback(
      (value: boolean | 'indeterminate') => {
        // 只接受 boolean 值，如果是 'indeterminate' 则忽略
        if (typeof value === 'boolean' && onCheckedChange) {
          onCheckedChange(value);
        }
      },
      [onCheckedChange],
    );

    return <BaseCheckbox ref={ref} checked={checked} onCheckedChange={handleCheckedChange} {...props} />;
  },
);
