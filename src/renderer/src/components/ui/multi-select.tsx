import React from 'react';
import type { ComponentProps } from 'react';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { XIcon, SearchIcon } from 'lucide-react';
import { cn } from '@renderer/lib/classnames';
import { Select as BaseSelect, SelectContent, SelectGroup, SelectLabel, SelectTrigger } from '../base/select';
import { Badge } from '../base/badge';
import { Input } from '../base/input';

type OptionType = {
  label?: string;
  value: string;
  disabled?: boolean;
};

type GroupOptionType = {
  label: string;
  options: OptionType[];
};

type MultiSelectProps = Omit<ComponentProps<typeof BaseSelect>, 'value' | 'onValueChange' | 'defaultValue'> & {
  id?: string;
  options: (OptionType | GroupOptionType)[];
  placeholder?: string;
  className?: string;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  maxDisplay?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  autoClose?: boolean;
};

const MultiSelect: React.FC<MultiSelectProps> = ({
  id,
  options,
  placeholder = '请选择',
  className,
  value,
  defaultValue = [],
  onValueChange,
  maxDisplay = 3,
  searchable = true,
  searchPlaceholder = '搜索选项...',
  autoClose = false,
  ...props
}) => {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 判断是否为受控组件
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // 当下拉菜单打开且支持搜索时，自动聚焦到输入框
  useEffect(() => {
    if (open && searchable && searchInputRef.current) {
      // 使用 setTimeout 确保 DOM 已经渲染
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [open, searchable]);

  const handleSelect = useCallback(
    (selectedValue: string) => {
      const newValue = currentValue.includes(selectedValue)
        ? currentValue.filter((v) => v !== selectedValue)
        : [...currentValue, selectedValue];

      if (isControlled) {
        onValueChange?.(newValue);
      } else {
        setInternalValue(newValue);
        onValueChange?.(newValue);
      }

      // 如果启用了自动收起功能，选中后自动收起下拉框
      if (autoClose) {
        setOpen(false);
        setSearchQuery('');
      }
    },
    [currentValue, isControlled, onValueChange, autoClose],
  );

  const handleRemove = useCallback(
    (valueToRemove: string, event: React.MouseEvent | React.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const newValue = currentValue.filter((v) => v !== valueToRemove);

      if (isControlled) {
        onValueChange?.(newValue);
      } else {
        setInternalValue(newValue);
        onValueChange?.(newValue);
      }
    },
    [currentValue, isControlled, onValueChange],
  );

  const getOptionLabel = useCallback(
    (val: string) => {
      for (const group of options) {
        if ('options' in group) {
          const option = group.options.find((opt) => opt.value === val);
          if (option) return option.label || option.value;
        } else {
          if (group.value === val) return group.label || group.value;
        }
      }
      return val;
    },
    [options],
  );

  // 过滤选项的函数
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return options;
    }

    const query = searchQuery.toLowerCase();
    return options
      .map((group) => {
        if ('options' in group) {
          // 分组选项
          const filteredGroupOptions = group.options.filter((option) => {
            const label = (option.label || option.value).toLowerCase();
            return label.includes(query);
          });

          return filteredGroupOptions.length > 0 ? { ...group, options: filteredGroupOptions } : null;
        } else {
          // 单个选项
          const label = (group.label || group.value).toLowerCase();
          return label.includes(query) ? group : null;
        }
      })
      .filter(Boolean) as (OptionType | GroupOptionType)[];
  }, [options, searchQuery, searchable]);

  const renderValue = () => {
    if (currentValue.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    if (currentValue.length <= maxDisplay) {
      return (
        <div className="flex flex-wrap gap-1">
          {currentValue.map((val) => (
            <Badge key={val} variant="secondary" className="h-auto px-2 py-0.5 text-xs">
              {getOptionLabel(val)}
              <span
                role="button"
                tabIndex={0}
                className="hover:bg-secondary-foreground/20 ml-1 inline-flex cursor-pointer items-center justify-center rounded-full p-0.5"
                onClick={(e) => handleRemove(val, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRemove(val, e);
                  }
                }}
              >
                <XIcon className="h-3 w-3" />
              </span>
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        <Badge variant="secondary" className="h-auto px-2 py-0.5 text-xs">
          {currentValue.length} 项已选择
        </Badge>
      </div>
    );
  };

  return (
    <BaseSelect
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        // 当关闭下拉菜单时清空搜索
        if (!newOpen) {
          setSearchQuery('');
        }
      }}
      {...props}
    >
      <SelectTrigger id={id} className={cn(className)}>
        {renderValue()}
      </SelectTrigger>
      <SelectContent className={cn('max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto')}>
        {searchable && (
          <div className="border-border flex items-center border-b px-3 py-2">
            <SearchIcon className="text-muted-foreground mr-2 h-4 w-4" />
            <Input
              ref={searchInputRef}
              className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        {filteredOptions.length === 0 ? (
          <div className="text-muted-foreground px-2 py-6 text-center text-sm">
            {searchQuery ? '没有找到匹配的选项' : '暂无选项'}
          </div>
        ) : (
          filteredOptions.map((group) => (
            <SelectGroup key={`group-${'options' in group ? group.label : group.value}`} className="w-full">
              {'options' in group && <SelectLabel>{group.label}</SelectLabel>}
              {('options' in group ? group.options : [group]).map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    'hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none select-none',
                    'focus:bg-accent focus:text-accent-foreground',
                    currentValue.includes(option.value) && 'bg-accent text-accent-foreground',
                    option.disabled && 'pointer-events-none opacity-50',
                  )}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'border-border flex h-4 w-4 items-center justify-center rounded border',
                        currentValue.includes(option.value) && 'bg-primary border-primary',
                      )}
                    >
                      {currentValue.includes(option.value) && (
                        <div className="bg-primary-foreground h-2 w-2 rounded-sm" />
                      )}
                    </div>
                    {option.label || option.value}
                  </div>
                </div>
              ))}
            </SelectGroup>
          ))
        )}
      </SelectContent>
    </BaseSelect>
  );
};

export default MultiSelect;
