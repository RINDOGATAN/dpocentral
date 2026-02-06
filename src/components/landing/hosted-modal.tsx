"use client";

import { Cloud, AlertTriangle, ArrowRight, X } from "lucide-react";

interface HostedModalProps {
  open: boolean;
  onClose: () => void;
}

export function HostedModal({ open, onClose }: HostedModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#1a1a1a]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-[#242424] border border-[#333333] rounded-2xl max-w-lg w-full p-8 animate-fade-in"
        style={{ boxShadow: "var(--shadow-hover)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#a0a0a0] hover:text-[#fefeff] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 bg-[#53aecc]/10 rounded-xl flex items-center justify-center mb-5">
          <Cloud className="w-6 h-6 text-[#53aecc]" />
        </div>

        <h3 className="text-2xl font-display mb-2">DPO Central on TODO.LAW</h3>
        <p className="text-[#a0a0a0] text-sm leading-relaxed mb-6 font-body">
          Free access to the full DPO Central platform, hosted on our managed infrastructure.
        </p>

        <div className="bg-[#1e1e1e] border border-[#333333] rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <h4 className="text-sm font-display text-yellow-500">Important Considerations</h4>
          </div>
          <ul className="space-y-3 text-sm text-[#a0a0a0] font-body">
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">&bull;</span>
              <span>
                <strong className="text-[#fefeff]">No SLA.</strong> The service is offered as-is without uptime guarantees.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">&bull;</span>
              <span>
                <strong className="text-[#fefeff]">No independent certifications.</strong> Security certifications are limited to those obtained by our subprocessors.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">&bull;</span>
              <span>
                <strong className="text-[#fefeff]">No regional storage options.</strong> Data is stored in Frankfurt (EU) via Neon.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">&bull;</span>
              <span>
                <strong className="text-[#fefeff]">Avoid actual personal data.</strong> Use encrypted references or pseudonyms to track data subject requests instead of real customer information.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://dpocentral.northend.law"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-sm flex-1 text-center"
          >
            Continue to DPO Central
            <ArrowRight className="w-4 h-4 ml-2 inline" />
          </a>
          <button
            onClick={onClose}
            className="btn-secondary text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
