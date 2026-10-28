// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * An in-memory stand-in for the Prisma models the firm team touches (users,
 * organisations, memberships, firm-team rows, owed pushes, audit entries), with the two
 * relation filters the code uses (Organization.members.some and
 * OrganizationMember.firmTeamMember), the unique keys the database enforces,
 * the ON DELETE CASCADE from a firm-team row to its memberships, and
 * $transaction as all or nothing. Enough to run the real service and routers
 * end to end without a database; the db test on PostgreSQL checks the same
 * behaviour against the real schema.
 */

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

let seq = 0;
const genId = (p: string) => `${p}-${(++seq).toString(36)}`;

const UNIQUE: Record<string, string[][]> = {
  user: [["email"]],
  organizationMember: [["organizationId", "userId"]],
  firmTeamMember: [["ownerUserId", "invitedEmail"]],
};

export interface FirmDb {
  tables: Record<string, Row[]>;
  [model: string]: unknown;
}

export function firmDb(): FirmDb {
  const tables: Record<string, Row[]> = {
    user: [],
    organization: [],
    organizationMember: [],
    firmTeamMember: [],
    firmTeamPushOwed: [],
    auditLog: [],
  };
  const t = (model: string) => (tables[model] ??= []);

  function matches(model: string, row: Row, where: Where | undefined): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, cond]) => {
      if (key === "OR") return (cond as Where[]).some((w) => matches(model, row, w));
      if (key === "AND") return (cond as Where[]).every((w) => matches(model, row, w));
      // Compound unique keys, e.g. organizationId_userId.
      if (key.includes("_") && cond && typeof cond === "object" && !(key in row)) {
        return matches(model, row, cond as Where);
      }
      if (model === "organization" && key === "members") {
        const some = (cond as { some: Where }).some;
        return t("organizationMember").some((m) => m.organizationId === row.id && matches("organizationMember", m, some));
      }
      if (model === "organizationMember" && key === "firmTeamMember") {
        const firm = t("firmTeamMember").find((f) => f.id === row.firmTeamMemberId);
        return !!firm && matches("firmTeamMember", firm, cond as Where);
      }
      const value = row[key] ?? null;
      if (cond === null) return value === null;
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        const c = cond as Record<string, unknown>;
        if ("in" in c) return (c.in as unknown[]).includes(value);
        if ("not" in c) return c.not === null ? value !== null : value !== c.not;
        throw new Error(`firm-db: unsupported filter ${model}.${key}: ${JSON.stringify(cond)}`);
      }
      return value === cond;
    });
  }

  function project(model: string, row: Row, args: { select?: Row; include?: Row }): Row {
    const out: Row = args.select ? {} : { ...row };
    const spec = { ...(args.select ?? {}), ...(args.include ?? {}) };
    for (const [k, v] of Object.entries(spec)) {
      if (!v) continue;
      if (model === "organizationMember" && k === "organization") {
        out[k] = { ...t("organization").find((o) => o.id === row.organizationId)! };
      } else if (model === "organizationMember" && k === "user") {
        const u = t("user").find((x) => x.id === row.userId)!;
        out[k] = typeof v === "object" && (v as Row).select ? project("user", u, v as Row) : { ...u };
      } else if (model === "firmTeamMember" && k === "member") {
        const u = t("user").find((x) => x.id === row.memberUserId);
        out[k] = u ? project("user", u, v as Row) : null;
      } else if (model === "firmTeamMember" && k === "_count") {
        out[k] = { memberships: t("organizationMember").filter((m) => m.firmTeamMemberId === row.id).length };
      } else {
        out[k] = row[k] ?? null;
      }
    }
    return structuredClone(out);
  }

  function checkUnique(model: string, row: Row, ignoreId?: unknown) {
    for (const keys of UNIQUE[model] ?? []) {
      if (t(model).some((r) => r.id !== ignoreId && keys.every((k) => r[k] === row[k]))) {
        throw Object.assign(new Error(`Unique constraint failed on ${model}(${keys.join(", ")})`), { code: "P2002" });
      }
    }
  }

  function remove(model: string, rows: Row[]) {
    const ids = new Set(rows.map((r) => r.id));
    tables[model] = t(model).filter((r) => !ids.has(r.id));
    // ON DELETE CASCADE: firm-team row -> its memberships.
    if (model === "firmTeamMember") {
      tables.organizationMember = t("organizationMember").filter((m) => !ids.has(m.firmTeamMemberId as string));
    }
  }

  const delegate = (model: string) => ({
    findUnique: async (args: { where: Where; select?: Row; include?: Row }) => {
      const row = t(model).find((r) => matches(model, r, args.where));
      return row ? project(model, row, args) : null;
    },
    findFirst: async (args: { where?: Where; select?: Row; include?: Row } = { }) => {
      const row = t(model).find((r) => matches(model, r, args.where));
      return row ? project(model, row, args) : null;
    },
    findMany: async (args: { where?: Where; select?: Row; include?: Row; distinct?: string[] } = {}) => {
      let rows = t(model).filter((r) => matches(model, r, args.where));
      if (args.distinct) {
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const k = args.distinct!.map((d) => String(r[d])).join("|");
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
      return rows.map((r) => project(model, r, args));
    },
    count: async (args: { where?: Where } = {}) => t(model).filter((r) => matches(model, r, args.where)).length,
    create: async (args: { data: Row; select?: Row; include?: Row }) => {
      const { members: nested, ...data } = args.data as Row & { members?: { create: Row } };
      const row: Row = { id: genId(model), createdAt: new Date(), ...(model === "organization" ? data : args.data) };
      for (const [k, v] of Object.entries(row)) if (v === undefined) delete row[k];
      if (model === "organization" && nested?.create) {
        checkUnique(model, row);
        t(model).push(row);
        addMember(proxy, row.id as string, nested.create.userId as string, nested.create.role as string);
        return project(model, row, {});
      }
      if (model === "organizationMember") {
        row.role ??= "MEMBER";
        row.firmTeamMemberId ??= null;
      }
      if (model === "firmTeamMember") {
        row.role ??= "PRIVACY_OFFICER";
        row.memberUserId ??= null;
        row.acceptedAt ??= null;
      }
      checkUnique(model, row);
      t(model).push(row);
      return project(model, row, args);
    },
    update: async (args: { where: Where; data: Row; select?: Row; include?: Row }) => {
      const row = t(model).find((r) => matches(model, r, args.where));
      if (!row) throw Object.assign(new Error("Record to update not found."), { code: "P2025" });
      const next = { ...row, ...args.data };
      checkUnique(model, next, row.id);
      Object.assign(row, args.data);
      return project(model, row, args);
    },
    updateMany: async (args: { where: Where; data: Row }) => {
      const rows = t(model).filter((r) => matches(model, r, args.where));
      for (const r of rows) Object.assign(r, args.data);
      return { count: rows.length };
    },
    delete: async (args: { where: Where }) => {
      const row = t(model).find((r) => matches(model, r, args.where));
      if (!row) throw Object.assign(new Error("Record to delete does not exist."), { code: "P2025" });
      remove(model, [row]);
      return structuredClone(row);
    },
    upsert: async (args: { where: Where; create: Row; update: Row }) => {
      const row = t(model).find((r) => matches(model, r, args.where));
      if (row) {
        Object.assign(row, args.update);
        return structuredClone(row);
      }
      const created: Row = { id: genId(model), ...args.create };
      t(model).push(created);
      return structuredClone(created);
    },
    deleteMany: async (args: { where: Where }) => {
      const rows = t(model).filter((r) => matches(model, r, args.where));
      remove(model, rows);
      return { count: rows.length };
    },
  });

  const delegates = new Map<string, ReturnType<typeof delegate>>();
  const proxy: FirmDb = new Proxy({ tables } as FirmDb, {
    get(target, prop: string) {
      if (prop === "tables") return tables;
      if (prop === "then") return undefined;
      if (prop === "$transaction") {
        return async (fn: (tx: unknown) => Promise<unknown>) => {
          const snapshot = structuredClone(tables);
          try {
            return await fn(proxy);
          } catch (err) {
            for (const k of Object.keys(tables)) delete tables[k];
            Object.assign(tables, snapshot);
            throw err;
          }
        };
      }
      if (!["user", "organization", "organizationMember", "firmTeamMember", "firmTeamPushOwed", "auditLog"].includes(prop)) {
        return undefined;
      }
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

/** Seeds a user. */
export function addUser(db: FirmDb, id: string, opts: { userType?: string | null; name?: string } = {}): Row {
  const row = { id, email: `${id}@test.example`, name: opts.name ?? id, userType: opts.userType ?? null, locale: null };
  db.tables.user.push(row);
  return row;
}

/** Seeds an organisation with its billing owner, as organization.create leaves it. */
export function addOrg(db: FirmDb, id: string, ownerId: string | null, opts: { plan?: string; billingOwnerId?: string | null } = {}): Row {
  const row = {
    id,
    name: id,
    slug: id,
    plan: opts.plan ?? "PILOT",
    pilotStartedAt: null,
    billingOwnerId: opts.billingOwnerId === undefined ? ownerId : opts.billingOwnerId,
    settings: {},
    createdAt: new Date(Date.now() + seq++),
  };
  db.tables.organization.push(row);
  if (ownerId) addMember(db, id, ownerId, "OWNER");
  return row;
}

/** Seeds a membership. */
export function addMember(db: FirmDb, organizationId: string, userId: string, role: string, firmTeamMemberId: string | null = null): Row {
  const row = { id: genId("om"), organizationId, userId, role, firmTeamMemberId, joinedAt: new Date() };
  db.tables.organizationMember.push(row);
  return row;
}

/** The organisations `userId` belongs to, and through which firm row. */
export function membershipsOf(db: FirmDb, userId: string) {
  return db.tables.organizationMember
    .filter((m) => m.userId === userId)
    .map((m) => ({ org: m.organizationId as string, role: m.role as string, firm: (m.firmTeamMemberId as string | null) ?? null }))
    .sort((a, b) => a.org.localeCompare(b.org));
}
