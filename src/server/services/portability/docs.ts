// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The schema/ folder of every programme export: the JSON Schema of
 * programme.json (draft 2020-12) and the explanation of every field in plain
 * words, in English (README.md) and in Spanish (LEEME.md). All three are
 * built from ./format.ts, so they always describe the file next to them.
 *
 * Pure: no database.
 */

import { z } from "zod";
import { Programme, PROGRAMME_FORMAT } from "./format";
import { CSV_TABLES, type Locale } from "./registers";

type Node = {
  type?: string | string[];
  description?: string;
  "x-description-es"?: string;
  properties?: Record<string, Node>;
  required?: string[];
  items?: Node;
  anyOf?: Node[];
  enum?: unknown[];
  const?: unknown;
  format?: string;
  default?: unknown;
};

/** A name, not an address: the schema travels inside every export. */
export const SCHEMA_ID = "urn:dpocentral:schema:programme:1.0";

/** The JSON Schema of programme.json, draft 2020-12. */
export function programmeJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(Programme, { target: "draft-2020-12", io: "input" }) as Record<string, unknown>;
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: SCHEMA_ID,
    title: "DPO Central programme",
    ...schema,
  };
}

/** The node without its "or empty" wrapper. */
function unwrap(node: Node): { node: Node; nullable: boolean } {
  if (node.anyOf) {
    const notNull = node.anyOf.filter((n) => n.type !== "null");
    if (notNull.length === 1) {
      return { node: { ...notNull[0], description: node.description ?? notNull[0]!.description, "x-description-es": node["x-description-es"] ?? notNull[0]!["x-description-es"] }, nullable: true };
    }
  }
  return { node, nullable: false };
}

const WORDS = {
  en: {
    text: "text",
    number: "number",
    integer: "whole number",
    boolean: "true or false",
    date: "date and time",
    list: "list of",
    record: "record",
    records: "records",
    any: "any JSON value",
    oneOf: "one of",
    required: "required",
    optional: "optional",
    field: "Field",
    kind: "Kind",
    need: "Required",
    meaning: "Meaning",
    yes: "yes",
    no: "no",
  },
  es: {
    text: "texto",
    number: "número",
    integer: "número entero",
    boolean: "verdadero o falso",
    date: "fecha y hora",
    list: "lista de",
    record: "registro",
    records: "registros",
    any: "cualquier valor JSON",
    oneOf: "uno de",
    required: "obligatorio",
    optional: "opcional",
    field: "Campo",
    kind: "Tipo",
    need: "Obligatorio",
    meaning: "Significado",
    yes: "sí",
    no: "no",
  },
} as const;

function describe(node: Node, locale: Locale): string {
  return (locale === "es" ? node["x-description-es"] : node.description) ?? node.description ?? "";
}

function kindOf(node: Node, locale: Locale): string {
  const w = WORDS[locale];
  if (node.enum) return `${w.oneOf}: ${node.enum.map((v) => `\`${String(v)}\``).join(", ")}`;
  if (node.const !== undefined) return `\`${String(node.const)}\``;
  if (node.type === "array") {
    const item = unwrap(node.items ?? {}).node;
    return `${w.list} ${item.type === "object" ? w.records : kindOf(item, locale)}`;
  }
  if (node.type === "object") return w.record;
  if (node.type === "string") return node.format === "date-time" ? w.date : w.text;
  if (node.type === "integer") return w.integer;
  if (node.type === "number") return w.number;
  if (node.type === "boolean") return w.boolean;
  return w.any;
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** One Markdown section per record shape, depth first. */
function sections(node: Node, path: string, locale: Locale, out: string[], level: number): void {
  const w = WORDS[locale];
  const props = node.properties ?? {};
  const required = new Set(node.required ?? []);
  out.push(`${"#".repeat(Math.min(level, 6))} \`${path}\``, "", describe(node, locale), "");
  out.push(`| ${w.field} | ${w.kind} | ${w.need} | ${w.meaning} |`, "|---|---|---|---|");
  const nested: Array<[string, Node]> = [];
  for (const [name, raw] of Object.entries(props)) {
    const { node: field } = unwrap(raw);
    out.push(
      `| \`${name}\` | ${cell(kindOf(field, locale))} | ${required.has(name) ? w.yes : w.no} | ${cell(describe(field, locale))} |`,
    );
    const item = field.type === "array" ? unwrap(field.items ?? {}).node : field;
    if (item.type === "object" && item.properties) {
      nested.push([`${path}.${name}${field.type === "array" ? "[]" : ""}`, { ...item, description: describe(item, "en") || describe(field, "en"), "x-description-es": describe(item, "es") || describe(field, "es") }]);
    }
  }
  out.push("");
  for (const [p, n] of nested) sections(n, p, locale, out, level + 1);
}

