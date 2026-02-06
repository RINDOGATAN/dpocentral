import { Database, Users, AlertTriangle, FileCheck, Building2, ArrowRight } from "lucide-react";

const features = [
  {
    id: "data-inventory",
    icon: Database,
    title: "Data Inventory & ROPA",
    headline: "Map every processing activity.",
    description:
      "Maintain a living Record of Processing Activities. Track data categories, lawful bases, retention periods, and data flows across your organization. Generate Art. 30 reports on demand.",
    highlights: [
      "Automated data flow mapping",
      "Art. 30 ROPA generation",
      "Lawful basis tracking",
      "Retention schedule management",
    ],
  },
  {
    id: "dsar",
    icon: Users,
    title: "DSAR Management & Public Portal",
    headline: "Handle data subject requests at scale.",
    description:
      "A dedicated portal where data subjects can submit access, deletion, or rectification requests. Track deadlines, assign tasks internally, and respond within regulatory timelines.",
    highlights: [
      "Public-facing request portal",
      "Automated deadline tracking",
      "Identity verification workflows",
      "Response template library",
    ],
  },
  {
    id: "incidents",
    icon: AlertTriangle,
    title: "Incident Tracking",
    headline: "From breach detection to authority notification.",
    description:
      "Log, assess, and escalate data breaches with a structured workflow. Automatically evaluate whether notification to the supervisory authority or data subjects is required under Art. 33/34.",
    highlights: [
      "72-hour notification tracker",
      "Severity & risk assessment",
      "Art. 33/34 analysis",
      "Incident response playbooks",
    ],
  },
  {
    id: "assessments",
    icon: FileCheck,
    title: "Assessments (LIA, DPIA, TIA)",
    headline: "Structured impact assessments.",
    description:
      "Guided workflows for Legitimate Interest Assessments, Data Protection Impact Assessments, and Transfer Impact Assessments. Smart risk scoring and mitigation recommendations included.",
    highlights: [
      "Guided DPIA questionnaires",
      "LIA balancing tests",
      "TIA for cross-border transfers",
      "Risk heat maps & scoring",
    ],
  },
  {
    id: "vendors",
    icon: Building2,
    title: "Vendor Management",
    headline: "Know your processors.",
    description:
      "Track all third-party processors and sub-processors. Manage DPAs, run vendor risk assessments, and maintain an up-to-date vendor register with contract renewal alerts.",
    highlights: [
      "Processor & sub-processor registry",
      "DPA management & tracking",
      "Risk assessment workflows",
      "Contract renewal alerts",
    ],
  },
];

export function FeatureShowcase() {
  return (
    <section className="py-24" id="features">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="section-label">Core Capabilities</span>
          <h2 className="text-2xl md:text-4xl font-display mb-6">
            Everything a DPO <span className="text-[#53aecc]">Needs</span>
          </h2>
          <p className="text-lg text-[#a0a0a0] font-body">
            Five integrated modules covering the full scope of privacy program management.
          </p>
        </div>

        <div className="space-y-8 max-w-5xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className="paper-card group hover:border-[#53aecc]/50"
              >
                <div className={`flex flex-col md:flex-row gap-6 md:gap-10 ${index % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                  <div className="md:w-2/5 flex flex-col">
                    <div className="w-14 h-14 bg-[#53aecc]/10 rounded-2xl flex items-center justify-center mb-4">
                      <Icon className="w-7 h-7 text-[#53aecc]" />
                    </div>
                    <span className="text-xs uppercase tracking-wider text-[#a0a0a0] font-medium font-body mb-1">
                      {feature.title}
                    </span>
                    <h3 className="text-xl md:text-2xl font-display mb-3">
                      {feature.headline}
                    </h3>
                    <p className="text-sm text-[#a0a0a0] leading-relaxed font-body">
                      {feature.description}
                    </p>
                  </div>

                  <div className="md:w-3/5 flex items-center">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      {feature.highlights.map((h) => (
                        <div
                          key={h}
                          className="flex items-center gap-3 bg-[#1e1e1e] rounded-xl px-4 py-3 border border-[#333333]/50"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-[#53aecc] shrink-0" />
                          <span className="text-sm font-body">{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
