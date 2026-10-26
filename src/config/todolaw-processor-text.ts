// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The words of the TODO.LAW processor records (vendor, processing agreement,
 * transfer) that src/server/services/todolaw-processor.ts writes into every
 * hosted organisation's programme, in both languages. Pure leaf module: the
 * writer stores one language, and src/lib/system-content/ shows the stored
 * text in each reader's language through these same strings.
 */

import { PILOT_DPA, type PilotDpaLocale } from "@/config/pilot-dpa";

export const TODOLAW_VENDOR_NAME = "TODO.LAW";
export const TODOLAW_ENTITY = "RINDOGATAN LLC";

export const TODOLAW_LINKS = {
  website: "https://www.todo.law",
  sccs: "https://www.todo.law/legal/sccs/eu-c2p/",
  dpa: PILOT_DPA.href,
  subprocessors: {
    en: "https://www.todo.law/legal/eu-cloud-plan-subprocessors",
    es: "https://www.todo.law/es/legal/subencargados-plan-nube-ue",
  },
} as const;

export interface TodoLawProcessorText {
  description: string;
  contractName: (version: string) => string;
  contractDescription: (subprocessors: string) => string;
  transferName: string;
  transferDescription: string;
  safeguards: string;
}

export const TODOLAW_PROCESSOR_TEXT: Record<PilotDpaLocale, TodoLawProcessorText> = {
  en: {
    description:
      "Provides DPO Central (and AI Sentinel and VendorWatch, where used) as a cloud service. " +
      `${TODOLAW_ENTITY}, a Wyoming (United States) company, acts as processor under the processing agreement the organization accepted. ` +
      "The data is stored in European Union data centres (Frankfurt); its staff may access it from the United States.",
    contractName: (version) =>
      `Data processing agreement (TODO.LAW cloud services), version ${version}`,
    contractDescription: (subprocessors) =>
      "Accepted when the organization was opened on the TODO.LAW cloud. It incorporates the EU standard contractual clauses, Module Two. " +
      `Sub-processors: ${subprocessors}`,
    transferName: "TODO.LAW: access from the United States",
    transferDescription: `${TODOLAW_ENTITY} is a United States company. The data stays in European Union data centres; its staff may access it from the United States, only in the cases the processing agreement sets out (clause 6).`,
    safeguards:
      "EU standard contractual clauses (Commission Implementing Decision (EU) 2021/914), Module Two (controller to processor), incorporated into the processing agreement (clause 9).",
  },
  es: {
    description:
      "Presta DPO Central (y AI Sentinel y VendorWatch, si se usan) como servicio en la nube. " +
      `${TODOLAW_ENTITY}, sociedad de Wyoming (Estados Unidos), actúa como encargado del tratamiento con el contrato de encargo que la organización ha aceptado. ` +
      "Los datos se guardan en centros de datos de la Unión Europea (Fráncfort); su personal puede acceder a ellos desde Estados Unidos.",
    contractName: (version) =>
      `Contrato de encargo del tratamiento (servicios en la nube de TODO.LAW), versión ${version}`,
    contractDescription: (subprocessors) =>
      "Aceptado al abrir la organización en la nube de TODO.LAW. Incorpora las cláusulas contractuales tipo de la UE, módulo dos. " +
      `Subencargados: ${subprocessors}`,
    transferName: "TODO.LAW: acceso desde Estados Unidos",
    transferDescription: `${TODOLAW_ENTITY} es una sociedad estadounidense. Los datos se quedan en centros de datos de la Unión Europea; su personal puede acceder a ellos desde Estados Unidos, solo en los casos que fija el contrato de encargo (cláusula 6).`,
    safeguards:
      "Cláusulas contractuales tipo de la UE (Decisión de Ejecución (UE) 2021/914), módulo dos (de responsable a encargado), incorporadas al contrato de encargo (cláusula 9).",
  },
};
