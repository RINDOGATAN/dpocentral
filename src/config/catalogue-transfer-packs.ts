// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Catalogue transfer packs: the transfer work a well-known catalogue vendor
 * has already published, ready to drop into a customer's programme when the
 * customer adds that vendor from the catalogue (src/server/services/catalogue-transfer-pack.ts).
 *
 * A pack gives, for one catalogue slug:
 *   - the international transfer record (destination, mechanism, safeguards);
 *   - the supplementary measures the vendor's published terms support;
 *   - the Schrems II checklist points those terms answer, with a note each;
 *   - a transfer impact assessment (TIA, in Spanish EIT) on the system
 *     template, waiting for the customer's approval.
 *
 * Every statement is the vendor's own published position, with its source
 * and date in `sources`, or a fact from an official register. Points the
 * vendor does not publish are left unanswered or flagged for the customer to
 * confirm. Questions that call for the customer's own judgment (likelihood,
 * severity, whether the transfer may proceed) are never answered: the
 * customer is the controller and approves the assessment itself.
 *
 * Every text exists in English and Spanish, so a record is shown in the
 * language of whoever reads it (./catalogue-transfer-content-pack.ts, through
 * src/lib/system-content/). This applies on the hosted service and on the
 * self-hosted kit alike: the vendor is the customer's own.
 *
 * Select answers are the template's English option labels; the writer stores
 * them in the language of the screen that added the vendor, through the
 * template's own option lists.
 */

import type { TransferMechanism } from "@prisma/client";

export type PackLocale = "en" | "es";
export type Bilingual = Record<PackLocale, string>;

export interface PackSource {
  label: string;
  url: string;
  /** The document's own date, where it shows one. */
  documentDate?: string;
  /** When the source was read for this pack (ISO date). */
  checkedAt: string;
}

export interface CatalogueTransferPack {
  /** The catalogue vendor slug that triggers the pack. */
  slug: string;
  /** Stored as metadata.source on every record the pack writes. */
  sourceRef: string;
  /** Changes whenever the content changes, so an old draft can be told apart. */
  version: string;
  /** The product the pack describes, where the vendor sells several. */
  product: Bilingual;
  transfer: {
    destinationCountry: string;
    destinationOrg: string;
    mechanism: TransferMechanism;
    name: Bilingual;
    description: Bilingual;
    safeguards: Bilingual;
    documentUrl: string;
    /** The official register entry to check for a partial adequacy decision (the DPF list). */
    adequacyScopeReference?: string;
  };
  supplementaryMeasures: readonly string[];
  checklist: Record<string, { state: "DONE" | "NA"; note: Bilingual }>;
  tia: {
    title: { name: Bilingual; description: Bilingual };
    choices: Record<string, string | string[] | boolean>;
    text: Record<PackLocale, Record<string, string>>;
  };
  sources: readonly PackSource[];
}

/** The date the consent-platform pack's facts were read. */
const CHECKED = "2026-10-26";

