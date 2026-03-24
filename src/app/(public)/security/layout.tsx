import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Security",
  description:
    "How DPO Central protects your data — 10 security layers covering authentication, RBAC, input validation, transport security, audit logging, and infrastructure.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "Data Security | DPO CENTRAL",
    description:
      "10 security layers: zero-knowledge auth, 5-tier RBAC, rate limiting, TLS + HSTS, audit logging, edge deployment.",
    url: "/security",
  },
};

export default function SecurityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
