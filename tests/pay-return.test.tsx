// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Payment links open in a new tab, and the plan state is read again when the
 * person comes back to the application's tab (src/lib/pay-return.ts): only
 * after a payment link was clicked in that tab, only the plan query, and
 * never once the plan shows the purchase.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const state = vi.hoisted(() => ({
  pilotRefetch: (() => undefined) as () => unknown,
  dsarRefetch: (() => undefined) as () => unknown,
  paid: false,
}));
vi.mock("@/lib/organization-context", () => ({
  useSelectedOrganizationOrNull: () => ({ id: "cmorg1", name: "Org", slug: "org", plan: "PILOT", role: "OWNER" }),
  useOrganization: () => ({ organization: { id: "cmorg1", name: "Org", slug: "org", plan: "EU_CLOUD", role: "OWNER" } }),
}));
vi.mock("@/components/region-provider", () => ({
  useChargeCurrency: () => "USD",
  usePriceInSentence: () => (n: number) => `$${n}`,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    organization: {
      getPilotStatus: {
        useQuery: () => ({
          data: state.paid
            ? { hosted: true, paid: true }
            : {
                hosted: true,
                paid: false,
                endsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                readOnly: false,
                transition: false,
              },
          refetch: () => state.pilotRefetch(),
        }),
      },
    },
    dsar: {
      moduleAccess: {
        useQuery: () => ({
          data: {
            gate: "standard",
            used: 60,
            limit: 100,
            remaining: 40,
            warningPercent: 50,
            resetsAt: new Date("2026-11-01T00:00:00Z"),
            canBuy: true,
            onPlan: true,
            upgrade: { EUR: "https://buy.stripe.com/test_eur", USD: "https://buy.stripe.com/test_usd" },
          },
          refetch: () => state.dsarRefetch(),
        }),
      },
    },
  },
}));

import { HostedPilotEndBar } from "@/components/pilot/hosted-pilot";
import { DsarModuleAccessNote } from "@/components/privacy/dsar-module-access-note";
import {
  armPayReturn,
  isPayReturnArmed,
  resetPayReturn,
  usePayReturnRefetch,
  ARM_WINDOW_MS,
  POLL_INTERVAL_MS,
  POLL_WINDOW_MS,
  type PayKind,
} from "@/lib/pay-return";

function withIntl(node: ReactNode) {
  return createElement(
    NextIntlClientProvider,
    { locale: "en", timeZone: "UTC", messages: en } as unknown as ComponentProps<typeof NextIntlClientProvider>,
    node
  );
}

