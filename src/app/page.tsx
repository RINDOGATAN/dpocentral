"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, ArrowRight } from "lucide-react";
import { LandingHeader } from "@/components/landing/landing-header";
import { DPOInterfacePreview } from "@/components/landing/dpo-interface-preview";
import { DeploymentPicker } from "@/components/landing/deployment-picker";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { HostedModal } from "@/components/landing/hosted-modal";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function Home() {
  const [showHostedModal, setShowHostedModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#fefeff]">
      <LandingHeader />

      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-8 overflow-hidden">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-[#242424] rounded-full border border-[#333333] shadow-sm">
                <Shield className="w-3.5 h-3.5 text-[#53aecc]" />
                <span className="text-xs uppercase tracking-wider text-[#a0a0a0] font-medium font-body">
                  Privacy Program Management
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight mb-6 text-balance font-display">
                DPO Central
              </h1>

              <p className="max-w-2xl mx-auto text-lg md:text-xl text-[#a0a0a0] leading-relaxed font-body mb-10">
                An open framework for managing privacy programs. Data inventory, DSARs, incidents, assessments, and vendor management — all in one place.
              </p>

              <button
                onClick={() => setShowHostedModal(true)}
                className="btn-primary text-base px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
              >
                Launch on TODO.LAW
                <ArrowRight className="w-5 h-5 ml-2 inline" />
              </button>
              <p className="mt-4 text-sm text-[#a0a0a0] font-body">
                Or{" "}
                <a href="#alt-deployment" className="text-[#53aecc] hover:underline">
                  explore alternative deployment options
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Interface Preview */}
        <section className="pb-24 pt-4">
          <div className="max-w-6xl mx-auto px-6">
            <DPOInterfacePreview />
          </div>
        </section>

        {/* Deployment Picker */}
        <div id="alt-deployment" className="bg-[#1e1e1e] border-y border-[#333333] scroll-mt-24">
          <DeploymentPicker />
        </div>

        {/* Feature Showcase */}
        <FeatureShowcase />

        {/* CTA */}
        <section className="py-24 bg-[#1e1e1e] border-t border-[#333333]">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-4xl font-display mb-6">
              Ready to take <span className="text-[#53aecc]">control</span>?
            </h2>
            <p className="text-lg text-[#a0a0a0] mb-8 max-w-xl mx-auto font-body">
              Start managing your privacy program today. Free to use, open source, and deploy anywhere.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/sign-in" className="btn-primary">
                Try DPO Central Free
              </Link>
              <a
                href="https://github.com/rindogatan"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View Source Code
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
      <HostedModal open={showHostedModal} onClose={() => setShowHostedModal(false)} />
    </div>
  );
}
