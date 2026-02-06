import { Database, Users, AlertTriangle, FileCheck, Building2 } from "lucide-react";

const sidebarItems = [
  { icon: Database, label: "Data Inventory", active: true },
  { icon: Users, label: "DSARs", active: false },
  { icon: AlertTriangle, label: "Incidents", active: false },
  { icon: FileCheck, label: "Assessments", active: false },
  { icon: Building2, label: "Vendors", active: false },
];

const mockRows = [
  { name: "Customer CRM", category: "Marketing", lawfulBasis: "Consent", status: "Mapped" },
  { name: "HR Payroll System", category: "Employment", lawfulBasis: "Contract", status: "Mapped" },
  { name: "Analytics Platform", category: "Marketing", lawfulBasis: "Legit. Interest", status: "Review" },
  { name: "Support Ticketing", category: "Operations", lawfulBasis: "Contract", status: "Mapped" },
];

export function DPOInterfacePreview() {
  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Browser chrome */}
      <div className="rounded-t-2xl bg-[#242424] border border-[#333333] border-b-0 px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-[#53aecc]/40" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-[#1a1a1a] rounded-lg px-4 py-1.5 text-xs text-[#a0a0a0] font-body max-w-md mx-auto text-center">
            dpocentral.todo.law
          </div>
        </div>
      </div>

      {/* App frame */}
      <div className="rounded-b-2xl border border-[#333333] bg-[#242424] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex min-h-[380px]">
          {/* Sidebar */}
          <div className="w-48 bg-[#1e1e1e] border-r border-[#333333] p-3 shrink-0 hidden sm:block">
            <div className="mb-4 px-2">
              <span className="text-sm font-display text-[#53aecc]">DPO Central</span>
            </div>
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-body transition-colors ${
                      item.active
                        ? "bg-[#53aecc]/15 text-[#53aecc]"
                        : "text-[#a0a0a0]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h4 className="text-sm font-display">Data Inventory & ROPA</h4>
                <p className="text-xs text-[#a0a0a0] font-body mt-0.5">
                  4 processing activities mapped
                </p>
              </div>
              <div className="btn-primary text-xs py-1.5 px-3 cursor-default">+ Add Activity</div>
            </div>

            {/* Table */}
            <div className="border border-[#333333] rounded-xl overflow-hidden">
              <table className="w-full text-xs font-body">
                <thead>
                  <tr className="bg-[#1e1e1e] text-[#a0a0a0]">
                    <th className="text-left px-3 py-2.5 font-medium">Processing Activity</th>
                    <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Category</th>
                    <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Lawful Basis</th>
                    <th className="text-left px-3 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockRows.map((row, i) => (
                    <tr
                      key={row.name}
                      className={`border-t border-[#333333] ${i % 2 === 0 ? "" : "bg-[#1e1e1e]/50"}`}
                    >
                      <td className="px-3 py-2.5 text-[#fefeff]">{row.name}</td>
                      <td className="px-3 py-2.5 text-[#a0a0a0] hidden md:table-cell">{row.category}</td>
                      <td className="px-3 py-2.5 text-[#a0a0a0] hidden lg:table-cell">{row.lawfulBasis}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            row.status === "Mapped"
                              ? "bg-[#53aecc]/15 text-[#53aecc]"
                              : "bg-yellow-500/15 text-yellow-500"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative glow */}
      <div className="absolute -inset-4 bg-[#53aecc]/5 rounded-3xl -z-10 blur-2xl" />
    </div>
  );
}