let visibility: DocumentVisibilityState = "visible";
function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}
function leaveTab() {
  setVisibility("hidden");
  window.dispatchEvent(new Event("blur"));
}
function returnToTab() {
  setVisibility("visible");
  window.dispatchEvent(new Event("focus"));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  resetPayReturn();
  state.paid = false;
  state.pilotRefetch = () => undefined;
  state.dsarRefetch = () => undefined;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("payment links open in a new tab", () => {
  it("the pilot bar's monthly, yearly and pricing links", () => {
    render(withIntl(createElement(HostedPilotEndBar, { upgrade: true, upgradeMonthly: true })));
    for (const id of ["pilot-upgrade-monthly-link", "pilot-upgrade-link"]) {
      const a = screen.getByTestId(id);
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
    const pricing = screen.getByText(en.pilot.endBar.pricing).closest("a")!;
    expect(pricing.getAttribute("target")).toBe("_blank");
    expect(pricing.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("the single 'Move to the paid plan' link", () => {
    render(withIntl(createElement(HostedPilotEndBar, { upgrade: true })));
    const a = screen.getByTestId("pilot-upgrade-link");
    expect(a.getAttribute("href")).toBe("/api/plan/checkout?org=cmorg1");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("the rights-request volume upgrade link", () => {
    render(withIntl(createElement(DsarModuleAccessNote)));
    const a = screen.getByText(en.dsarModule.volumeUpgradeLink).closest("a")!;
    expect(a.getAttribute("href")).toBe("https://buy.stripe.com/test_usd");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("plan state read again on return", () => {
  it("does nothing on focus when no payment link was clicked", async () => {
    const refetch = vi.fn();
    state.pilotRefetch = refetch;
    render(withIntl(createElement(HostedPilotEndBar, { upgrade: true })));
    leaveTab();
    returnToTab();
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    });
    await flush();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("refetches the pilot status on return after the bar's link was clicked", async () => {
    const refetch = vi.fn();
    state.pilotRefetch = refetch;
    render(withIntl(createElement(HostedPilotEndBar, { upgrade: true })));
    fireEvent.click(screen.getByTestId("pilot-upgrade-link"));
    expect(isPayReturnArmed("plan")).toBe(true);
    leaveTab();
    await flush();
    expect(refetch).not.toHaveBeenCalled();
    returnToTab();
    await flush();
    // Focus and visibility arrive together: one read, not two.
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("the volume upgrade's click refetches the module's state, not the plan's", async () => {
    const plan = vi.fn();
    const dsar = vi.fn();
    state.pilotRefetch = plan;
    state.dsarRefetch = dsar;
    render(
      withIntl(
        createElement("div", null, createElement(HostedPilotEndBar, { upgrade: true }), createElement(DsarModuleAccessNote))
      )
    );
    fireEvent.click(screen.getByText(en.dsarModule.volumeUpgradeLink));
    leaveTab();
    returnToTab();
    await flush();
    expect(dsar).toHaveBeenCalledTimes(1);
    expect(plan).not.toHaveBeenCalled();
  });
});

function Probe({ kind, refetch, done }: { kind: PayKind; refetch: () => unknown; done: boolean }) {
  usePayReturnRefetch(kind, refetch, done);
  return null;
}

describe("usePayReturnRefetch", () => {
  it("polls every 10 s while visible, for 3 minutes after the return", async () => {
    const refetch = vi.fn();
    render(createElement(Probe, { kind: "plan", refetch, done: false }));
    act(() => armPayReturn("plan"));
    leaveTab();
    // Hidden: no polling.
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    });
    expect(refetch).not.toHaveBeenCalled();
    returnToTab();
    await flush();
    expect(refetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await flush();
    expect(refetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      vi.advanceTimersByTime(POLL_WINDOW_MS);
    });
    await flush();
    const atEnd = refetch.mock.calls.length;
    expect(atEnd).toBeGreaterThan(2);
    expect(atEnd).toBeLessThanOrEqual(2 + POLL_WINDOW_MS / POLL_INTERVAL_MS);
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 6);
    });
    await flush();
    expect(refetch.mock.calls.length).toBe(atEnd);
  });

  it("does not poll while the tab is hidden", async () => {
    const refetch = vi.fn();
    render(createElement(Probe, { kind: "plan", refetch, done: false }));
    act(() => armPayReturn("plan"));
    leaveTab();
    returnToTab();
    await flush();
    expect(refetch).toHaveBeenCalledTimes(1);
    leaveTab();
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 4);
    });
    await flush();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("stops once the plan shows the purchase", async () => {
    const refetch = vi.fn();
    const view = render(createElement(Probe, { kind: "plan", refetch, done: false }));
    act(() => armPayReturn("plan"));
    view.rerender(createElement(Probe, { kind: "plan", refetch, done: true }));
    expect(isPayReturnArmed("plan")).toBe(false);
    leaveTab();
    returnToTab();
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    });
    await flush();
    expect(refetch).not.toHaveBeenCalled();
  });

  it("forgets a click after the arm window", async () => {
    const refetch = vi.fn();
    render(createElement(Probe, { kind: "plan", refetch, done: false }));
    act(() => armPayReturn("plan"));
    leaveTab();
    await act(async () => {
      vi.advanceTimersByTime(ARM_WINDOW_MS + 1);
    });
    returnToTab();
    await flush();
    expect(refetch).not.toHaveBeenCalled();
    expect(isPayReturnArmed("plan")).toBe(false);
  });

  it("swallows a failed read and tries again on the next tick", async () => {
    const refetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    render(createElement(Probe, { kind: "plan", refetch, done: false }));
    act(() => armPayReturn("plan"));
    leaveTab();
    returnToTab();
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await flush();
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});
