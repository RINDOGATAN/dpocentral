// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Support read of one rights request. Operator use only. Writes a SUPPORT
 * entry in the request's own trail (who, why, when) before it reads, then
 * prints the request: the organisation sees the read on the request page.
 *
 *   npm run db:dsar-support-read -- --request <id or public reference> \
 *     --by "operator name" --reason "ticket 1234"
 *
 * Exit codes: 0 read, 1 refused input or not found, 2 unexpected error.
 */

import { PrismaClient } from "@prisma/client";
import {
  SupportReadError,
  supportReadDsar,
  type SupportDb,
  type SupportReadInput,
} from "../src/server/services/dsar/support-access";

export function parseArgs(argv: string[]): SupportReadInput {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) throw new SupportReadError(`Unexpected argument: ${a}`);
    const name = a.slice(2);
    if (!["request", "by", "reason"].includes(name)) throw new SupportReadError(`Unknown option: ${a}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new SupportReadError(`${a} needs a value.`);
    values[name] = v;
    i++;
  }
  return { request: values.request ?? "", operator: values.by ?? "", reason: values.reason ?? "" };
}

async function main(): Promise<number> {
  let input: SupportReadInput;
  try {
    input = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  const prisma = new PrismaClient();
  try {
    const request = await supportReadDsar(prisma as unknown as SupportDb, input);
    console.log("SUPPORT entry written in the request's trail.");
    console.log(JSON.stringify(request, null, 2));
    return 0;
  } catch (err) {
    if (err instanceof SupportReadError) {
      console.error(err.message);
      return 1;
    }
    console.error(err);
    return 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && /dsar-support-read\.ts$/.test(process.argv[1])) {
  main().then((code) => process.exit(code));
}
