// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * An in-memory stand-in for the part of Prisma the portability code uses
 * (src/server/services/portability): findMany with where / orderBy id / take,
 * findFirst, count, create, createMany and $transaction (all or nothing).
 * `where` understands equality, null, { in }, { gt }, { startsWith } and
 * { not }. Relation filters are not supported, which keeps the code under
 * test honest: it filters on columns it has read itself.
 *
 * Every call is recorded in `calls`, so a test can check what was asked.
 */

import { Prisma } from "@prisma/client";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

let seq = 0;
const genId = () => `m${(++seq).toString(36).padStart(8, "0")}`;

function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    if (typeof cond === "object" && !Array.isArray(cond)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) return (c.in as unknown[]).includes(value);
      if ("gt" in c) return typeof value === "string" && value > (c.gt as string);
      if ("startsWith" in c) return typeof value === "string" && value.startsWith(c.startsWith as string);
      if ("not" in c) return c.not === null ? value !== null && value !== undefined : value !== c.not;
      throw new Error(`memory-db: unsupported filter on ${key}: ${JSON.stringify(cond)}`);
    }
    return value === cond;
  });
}

const NULLS = new Set<unknown>([Prisma.JsonNull, Prisma.DbNull]);

function stored(model: string, data: Row): Row {
  const now = new Date();
  const row: Row = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    row[k] = NULLS.has(v) ? null : v;
  }
  row.id ??= genId();
  if (!("createdAt" in row)) row.createdAt = now;
  if (!("updatedAt" in row)) row.updatedAt = now;
  if ((model === "incident" || model === "dSARRequest") && !row.publicId) row.publicId = genId();
  return structuredClone(row);
}

/** Unique keys the tests rely on the database to enforce. */
const UNIQUE: Record<string, string[]> = {
  programmeImportRecord: ["organizationId", "kind", "sourceKey"],
};

export interface MemoryDb {
  tables: Map<string, Row[]>;
  calls: Array<{ model: string; op: string; args: unknown }>;
  table(model: string): Row[];
  insert(model: string, data: Row): Row;
  [model: string]: unknown;
}

export function memoryDb(): MemoryDb {
  const tables = new Map<string, Row[]>();
  const calls: MemoryDb["calls"] = [];
  const table = (model: string) => {
    let t = tables.get(model);
    if (!t) {
      t = [];
      tables.set(model, t);
    }
    return t;
  };
  const insert = (model: string, data: Row) => {
    const row = stored(model, data);
    const t = table(model);
    if (t.some((r) => r.id === row.id)) throw new Error(`memory-db: duplicate id ${String(row.id)} in ${model}`);
    const unique = UNIQUE[model];
    if (unique && t.some((r) => unique.every((k) => r[k] === row[k]))) {
      throw new Error(`memory-db: unique constraint failed on ${model}(${unique.join(", ")})`);
    }
    t.push(row);
    return row;
  };

  const delegate = (model: string) => ({
    findMany: async (args: { where?: Where; orderBy?: { id?: "asc" }; take?: number } = {}) => {
      calls.push({ model, op: "findMany", args });
      let rows = table(model).filter((r) => matches(r, args.where));
      if (args.orderBy?.id === "asc") rows = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      if (args.take !== undefined) rows = rows.slice(0, args.take);
      return structuredClone(rows);
    },
    findFirst: async (args: { where?: Where } = {}) => {
      calls.push({ model, op: "findFirst", args });
      const row = table(model).find((r) => matches(r, args.where));
      return row ? structuredClone(row) : null;
    },
    count: async (args: { where?: Where } = {}) => {
      calls.push({ model, op: "count", args });
      return table(model).filter((r) => matches(r, args.where)).length;
    },
    create: async (args: { data: Row }) => {
      calls.push({ model, op: "create", args });
      return structuredClone(insert(model, args.data));
    },
    createMany: async (args: { data: Row[] }) => {
      calls.push({ model, op: "createMany", args: { count: args.data.length } });
      for (const d of args.data) insert(model, d);
      return { count: args.data.length };
    },
  });

  const db: MemoryDb = {
    tables,
    calls,
    table,
    insert,
  } as MemoryDb;

  const delegates = new Map<string, ReturnType<typeof delegate>>();
  const proxy: MemoryDb = new Proxy(db, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "$transaction") {
        return async (fn: (tx: unknown) => Promise<unknown>) => {
          const snapshot = new Map([...tables].map(([k, v]) => [k, structuredClone(v)]));
          try {
            return await fn(proxy);
          } catch (err) {
            tables.clear();
            for (const [k, v] of snapshot) tables.set(k, v);
            throw err;
          }
        };
      }
      if (prop === "then") return undefined;
      let d = delegates.get(prop);
      if (!d) {
        d = delegate(prop);
        delegates.set(prop, d);
      }
      return d;
    },
  });
  return proxy;
}
