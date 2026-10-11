// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Model replies to rights requests (owner's approval, 11 October 2026). The
 * organisation's own letters to the requester, in the controller's voice
 * ("we" is the organisation), in English and in Castilian Spanish ("tú").
 * Staff insert one into a message from the request page; the app fills the
 * placeholders it knows (src/lib/dsar-model-replies.ts) and sending is
 * blocked while any placeholder remains.
 *
 * The texts are the approved ones, verbatim: change them only with a new
 * approval. The notes for the organisation's team in the approved document
 * are not part of the letters and are not here.
 *
 * Placeholders, the same in both languages:
 *   {requester_name} {controller_name} {reference} {received_date}
 *   {due_date} {new_due_date} {status_link} {privacy_contact}
 *   {reasons} {details} {information_needed} {data_changed}
 */

import type { DSARType } from "@prisma/client";

export type ModelReplyLanguage = "en" | "es";

export const MODEL_REPLY_PLACEHOLDERS = [
  "requester_name",
  "controller_name",
  "reference",
  "received_date",
  "due_date",
  "new_due_date",
  "status_link",
  "privacy_contact",
  "reasons",
  "details",
  "information_needed",
  "data_changed",
] as const;
export type ModelReplyPlaceholder = (typeof MODEL_REPLY_PLACEHOLDERS)[number];

export interface ModelReply {
  id: string;
  /** Request types it is offered for; "all" for every type. */
  appliesTo: readonly DSARType[] | "all";
  text: Record<ModelReplyLanguage, { subject: string; body: string }>;
}

// ── Favourable replies: one opening and closing, a middle per right ──────

const FAVOURABLE_OPENING: Record<ModelReplyLanguage, string> = {
  en: "Dear {requester_name},\n\nWe have dealt with your request of {received_date} (reference {reference}).",
  es: "Hola, {requester_name}:\n\nHemos atendido tu solicitud del {received_date} (referencia {reference}).",
};

const FAVOURABLE_CLOSING: Record<ModelReplyLanguage, string> = {
  en: "If you have any questions, write to {privacy_contact}. If you are not satisfied with this answer, you may lodge a complaint with the Spanish Data Protection Agency (sede.aepd.gob.es).\n\nKind regards,\n{controller_name}",
  es: "Si tienes cualquier duda, escríbenos a {privacy_contact}. Si no estás conforme con esta respuesta, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (sede.aepd.gob.es).\n\nUn saludo,\n{controller_name}",
};

function favourable(
  id: string,
  appliesTo: readonly DSARType[],
  middle: Record<ModelReplyLanguage, string>
): ModelReply {
  const body = (l: ModelReplyLanguage) => `${FAVOURABLE_OPENING[l]}\n\n${middle[l]}\n\n${FAVOURABLE_CLOSING[l]}`;
  // The approved favourable replies carry no subject line; staff write one.
  return { id, appliesTo, text: { en: { subject: "", body: body("en") }, es: { subject: "", body: body("es") } } };
}

const ERASURE_DONE = {
  en: "You asked us to erase your personal data. We have erased it from our systems and told the recipients to whom we had disclosed it, unless this proved impossible or involved disproportionate effort (Article 19 GDPR).",
  es: "Nos pediste que suprimiéramos tus datos personales. Los hemos suprimido de nuestros sistemas y lo hemos comunicado a los destinatarios a los que los habíamos comunicado, salvo que haya sido imposible o haya exigido un esfuerzo desproporcionado (artículo 19 del RGPD).",
};

const ERASURE_BLOCKED = {
  en: "Some of your data, {details}, has been blocked rather than erased at once, because the law requires us to keep it for a time. Blocked data is not used for any purpose; it is kept only so that it can be made available to the courts, the public prosecutor or the competent public authorities, in particular the data protection authorities, to deal with any liability arising from the processing, for as long as such liability may arise. It will then be erased (Article 32 LOPDGDD).",
  es: "Algunos de tus datos, {details}, han quedado bloqueados en lugar de suprimirse de inmediato, porque la ley nos obliga a conservarlos durante un tiempo. Los datos bloqueados no se usan para ningún fin; solo se conservan a disposición de los jueces y tribunales, el Ministerio Fiscal o las Administraciones públicas competentes, en particular las autoridades de protección de datos, para atender las posibles responsabilidades derivadas del tratamiento, durante el plazo de prescripción de estas. Después se suprimirán (artículo 32 de la LOPDGDD).",
};

