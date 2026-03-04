"use client";

import { useState, ReactNode } from "react";

interface CollapsibleSectionProps {
  title: string | ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  /** When true, forces the section open regardless of internal toggle state */
  forceOpen?: boolean;
  /** Called when the header is clicked, before the internal toggle */
  onHeaderClick?: () => void;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  forceOpen,
  onHeaderClick,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const effectivelyOpen = forceOpen || isOpen;

  const handleClick = () => {
    onHeaderClick?.();
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`glass-panel-sm rounded-xl overflow-hidden ${className}`}>
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-white/50 transition-transform ${effectivelyOpen ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-white/90">{title}</span>
          {badge}
        </div>
      </button>
      {effectivelyOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
