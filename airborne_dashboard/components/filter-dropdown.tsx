"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterDropdownProps {
  /** Unique identifier for this filter */
  id: string;
  /** Label shown on the filter button */
  label: string;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Currently selected values */
  selectedValues: string[];
  /** Available options to display */
  options: FilterOption[];
  /** Loading state */
  isLoading?: boolean;
  /** Whether there are more options to load */
  hasMore?: boolean;
  /** Callback when selection changes */
  onChange: (values: string[]) => void;
  /** Callback when search query changes */
  onSearch?: (query: string) => void;
  /** Callback to load more options (pagination) */
  onLoadMore?: () => void;
  /** Maximum number of items to show before scrolling */
  maxHeight?: number;
  /** Custom class name */
  className?: string;
  /** Whether to show option counts */
  showCounts?: boolean;
  /** Whether multiple selection is allowed */
  multiSelect?: boolean;
}

export function FilterDropdown({
  id,
  label,
  searchPlaceholder = "Search...",
  selectedValues,
  options,
  isLoading = false,
  hasMore = false,
  onChange,
  onSearch,
  onLoadMore,
  maxHeight = 300,
  className,
  showCounts = true,
  multiSelect = true,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus search input when popover opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch?.(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  // Handle scroll to bottom for infinite scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !hasMore || isLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      onLoadMore?.();
    }
  }, [hasMore, isLoading, onLoadMore]);

  const toggleValue = (value: string) => {
    if (multiSelect) {
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value];
      onChange(newValues);
    } else {
      onChange(selectedValues.includes(value) ? [] : [value]);
      setOpen(false);
    }
  };

  const clearSelection = () => {
    onChange([]);
    setSearchQuery("");
  };

  const removeValue = (valueToRemove: string) => {
    onChange(selectedValues.filter((v) => v !== valueToRemove));
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("justify-between min-w-[200px]", selectedValues.length > 0 && "border-primary")}
          >
            <span className="truncate">
              {selectedValues.length === 0
                ? label
                : selectedValues.length === 1
                  ? options.find((o) => o.value === selectedValues[0])?.label || selectedValues[0]
                  : `${selectedValues.length} selected`}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="flex flex-col">
            {/* Search Input */}
            <div className="flex items-center border-b px-3 py-2">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                className="h-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSearchQuery("")}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Options List */}
            <div ref={scrollRef} onScroll={handleScroll} className="max-h-[300px] overflow-auto" style={{ maxHeight }}>
              {options.length === 0 && !isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No results found.</div>
              ) : (
                <div className="p-1">
                  {options.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                      <div
                        key={`${id}-${option.value}`}
                        onClick={() => toggleValue(option.value)}
                        className={cn(
                          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent"
                        )}
                      >
                        <div className="flex flex-1 items-center justify-between">
                          <span className="truncate">{option.label}</span>
                          {showCounts && option.count !== undefined && (
                            <span className="ml-2 text-xs text-muted-foreground">({option.count})</span>
                          )}
                        </div>
                        {isSelected && <Check className="ml-2 h-4 w-4 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && <div className="py-2 text-center text-sm text-muted-foreground">Loading...</div>}

              {/* Load more indicator */}
              {hasMore && !isLoading && (
                <div className="py-2 text-center text-xs text-muted-foreground">Scroll to load more</div>
              )}
            </div>

            {/* Footer with clear button */}
            {selectedValues.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-muted-foreground hover:text-foreground"
                  onClick={clearSelection}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected values badges */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((value) => {
            const option = options.find((o) => o.value === value);
            return (
              <Badge key={value} variant="secondary" className="gap-1">
                {option?.label || value}
                <button
                  onClick={() => removeValue(value)}
                  className="ml-1 rounded-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