const ONETRUST_CMP: CatalogueTransferPack = {
  slug: "onetrust",
  sourceRef: "catalogue-pack:onetrust-cmp",
  version: "2026-10-26",
  product: { en: "Cookie Consent (consent management platform)", es: "Cookie Consent (plataforma de gestión del consentimiento)" },
  transfer: {
    destinationCountry: "US",
    destinationOrg: "OneTrust, LLC",
    mechanism: "ADEQUACY_DECISION",
    name: {
      en: "OneTrust (consent management): transfers to the United States",
      es: "OneTrust (gestión del consentimiento): transferencias a Estados Unidos",
    },
    description: {
      en:
        "OneTrust, LLC (Atlanta, United States) processes, as processor, the consent records of your website visitors and the accounts of your users of its consent management platform. " +
        "The tenant is hosted in the data centre chosen on your order form; its European Union environment is in Germany (Frankfurt, with Berlin for recovery, on Microsoft Azure). " +
        "Data can reach the United States through OneTrust's own access to provide and support the service, through its sub-processors (several are United States companies, among them its support and e-mail providers), and through the delivery network that serves the banner, whose traffic logs with IP addresses stay in the European Union only with the paid EU Data Residency option.",
      es:
        "OneTrust, LLC (Atlanta, Estados Unidos) trata, como encargado, los registros de consentimiento de los visitantes de tu web y las cuentas de tus usuarios de su plataforma de gestión del consentimiento. " +
        "El entorno se aloja en el centro de datos elegido en tu pedido; su entorno de la Unión Europea está en Alemania (Fráncfort, con Berlín para recuperación, en Microsoft Azure). " +
        "Los datos pueden llegar a Estados Unidos por el acceso de la propia OneTrust para prestar el servicio y darle soporte, por sus subencargados (varios son sociedades estadounidenses, entre ellos sus proveedores de soporte y de correo) y por la red de distribución que sirve el banner, cuyos registros de tráfico con direcciones IP solo se quedan en la Unión Europea con la opción de pago EU Data Residency.",
    },
    safeguards: {
      en:
        "EU-US Data Privacy Framework: OneTrust, LLC is an active participant (EU-US framework, UK Extension and Swiss-US framework, HR and non-HR data; next recertification due 13 July 2027). Its processing addendum treats a transfer to it as a transfer to an adequate country (section 3.4). " +
        "Fallback: the EU standard contractual clauses (Commission Implementing Decision (EU) 2021/914), Modules Two and Three, apply wherever no adequacy decision covers a transfer, under Irish law and the Irish courts (SCC amendment of 10 February 2026).",
      es:
        "Marco de Privacidad de Datos UE-EE. UU. (DPF): OneTrust, LLC figura como participante activo (marco UE-EE. UU., extensión del Reino Unido y marco Suiza-EE. UU., datos de RR. HH. y de otro tipo; próxima recertificación el 13 de julio de 2027). Su anexo de encargo trata una transferencia a ella como una transferencia a un país adecuado (apartado 3.4). " +
        "Respaldo: las cláusulas contractuales tipo de la UE (Decisión de Ejecución (UE) 2021/914), módulos dos y tres, se aplican cuando ninguna decisión de adecuación cubre una transferencia, con la ley y los tribunales de Irlanda (anexo de SCC de 10 de febrero de 2026).",
    },
    documentUrl: "https://legal.onetrust.com/",
    adequacyScopeReference: "https://www.dataprivacyframework.gov/participant/5263",
  },
  supplementaryMeasures: [
    "tech_encryption_transit",
    "tech_encryption_rest",
    "tech_access_controls",
    "cont_enhanced_clauses",
    "cont_transparency_obligations",
    "cont_audit_rights",
    "org_policies",
    "org_certification",
  ],
  checklist: {
    s2_1_map_transfers: {
      state: "DONE",
      note: {
        en: "OneTrust's own access, its sub-processors (list at my.onetrust.com) and the delivery network that serves the banner.",
        es: "Acceso de la propia OneTrust, sus subencargados (lista en my.onetrust.com) y la red de distribución que sirve el banner.",
      },
    },
    s2_2_identify_mechanism: {
      state: "DONE",
      note: {
        en: "EU-US Data Privacy Framework (participant 5263); standard contractual clauses as fallback.",
        es: "Marco de Privacidad de Datos UE-EE. UU. (participante 5263); cláusulas contractuales tipo como respaldo.",
      },
    },
    s2_2_scc_version: {
      state: "DONE",
      note: {
        en: "Commission Implementing Decision (EU) 2021/914, Modules Two and Three (SCC amendment of 10 February 2026).",
        es: "Decisión de Ejecución (UE) 2021/914, módulos dos y tres (anexo de SCC de 10 de febrero de 2026).",
      },
    },
    s2_3_assess_laws: {
      state: "DONE",
      note: { en: "See the TIA, step 2.", es: "Consulta la EIT, paso 2." },
    },
    s2_5_formal_steps: {
      state: "NA",
      note: {
        en: "Neither the adequacy decision nor the SCC need authorisation from the supervisory authority.",
        es: "Ni la decisión de adecuación ni las SCC necesitan autorización de la autoridad de control.",
      },
    },
    s2_5_documentation: {
      state: "DONE",
      note: { en: "The TIA attached to this transfer.", es: "La EIT vinculada a esta transferencia." },
    },
    s2_6_suspend_plan: {
      state: "DONE",
      note: {
        en: "The addendum obliges OneTrust to tell you and to suspend the transfers it cannot keep lawful (section 3.3), and moves them to other safeguards if the framework falls (section 3.4).",
        es: "El anexo obliga a OneTrust a avisarte y a suspender las transferencias que no pueda mantener lícitas (apartado 3.3), y las pasa a otras garantías si el marco decae (apartado 3.4).",
      },
    },
  },
  tia: {
    title: {
      name: {
        en: "TIA: OneTrust Cookie Consent (transfers to the United States)",
        es: "EIT: OneTrust Cookie Consent (transferencias a Estados Unidos)",
      },
      description: {
        en: "Prepared by TODO.LAW from OneTrust's published terms and the official Data Privacy Framework list. Check the points marked for confirmation, answer the risk questions in step 4 for your organisation, and approve it.",
        es: "Preparada por TODO.LAW a partir de las condiciones publicadas por OneTrust y de la lista oficial del Marco de Privacidad de Datos. Comprueba los puntos marcados para confirmar, responde a las preguntas de riesgo del paso 4 para tu organización y apruébala.",
      },
    },
    choices: {
      tiav2_1_1: "Adequacy decision (Art. 45)",
      tiav2_1_3: ["Contact details", "Identifiers", "Behavioural or usage data"],
      tiav2_1_5: true,
      tiav2_2_1: "Yes, partial adequacy",
      tiav2_2_2: "Access exists but with effective oversight and safeguards",
      tiav2_2_4: "Yes: independent judicial review",
      tiav2_3_1: ["Encryption in transit (TLS 1.2 or higher)"],
      tiav2_3_2: [
        "Duty to challenge government access requests",
        "Transparency reporting obligation",
        "Audit rights for the exporter",
        "Suspension or termination if the law changes",
      ],
      tiav2_3_3: [
        "Internal policy for responding to access requests",
        "A designated privacy or compliance team at the importer",
        "Recognised certifications (ISO 27001, SOC 2)",
      ],
      tiav2_5_1: [
        "New legislation or executive order in the destination",
        "Adequacy decision revoked or challenged",
        "The importer receives a government access request",
        "Change in data categories or volume",
        "Change of sub-processor or onward transfer",
        "Periodic review (at least every 12 months)",
        "Supervisory authority guidance or enforcement",
      ],
    },
    text: {
      en: {
        tiav2_1_4:
          "Exporter: your organisation, as controller, in the European Economic Area. Importer: OneTrust, LLC (Atlanta, Georgia, United States), as processor under its Data Processing Addendum (version 2.2, in effect from 23 March 2026); OT Technology, Inc. is a covered entity in its Data Privacy Framework listing. " +
          "Product: Cookie Consent, the consent management platform. The data is the record of your visitors' consent (IP address, a consent identifier, their choices and, if switched on, their location) and the accounts of your users of the platform (name, e-mail, job title). " +
          "The tenant is hosted in the data centre chosen on your order form; OneTrust's European Union environment is in Germany (Frankfurt, with Berlin for recovery, on Microsoft Azure). To confirm: which environment your order form names. " +
          "Onward transfers go to OneTrust's sub-processors (list at my.onetrust.com), several of them United States companies. The banner is served through a global delivery network (Cloudflare); keeping its traffic logs with IP addresses in the European Union is a paid option (EU Data Residency). To confirm: whether you have it. " +
          "OneTrust does not publish from which countries its support staff reach customer data. To confirm with OneTrust.",
        tiav2_2_5:
          "OneTrust, LLC is an active participant in the EU-US Data Privacy Framework, with the UK Extension and the Swiss-US framework, for HR and non-HR data (official list, participant 5263, checked 26 October 2026; next recertification due 13 July 2027). For transfers to it, the Commission's adequacy decision of 10 July 2023 (Implementing Decision (EU) 2023/1795) applies, and its addendum treats them as transfers to an adequate country (section 3.4). " +
          "Executive Order 14086 limits United States signals intelligence to what is necessary and proportionate and created the Data Protection Review Court, open to people in the European Union. The laws to keep in view remain Section 702 of the Foreign Intelligence Surveillance Act, Executive Order 12333 and the CLOUD Act. " +
          "Where no adequacy decision covers a transfer (for example, access from a country other than the United States, or if the framework falls), the standard contractual clauses apply, Modules Two and Three, under Irish law (SCC amendment of 10 February 2026). " +
          "OneTrust publishes a policy and a transparency report on government requests (onetrust.com/transparency-report); check its current figures before answering step 2 on requests in practice.",
        tiav2_3_4:
          "Technical: OneTrust states that it encrypts data in transit and at rest; its hosting documentation says backups are encrypted with AES-256 (Azure Transparent Data Encryption). The keys are not held by your organisation, so this encryption protects against unauthorised access, not against compelled disclosure. " +
          "Contractual: the addendum obliges OneTrust to disclose data to public authorities only where the law requires it, to review the legality of each request and challenge it where lawful and appropriate (section 11), to notify you and suspend transfers it cannot keep lawful (section 3.3), and gives you audit rights (section 10); the SCC amendment adds transparency commitments (no back doors, information on public access on request). " +
          "Organisational: internal policies on transfers and government requests, need-to-know access, a named data protection officer, and certifications: ISO/IEC 27001:2022, 27017:2015 and 27701:2019 and a SOC 2 Type 2 report. " +
          "Whether these measures are enough for your organisation is your judgment in step 4.",
      },
      es: {
        tiav2_1_4:
          "Exportador: tu organización, como responsable, en el Espacio Económico Europeo. Importador: OneTrust, LLC (Atlanta, Georgia, Estados Unidos), como encargado con su anexo de encargo del tratamiento (versión 2.2, en vigor desde el 23 de marzo de 2026); OT Technology, Inc. es una entidad cubierta en su inscripción en el Marco de Privacidad de Datos. " +
          "Producto: Cookie Consent, la plataforma de gestión del consentimiento. Los datos son el registro del consentimiento de tus visitantes (dirección IP, un identificador de consentimiento, sus elecciones y, si se activa, su ubicación) y las cuentas de tus usuarios de la plataforma (nombre, correo, cargo). " +
          "El entorno se aloja en el centro de datos elegido en tu pedido; el entorno de la Unión Europea de OneTrust está en Alemania (Fráncfort, con Berlín para recuperación, en Microsoft Azure). Por confirmar: qué entorno nombra tu pedido. " +
          "Las transferencias ulteriores van a los subencargados de OneTrust (lista en my.onetrust.com), varios de ellos sociedades estadounidenses. El banner se sirve por una red de distribución mundial (Cloudflare); mantener sus registros de tráfico con direcciones IP en la Unión Europea es una opción de pago (EU Data Residency). Por confirmar: si la tienes contratada. " +
          "OneTrust no publica desde qué países accede su personal de soporte a los datos de clientes. Por confirmar con OneTrust.",
        tiav2_2_5:
          "OneTrust, LLC figura como participante activo en el Marco de Privacidad de Datos UE-EE. UU., con la extensión del Reino Unido y el marco Suiza-EE. UU., para datos de RR. HH. y de otro tipo (lista oficial, participante 5263, consultada el 26 de octubre de 2026; próxima recertificación el 13 de julio de 2027). A las transferencias a ella se aplica la decisión de adecuación de la Comisión de 10 de julio de 2023 (Decisión de Ejecución (UE) 2023/1795), y su anexo las trata como transferencias a un país adecuado (apartado 3.4). " +
          "La Orden Ejecutiva 14086 limita la inteligencia de señales estadounidense a lo necesario y proporcionado y ha creado el Tribunal de Revisión de la Protección de Datos, al que pueden acudir las personas de la Unión Europea. Siguen siendo relevantes el artículo 702 de la Ley de Vigilancia de Inteligencia Extranjera, la Orden Ejecutiva 12333 y la CLOUD Act. " +
          "Cuando ninguna decisión de adecuación cubre una transferencia (por ejemplo, un acceso desde un país distinto de Estados Unidos, o si el marco decae), se aplican las cláusulas contractuales tipo, módulos dos y tres, con la ley de Irlanda (anexo de SCC de 10 de febrero de 2026). " +
          "OneTrust publica una política y un informe de transparencia sobre solicitudes de las autoridades (onetrust.com/transparency-report); revisa sus cifras actuales antes de responder en el paso 2 a la pregunta sobre solicitudes en la práctica.",
        tiav2_3_4:
          "Técnicas: OneTrust declara que cifra los datos en tránsito y en reposo; su documentación de alojamiento indica que las copias de seguridad se cifran con AES-256 (Transparent Data Encryption de Azure). Las claves no las custodia tu organización, así que este cifrado protege frente a accesos no autorizados, no frente a una revelación obligada. " +
          "Contractuales: el anexo obliga a OneTrust a revelar datos a las autoridades solo cuando la ley lo exija, a revisar la legalidad de cada solicitud e impugnarla cuando sea lícito y procedente (apartado 11), a avisarte y suspender las transferencias que no pueda mantener lícitas (apartado 3.3), y te da derecho de auditoría (apartado 10); el anexo de SCC añade compromisos de transparencia (sin puertas traseras, información sobre el acceso de las autoridades si la pides). " +
          "Organizativas: políticas internas sobre transferencias y solicitudes de las autoridades, acceso según la necesidad de conocer, un delegado de protección de datos designado y certificaciones: ISO/IEC 27001:2022, 27017:2015 y 27701:2019 y un informe SOC 2 tipo 2. " +
          "Si estas medidas bastan para tu organización es una valoración tuya en el paso 4.",
      },
    },
  },
  sources: [
    { label: "Data Privacy Framework list, participant 5263", url: "https://www.dataprivacyframework.gov/participant/5263", checkedAt: CHECKED },
    { label: "OneTrust Data Processing Addendum, version 2.2", url: "https://onetrust.pactsafe.io/versions/69c1e0cc26ea7890551abf6d.pdf", documentDate: "2026-03-23", checkedAt: CHECKED },
    { label: "OneTrust Amendment to Incorporate Standard Contractual Clauses, version 2.2", url: "https://onetrust.pactsafe.io/versions/6a8785d7c7bef748505fd633.pdf", documentDate: "2026-02-10", checkedAt: CHECKED },
    { label: "About OneTrust Hosting Options, Locations, and Backup", url: "https://docs.onetrust.com/en/account-management/hosting--infrastructure/about-onetrust-hosting-options-locations-and-backup", documentDate: "2026-10-15", checkedAt: CHECKED },
    { label: "About OneTrust EU Data Residency Options for Cloudflare", url: "https://docs.onetrust.com/en/account-management/hosting--infrastructure/about-onetrust-eu-data-residency-options-for-cloudflare", documentDate: "2026-10-15", checkedAt: CHECKED },
    { label: "OneTrust Trust Center", url: "https://www.onetrust.com/trust/", checkedAt: CHECKED },
    { label: "Commission Implementing Decision (EU) 2023/1795 (EU-US Data Privacy Framework)", url: "https://eur-lex.europa.eu/eli/dec_impl/2023/1795/oj", documentDate: "2023-07-10", checkedAt: CHECKED },
  ],
};

/** All packs, by catalogue slug. */
export const CATALOGUE_TRANSFER_PACKS: Readonly<Record<string, CatalogueTransferPack>> = {
  [ONETRUST_CMP.slug]: ONETRUST_CMP,
};

export function transferPackFor(slug: string | null | undefined): CatalogueTransferPack | null {
  if (!slug) return null;
  return CATALOGUE_TRANSFER_PACKS[slug] ?? null;
}
