'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GridSelectOption {
  label: string;
  value: string;
}

interface GridSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: GridSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function GridSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Select...',
  className = '',
}: GridSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger 
        className={`bg-transparent border-none hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all ${className}`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      
      <SelectContent className="z-[200]">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}