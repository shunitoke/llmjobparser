"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MultiSelectOption = {
  value: string;
  label: string;
};

export type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  maxBadges?: number;
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results.",
  className,
  disabled,
  maxBadges = 3,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value],
  );

  const toggle = React.useCallback(
    (nextValue: string) => {
      if (value.includes(nextValue)) {
        onChange(value.filter((v) => v !== nextValue));
        return;
      }

      onChange([...value, nextValue]);
    },
    [onChange, value],
  );

  const visibleBadges = selected.slice(0, maxBadges);
  const hiddenCount = Math.max(selected.length - visibleBadges.length, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selected.length === 0 ? (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            ) : (
              <span className="flex min-w-0 flex-wrap items-center gap-1">
                {visibleBadges.map((o) => (
                  <Badge
                    key={o.value}
                    variant="secondary"
                    className="max-w-[180px] truncate"
                  >
                    {o.label}
                  </Badge>
                ))}
                {hiddenCount > 0 ? (
                  <Badge variant="secondary">+{hiddenCount}</Badge>
                ) : null}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const isSelected = value.includes(o.value);
                return (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                  >
                    <span
                      className={cn(
                        "mr-2 inline-flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
