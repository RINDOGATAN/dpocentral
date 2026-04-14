/**
 * Hits every PDF export route against the local dev server and writes
 * the result to /tmp/. Forges a NextAuth JWT cookie from NEXTAUTH_SECRET
 * so we don't need to log in through a browser.
 */
import fs from "node:fs/promises";

const orgId = "cmnpflh5r000013q77ssfe148";
const userEmail = "sergiom@rindogatan.com";
const BASE = "http://localhost:3001";

async function main() {
  // Use the /api/auth/dev-login endpoint to get a proper session cookie
  const loginRes = await fetch(`${BASE}/api/auth/dev-login?email=${encodeURIComponent(userEmail)}`, {
    redirect: "manual",
  });
  const setCookie = loginRes.headers.get("set-cookie");
  if (!setCookie) throw new Error("dev-login returned no Set-Cookie header");
  const sessionMatch = setCookie.match(/next-auth\.session-token=([^;]+)/);
  if (!sessionMatch) throw new Error("no session token in Set-Cookie");
  const cookie = `next-auth.session-token=${sessionMatch[1]}`;

  const assessmentId = await findAssessmentId();

  const jobs: Array<{ name: string; url: string; file: string }> = [
    { name: "Data Inventory", url: `/api/export/data-inventory?organizationId=${orgId}`, file: "/tmp/conductrics-data-inventory.pdf" },
    { name: "ROPA", url: `/api/export/ropa?organizationId=${orgId}`, file: "/tmp/conductrics-ropa.pdf" },
    { name: "Vendor Register", url: `/api/export/vendor-register?organizationId=${orgId}`, file: "/tmp/conductrics-vendor-register.pdf" },
    { name: "Breach Register", url: `/api/export/breach-register?organizationId=${orgId}`, file: "/tmp/conductrics-breach-register.pdf" },
    { name: "DSAR Performance", url: `/api/export/dsar-performance?organizationId=${orgId}`, file: "/tmp/conductrics-dsar-performance.pdf" },
    { name: "Assessment Portfolio", url: `/api/export/assessment-portfolio?organizationId=${orgId}`, file: "/tmp/conductrics-assessment-portfolio.pdf" },
    { name: "Regulatory Landscape", url: `/api/export/regulatory-landscape?organizationId=${orgId}`, file: "/tmp/conductrics-regulatory-landscape.pdf" },
    { name: "Assessment (individual)", url: `/api/export/assessment/${assessmentId}?organizationId=${orgId}`, file: "/tmp/conductrics-assessment.pdf" },
  ];

  for (const job of jobs) {
    process.stdout.write(`${job.name.padEnd(26)} `);
    const res = await fetch(BASE + job.url, { headers: { cookie } });
    if (!res.ok) {
      const body = await res.text();
      console.log(`FAIL ${res.status} — ${body.slice(0, 200)}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(job.file, buf);
    console.log(`${buf.length} bytes -> ${job.file}`);
  }
}

async function findAssessmentId() {
  // Use the same prisma client the routes use; avoid a second connection
  // by importing lazily so the env is loaded first.
  const mod = await import("../src/lib/prisma");
  const prisma = mod.default;
  const a = await prisma.assessment.findFirst({ where: { organizationId: orgId } });
  if (!a) throw new Error("no assessment to export");
  return a.id;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
