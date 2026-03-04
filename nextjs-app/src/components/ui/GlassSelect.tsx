"use client";

import React from "react";

interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: GlassSelectOption[];
  placeholder?: string;
}

export default function GlassSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: GlassSelectProps) {
  const select = (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="glass-input appearance-none pr-10 cursor-pointer"
      >
        {placeholder && (
          <option value="" disabled className="bg-[#0a0e12]">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#0a0e12]">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg
          className="h-4 w-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );

  if (label) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {select}
      </div>
    );
  }

  return select;
}
