"use client";

import { ReactNode } from "react";

interface EntityListSidebarProps<T> {
  title: string;
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  getId: (item: T) => string;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  className?: string;
}

export default function EntityListSidebar<T>({
  title,
  items,
  selectedId,
  onSelect,
  getId,
  renderItem,
  className = "",
}: EntityListSidebarProps<T>) {
  return (
    <div className={`glass-panel rounded-2xl flex flex-col h-full ${className}`}>
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white/80">{title}</h2>
        <p className="text-xs text-white/40 mt-0.5">{items.length} items</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item) => {
          const id = getId(item);
          const isSelected = id === selectedId;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition-all ${
                isSelected
                  ? "bg-blue-500/20 border border-blue-500/30"
                  : "hover:bg-white/5 border border-transparent"
              }`}
            >
              {renderItem(item, isSelected)}
            </button>
          );
        })}
        {items.length === 0 && (
          <p className="text-xs text-white/30 text-center py-8">No items found</p>
        )}
      </div>
    </div>
  );
}