const INTRO: Record<Locale, (dsar: boolean) => string> = {
  en: (dsar) => `# Your privacy programme, exported from DPO Central

This archive holds everything your organisation entered in DPO Central, in an
open format you can read, keep, and take to another platform. It is yours.

## What is in the archive

| File | What it is |
|---|---|
| \`programme.json\` | The whole programme in one machine-readable file (format \`${PROGRAMME_FORMAT}\`). This is the file another system reads, and the file DPO Central imports. |
| \`csv/*.csv\` | One table per register, for a spreadsheet. UTF-8 with a byte-order mark, comma separated, one header row in the language you used when you exported. |
| \`schema/programme.schema.json\` | The JSON Schema (draft 2020-12) of \`programme.json\`. Any JSON Schema validator checks a file against it. |
| \`schema/README.md\`, \`schema/LEEME.md\` | This explanation, in English and in Spanish. |
| \`manifest.json\` | Every file of the archive with its size and SHA-256 digest, the number of records per register, and when and by which version of DPO Central it was made. |

DPO Central stores links to documents (contracts, incident evidence), not the
files themselves, so the archive has no \`files/\` folder: the links are in the
records (\`documentUrl\`, \`url\`).

## How records refer to each other

- Every record has an \`id\`: its identifier in DPO Central. Ids are stable (the
  same record keeps the same id in every export) and opaque (do not read
  meaning into them).
- A field that points at another record holds that record's id and is named
  after what it points at: \`dataAssetId\` is an id in \`dataAssets\`,
  \`vendorId\` an id in \`vendors\`, \`templateId\` an id in
  \`assessmentTemplates\`. References never depend on the order of a list.
- A field ending in \`PersonId\` is an id in \`people\`. A person id that is not
  in \`people\` belongs to someone who has since left the organisation.
- Laws are referred to by their code (\`jurisdictionCode\`, for example GDPR).
- Dates are ISO 8601 in UTC, for example \`2026-10-09T14:30:00.000Z\`.
- Fixed lists (status, type, legal basis...) hold English codes in
  \`programme.json\`, listed in the tables below; the CSV files show the same
  values as words.

## Drafts and confirmed records

Systems, processing activities and vendors carry \`confirmation\`: \`draft\` when a
template, the quick start or an import created the record and nobody has
checked it yet, \`confirmed\` when a person entered it or confirmed it (with who
and when). When this file is imported into DPO Central, every record arrives as
a draft ("to confirm") so that a person reviews it before it counts.

## What is not in the archive

- Other organisations' data.
- Passwords, sign-in sessions, API and licence keys, and the private links
  vendors use to answer questionnaires.
- The detail recorded in the audit trail: only who did what, to which record,
  and when (\`auditTrail\`).
${dsar ? "- Nothing is withheld from rights requests: this export was asked to include them, so it holds personal data of the people who made them. Keep it accordingly." : "- Rights requests (they hold personal data of the people who made them). They are added only when the person exporting ticks the separate box that says so."}

## Versions

The format's version is in \`format\`. A reader accepts any \`1.x\` file and
ignores fields it does not know: later 1.x versions only add fields. A change
that removes a field or changes its meaning will be version 2.0.

## CSV notes

- Lists inside a cell are separated by "; ".
- A cell that a spreadsheet would read as a formula (it starts with =, +, -, @)
  is written with an apostrophe in front, so opening the file never runs
  anything. Remove that apostrophe if you process the file by program.
- The tables of child records (\`vendor-contracts.csv\`,
  \`assessment-measures.csv\`, \`incident-timeline.csv\`) carry the id of the
  record they belong to.
${CSV_TABLES.map((t) => `- \`csv/${t.file}\`: ${t.en}.`).join("\n")}

## Every field of programme.json
`,
  es: (dsar) => `# Tu programa de privacidad, exportado de DPO Central

Este archivo comprimido contiene todo lo que tu organización introdujo en DPO
Central, en un formato abierto que puedes leer, guardar y llevar a otra
plataforma. Es tuyo.

## Qué contiene

