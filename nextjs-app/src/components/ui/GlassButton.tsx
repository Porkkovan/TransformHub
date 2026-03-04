"use client";

import React from "react";

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger" | "success";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

export default function GlassButton({
  children,
  onClick,
  variant = "default",
  disabled = false,
  className = "",
  type = "button",
}: GlassButtonProps) {
  const variantClass =
    variant === "danger"
      ? "glass-button-danger"
      : variant === "success"
        ? "glass-button-success"
        : "";

  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`glass-button ${variantClass} ${disabledClass} ${className}`}
    >
      {children}
    </button>
  );
}
