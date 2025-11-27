import React from 'react';
import type { ComponentProps } from 'react';
import { cn } from '@renderer/lib/classnames';
import {
  Select as BaseSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../base/select';

type OptionType = {
  label?: string;
  value: string;
  disabled?: boolean;
};
type GroupOptionType = {
  label: string;
  options: OptionType[];
};
type SelectProps = ComponentProps<typeof BaseSelect> & {
  id?: string;
  options: (OptionType | GroupOptionType)[];
  placeholder?: string;
  className?: string;
};
const Select: React.FC<SelectProps> = ({ id, options, placeholder, className, ...props }) => {
  return (
    <BaseSelect {...props}>
      <SelectTrigger id={id} className={cn('focus-visible:ring-[1px]', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((group) => (
          <SelectGroup key={`group-${'options' in group ? group.label : group.value}`} className="w-full">
            {'options' in group && <SelectLabel>{group.label}</SelectLabel>}
            {('options' in group ? group.options : [group]).map((option) => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label || option.value}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </BaseSelect>
  );
};

export default Select;