| Archivo | Qué es |
|---|---|
| \`programme.json\` | Todo el programa en un único archivo legible por máquina (formato \`${PROGRAMME_FORMAT}\`). Es el archivo que lee otro sistema y el que importa DPO Central. |
| \`csv/*.csv\` | Una tabla por registro, para una hoja de cálculo. UTF-8 con marca de orden de bytes, separada por comas, con una fila de cabecera en el idioma que usabas al exportar. |
| \`schema/programme.schema.json\` | El esquema JSON (borrador 2020-12) de \`programme.json\`. Cualquier validador de JSON Schema comprueba un archivo con él. |
| \`schema/README.md\`, \`schema/LEEME.md\` | Esta explicación, en inglés y en español. |
| \`manifest.json\` | Cada archivo del comprimido con su tamaño y su huella SHA-256, el número de registros de cada tipo, y cuándo y con qué versión de DPO Central se generó. |

DPO Central guarda enlaces a los documentos (contratos, pruebas de incidencias),
no los archivos, así que el comprimido no tiene carpeta \`files/\`: los enlaces
están en los registros (\`documentUrl\`, \`url\`).

## Cómo se relacionan los registros

- Cada registro tiene un \`id\`: su identificador en DPO Central. Los ids son
  estables (el mismo registro conserva el mismo id en cada exportación) y
  opacos (no tienen significado propio).
- Un campo que señala otro registro contiene el id de ese registro y se llama
  como lo que señala: \`dataAssetId\` es un id de \`dataAssets\`, \`vendorId\` un id
  de \`vendors\`, \`templateId\` un id de \`assessmentTemplates\`. Las referencias
  nunca dependen del orden de una lista.
- Un campo que termina en \`PersonId\` es un id de \`people\`. Un id de persona
  que no está en \`people\` corresponde a alguien que ya no está en la
  organización.
- Las normas se citan por su código (\`jurisdictionCode\`, por ejemplo GDPR).
- Las fechas siguen la norma ISO 8601 en UTC, por ejemplo
  \`2026-10-09T14:30:00.000Z\`.
- Las listas fijas (estado, tipo, base jurídica...) llevan códigos en inglés en
  \`programme.json\`, enumerados en las tablas de abajo; los CSV muestran esos
  mismos valores con palabras.

## Borradores y registros confirmados

Los sistemas, las actividades de tratamiento y los proveedores llevan
\`confirmation\`: \`draft\` (borrador) cuando el registro lo creó una plantilla, el
inicio rápido o una importación y nadie lo ha revisado aún, y \`confirmed\`
(confirmado) cuando lo introdujo o lo confirmó una persona (con quién y cuándo).
Al importar este archivo en DPO Central, todos los registros llegan como
borradores ("por confirmar") para que una persona los revise antes de que
cuenten.

## Qué no contiene

- Datos de otras organizaciones.
- Contraseñas, sesiones, claves de API y de licencia, ni los enlaces privados
  con los que los proveedores responden a los cuestionarios.
- El detalle registrado en el registro de auditoría: solo quién hizo qué, sobre
  qué registro y cuándo (\`auditTrail\`).
${dsar ? "- No se ha omitido nada de las solicitudes de derechos: se pidió incluirlas, así que este archivo contiene datos personales de quienes las hicieron. Guárdalo con el cuidado que eso exige." : "- Las solicitudes de derechos (contienen datos personales de quienes las hicieron). Solo se añaden si quien exporta marca la casilla aparte que lo advierte."}

## Versiones

La versión del formato está en \`format\`. Un lector acepta cualquier archivo
\`1.x\` e ignora los campos que no conoce: las versiones 1.x posteriores solo
añaden campos. Un cambio que quite un campo o cambie su significado será la
versión 2.0.

## Notas sobre los CSV

- Las listas dentro de una celda se separan con "; ".
- Una celda que una hoja de cálculo leería como fórmula (empieza por =, +, -,
  @) se escribe con un apóstrofo delante, para que abrir el archivo nunca
  ejecute nada. Quita ese apóstrofo si tratas el archivo con un programa.
- Las tablas de registros dependientes (\`vendor-contracts.csv\`,
  \`assessment-measures.csv\`, \`incident-timeline.csv\`) llevan el id del registro
  al que pertenecen.
${CSV_TABLES.map((t) => `- \`csv/${t.file}\`: ${t.es}.`).join("\n")}

## Todos los campos de programme.json
`,
};

/** README.md (English) or LEEME.md (Spanish). */
export function programmeReadme(locale: Locale, options: { rightsRequests: boolean }): string {
  const schema = programmeJsonSchema() as Node;
  const out: string[] = [INTRO[locale](options.rightsRequests)];
  sections(schema, "programme", locale, out, 3);
  return out.join("\n");
}
