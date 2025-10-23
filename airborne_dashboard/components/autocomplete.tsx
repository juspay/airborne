"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutocompleteProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  selectedItem: string | null;
  setSelectedItem: (value: string | null) => void;
  items: string[] | undefined;
  loading: boolean;
  placeholder?: string;
}

export function Autocomplete({
  inputValue,
  setInputValue,
  selectedItem,
  setSelectedItem,
  items,
  loading,
  placeholder = "Filter...",
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectItem = (item: string) => {
    setSelectedItem(item);
    setInputValue("");
    setIsOpen(false);
  };

  const handleClearItem = () => {
    setSelectedItem(null);
    setInputValue("");
    setIsOpen(false);
  };

  const filteredItems = items || [];

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pr-10"
          />
          <ChevronDown
            className={cn(
              "absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>

        {selectedItem && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm">
            <span>{selectedItem}</span>
            <button
              onClick={handleClearItem}
              className="hover:opacity-80 transition-opacity"
              aria-label="Clear selection"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-md shadow-md z-50">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              {inputValue ? "No items found" : "No items available"}
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filteredItems.map((item) => (
                <button
                  key={item}
                  onClick={() => handleSelectItem(item)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                    selectedItem === item && "bg-accent font-medium"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
