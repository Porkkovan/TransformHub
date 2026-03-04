"use client";

import React from "react";

interface GlassInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  type?: string;
  name?: string;
  id?: string;
}

export default function GlassInput({
  label,
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  type = "text",
  name,
  id,
}: GlassInputProps) {
  const input = (
    <input
      type={type}
      name={name}
      id={id}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      className="glass-input"
    />
  );

  if (label) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {input}
      </div>
    );
  }

  return input;
}
