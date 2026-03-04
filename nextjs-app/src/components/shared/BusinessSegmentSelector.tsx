"use client";

import React, { useState, useEffect } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";

interface BusinessSegmentSelectorProps {
  value: string;
  onChange: (segment: string) => void;
  label?: string;
  placeholder?: string;
  additionalSegments?: string[];
}

export default function BusinessSegmentSelector({
  value,
  onChange,
  label = "Business Segment",
  placeholder = "All Segments",
  additionalSegments,
}: BusinessSegmentSelectorProps) {
  const { currentOrg } = useOrganization();
  const [productSegments, setProductSegments] = useState<string[]>([]);

  // Fetch distinct product segments for the current org so that
  // segments already assigned to products (even if renamed at the org level) remain selectable
  useEffect(() => {
    if (!currentOrg?.id) return;
    fetch(`/api/digital-products?organizationId=${currentOrg.id}`)
      .then((res) => res.ok ? res.json() : [])
      .then((products: { businessSegment?: string | null }[]) => {
        const segs = new Set<string>();
        for (const p of products) {
          if (p.businessSegment) segs.add(p.businessSegment);
        }
        setProductSegments(Array.from(segs));
      })
      .catch(() => {});
  }, [currentOrg?.id]);

  const orgSegments = currentOrg?.businessSegments ?? [];
  // Merge org segments with product segments and any additional segments
  // so that old/mismatched segment values remain selectable
  const allExtra = [...productSegments, ...(additionalSegments ?? [])];
  const extraSegments = allExtra.filter(
    (seg, i) => seg && !orgSegments.includes(seg) && allExtra.indexOf(seg) === i
  );
  const segments = [...orgSegments, ...extraSegments];

  const select = (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input appearance-none pr-10 cursor-pointer"
      >
        <option value="" className="bg-[#0a0e12]">
          {placeholder}
        </option>
        {orgSegments.map((seg) => (
          <option key={seg} value={seg} className="bg-[#0a0e12]">
            {seg}
          </option>
        ))}
        {extraSegments.length > 0 && (
          <option disabled className="bg-[#0a0e12] text-white/30">
            ── Previously assigned ──
          </option>
        )}
        {extraSegments.map((seg) => (
          <option key={seg} value={seg} className="bg-[#0a0e12]">
            {seg}
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

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {select}
    </div>
  );
}