export const DSAR_MODEL_REPLIES: readonly ModelReply[] = [
  // 1. Acknowledgement of receipt
  {
    id: "acknowledgement",
    appliesTo: "all",
    text: {
      en: {
        subject: "We have received your request ({reference})",
        body: `Dear {requester_name},

We received your request on {received_date}. Its reference is {reference}.

We will answer within one month of receipt, that is, by {due_date}. If we need more time because the request is complex or we have many requests, we will tell you before that date and explain why (Article 12(3) GDPR).

You can see the status of your request at any time here: {status_link}. Anyone with this link can see the status and withdraw the request, so please do not share it.

If you have any questions, write to {privacy_contact}.

Kind regards,
{controller_name}`,
      },
      es: {
        subject: "Hemos recibido tu solicitud ({reference})",
        body: `Hola, {requester_name}:

Recibimos tu solicitud el {received_date}. Su referencia es {reference}.

Te responderemos en el plazo de un mes desde que la recibimos, es decir, a más tardar el {due_date}. Si necesitamos más tiempo porque la solicitud es compleja o tenemos muchas solicitudes, te lo diremos antes de esa fecha y te explicaremos por qué (artículo 12.3 del RGPD).

Puedes consultar el estado de tu solicitud en cualquier momento aquí: {status_link}. Cualquiera que tenga este enlace puede ver el estado y retirar la solicitud, así que no lo compartas.

Si tienes cualquier duda, escríbenos a {privacy_contact}.

Un saludo,
{controller_name}`,
      },
    },
  },
  // 2. Request for more information to confirm identity
  {
    id: "identity",
    appliesTo: "all",
    text: {
      en: {
        subject: "We need to confirm your identity ({reference})",
        body: `Dear {requester_name},

Thank you for your request of {received_date} (reference {reference}).

Before we can act on it, we need to be sure that we are dealing with the person the data relates to, so that we do not disclose or change anyone's data by mistake. Please send us the following: {information_needed}.

We ask for this under Article 12(6) GDPR, and we will use it only to confirm your identity. Until we receive it, we cannot process your request. Reply to this message or write to {privacy_contact}.

Kind regards,
{controller_name}`,
      },
      es: {
        subject: "Necesitamos confirmar tu identidad ({reference})",
        body: `Hola, {requester_name}:

Gracias por tu solicitud del {received_date} (referencia {reference}).

Antes de atenderla, necesitamos asegurarnos de que tratamos con la persona a la que se refieren los datos, para no comunicar ni modificar por error los datos de nadie. Por favor, envíanos lo siguiente: {information_needed}.

Te lo pedimos conforme al artículo 12.6 del RGPD y solo lo usaremos para confirmar tu identidad. Hasta que lo recibamos no podemos tramitar tu solicitud. Responde a este mensaje o escríbenos a {privacy_contact}.

Un saludo,
{controller_name}`,
      },
    },
  },
  // 3. Extension of the time limit
  {
    id: "extension",
    appliesTo: "all",
    text: {
      en: {
        subject: "We need more time to answer your request ({reference})",
        body: `Dear {requester_name},

We are working on your request of {received_date} (reference {reference}). We will not be able to complete it within one month, for these reasons: {reasons}.

Under Article 12(3) GDPR we are therefore extending the time limit. We will answer by {new_due_date} at the latest.

You can follow the status of your request here: {status_link}. If you have any questions, write to {privacy_contact}.

Kind regards,
{controller_name}`,
      },
      es: {
        subject: "Necesitamos más tiempo para responder a tu solicitud ({reference})",
        body: `Hola, {requester_name}:

Estamos tramitando tu solicitud del {received_date} (referencia {reference}). No podremos terminarla en el plazo de un mes, por estos motivos: {reasons}.

Por ello, conforme al artículo 12.3 del RGPD, ampliamos el plazo. Te responderemos a más tardar el {new_due_date}.

Puedes seguir el estado de tu solicitud aquí: {status_link}. Si tienes cualquier duda, escríbenos a {privacy_contact}.

Un saludo,
{controller_name}`,
      },
    },
  },
  // 4. Refusal
  {
    id: "refusal",
    appliesTo: "all",
    text: {
      en: {
        subject: "Answer to your request ({reference})",
        body: `Dear {requester_name},

We have examined your request of {received_date} (reference {reference}). We are not able to act on it, for these reasons: {reasons}.

If you disagree, you have the right to lodge a complaint with the Spanish Data Protection Agency (Agencia Española de Protección de Datos, C/ Jorge Juan 6, 28001 Madrid; electronic office: sede.aepd.gob.es) or with the supervisory authority of the EU Member State where you live or work, and the right to seek a judicial remedy before the courts (Articles 77 and 79 GDPR).

If you have any questions, write to {privacy_contact}.

Kind regards,
{controller_name}`,
      },
      es: {
        subject: "Respuesta a tu solicitud ({reference})",
        body: `Hola, {requester_name}:

Hemos estudiado tu solicitud del {received_date} (referencia {reference}). No podemos atenderla, por estos motivos: {reasons}.

Si no estás de acuerdo, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (C/ Jorge Juan 6, 28001 Madrid; sede electrónica: sede.aepd.gob.es) o ante la autoridad de control del Estado miembro de la UE en el que residas o trabajes, y a ejercer acciones ante los tribunales (artículos 77 y 79 del RGPD).

Si tienes cualquier duda, escríbenos a {privacy_contact}.

Un saludo,
{controller_name}`,
      },
    },
  },
  // 5. Favourable replies, one per right
  favourable("favourable-access", ["ACCESS"], {
    en: "You asked for access to your personal data. You can download a copy of the data we hold about you from your request's page: {status_link}. The copy comes with the information the law requires: why we use your data, which categories of data we hold, who receives it, how long we keep it, where it came from, whether it is transferred outside the European Union and with what safeguards, and whether we make automated decisions about you: {details}. You also have the rights to rectification, erasure, restriction, objection and portability.",
    es: "Nos pediste acceso a tus datos personales. Puedes descargar una copia de los datos que tenemos sobre ti en la página de tu solicitud: {status_link}. La copia va acompañada de la información que exige la ley: para qué usamos tus datos, qué categorías de datos tenemos, quién los recibe, cuánto tiempo los conservamos, de dónde proceden, si se transfieren fuera de la Unión Europea y con qué garantías, y si tomamos decisiones automatizadas sobre ti: {details}. También tienes los derechos de rectificación, supresión, limitación, oposición y portabilidad.",
  }),
  favourable("favourable-rectification", ["RECTIFICATION"], {
    en: "You asked us to correct your personal data. We have made these changes: {data_changed}. We have also told the recipients to whom we had disclosed the data, unless this proved impossible or involved disproportionate effort (Article 19 GDPR).",
    es: "Nos pediste que corrigiéramos tus datos personales. Hemos hecho estos cambios: {data_changed}. También lo hemos comunicado a los destinatarios a los que habíamos comunicado los datos, salvo que haya sido imposible o haya exigido un esfuerzo desproporcionado (artículo 19 del RGPD).",
  }),
  favourable("favourable-erasure", ["ERASURE"], ERASURE_DONE),
  // The same, with the second paragraph: some data kept blocked (Article 32 LOPDGDD).
  favourable("favourable-erasure-blocked", ["ERASURE"], {
    en: `${ERASURE_DONE.en}\n\n${ERASURE_BLOCKED.en}`,
    es: `${ERASURE_DONE.es}\n\n${ERASURE_BLOCKED.es}`,
  }),
  favourable("favourable-objection", ["OBJECTION"], {
    en: "You objected to our use of your personal data for {details}. We have stopped using your data for that purpose. Where the objection concerns direct marketing, we will not use your data for it again.",
    es: "Te opusiste a que usáramos tus datos personales para {details}. Hemos dejado de usar tus datos para ese fin. Si la oposición se refiere a mercadotecnia directa, no volveremos a usar tus datos para ello.",
  }),
  favourable("favourable-restriction", ["RESTRICTION"], {
    en: "You asked us to restrict the use of your personal data. From now on we only store it and do not use it for anything else, except with your consent, to establish, exercise or defend legal claims, to protect the rights of another person, or for important reasons of public interest. We will tell you before the restriction is lifted. Details: {details}.",
    es: "Nos pediste que limitáramos el uso de tus datos personales. Desde ahora solo los conservamos y no los usamos para nada más, salvo con tu consentimiento, para formular, ejercer o defender reclamaciones, para proteger los derechos de otra persona o por razones importantes de interés público. Te avisaremos antes de levantar la limitación. Detalles: {details}.",
  }),
  favourable("favourable-portability", ["PORTABILITY"], {
    en: "You asked to receive the personal data you gave us in a portable format. You can download it, in a structured, commonly used and machine-readable format, from your request's page: {status_link}. If you asked us to send it directly to another organization, we have done so where technically possible: {details}.",
    es: "Nos pediste recibir en un formato portable los datos personales que nos facilitaste. Puedes descargarlos, en un formato estructurado, de uso común y de lectura mecánica, en la página de tu solicitud: {status_link}. Si nos pediste que los enviáramos directamente a otra organización, lo hemos hecho cuando ha sido técnicamente posible: {details}.",
  }),
  // 6. Repetitive request (access more than once in six months)
  {
    id: "repetitive",
    appliesTo: ["ACCESS"],
    text: {
      en: {
        subject: "Answer to your request ({reference})",
        body: `Dear {requester_name},

We received your request for access of {received_date} (reference {reference}). We answered a request for access from you on {details}, less than six months ago, and since then the data we hold about you and the way we use it have not changed.

Under Article 13.3 of Spanish Organic Law 3/2018 (LOPDGDD), an access request made more than once within six months without a legitimate reason may be treated as repetitive, and under Article 12(5) GDPR we may decline to act on it. We are therefore not providing a new copy at this time. If there is a reason we are not aware of for a new copy (for example, you believe your data has changed), tell us and we will look at your request again.

If you disagree, you have the right to lodge a complaint with the Spanish Data Protection Agency (Agencia Española de Protección de Datos, sede.aepd.gob.es) and to seek a judicial remedy before the courts (Articles 77 and 79 GDPR).

Kind regards,
{controller_name}`,
      },
      es: {
        subject: "Respuesta a tu solicitud ({reference})",
        body: `Hola, {requester_name}:

Recibimos tu solicitud de acceso del {received_date} (referencia {reference}). Ya atendimos una solicitud de acceso tuya el {details}, hace menos de seis meses, y desde entonces no han cambiado los datos que tenemos sobre ti ni el uso que hacemos de ellos.

Conforme al artículo 13.3 de la Ley Orgánica 3/2018 (LOPDGDD), el ejercicio del derecho de acceso en más de una ocasión durante seis meses sin causa legítima puede considerarse repetitivo y, conforme al artículo 12.5 del RGPD, podemos no atenderlo. Por ello, no te enviamos una nueva copia por ahora. Si hay algún motivo que no conozcamos para pedir una nueva copia (por ejemplo, si crees que tus datos han cambiado), dínoslo y volveremos a estudiar tu solicitud.

Si no estás de acuerdo, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (sede.aepd.gob.es) y a ejercer acciones ante los tribunales (artículos 77 y 79 del RGPD).

Un saludo,
{controller_name}`,
      },
    },
  },
];
