// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** All text in a react-pdf element tree (function components expanded). */

import React from "react";

export function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
    return out;
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<Record<string, unknown>>;
    if (typeof el.type === "function") {
      return collectText((el.type as (p: unknown) => unknown)(el.props), out);
    }
    // Table headers and rows, metadata items.
    for (const [key, value] of Object.entries(el.props)) {
      if (key === "children" || !Array.isArray(value)) continue;
      for (const item of value) {
        if (Array.isArray(item)) item.forEach((cell) => collectText(cell, out));
        else if (item && typeof item === "object" && "label" in item) {
          collectText((item as { label: unknown }).label, out);
          collectText((item as { value: unknown }).value, out);
        } else collectText(item, out);
      }
    }
    collectText(el.props.children, out);
    if (typeof el.props.value === "string" || typeof el.props.value === "number") {
      out.push(String(el.props.value));
    }
    if (typeof el.props.label === "string") out.push(el.props.label);
  }
  return out;
}

/** A translator over a message subtree, with {placeholder} interpolation. */
export function translator(bundle: Record<string, unknown>) {
  return (key: string, values?: Record<string, string | number | Date>): string => {
    let node: unknown = bundle;
    for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
    const text = typeof node === "string" ? node : key;
    return values ? text.replace(/\{(\w+)\}/g, (_, v) => String(values[v] ?? "")) : text;
  };
}
