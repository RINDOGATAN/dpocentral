// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AssessmentType } from "@prisma/client";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/safe-equal";

// API key for template sync (set in environment). Compared in constant
// time; the route is rate-limited per client address in src/middleware.ts
// ("import" bucket, shared with /api/import/*).
const SYNC_API_KEY = process.env.TEMPLATE_SYNC_API_KEY;

// Max templates per sync request
const MAX_TEMPLATES = 50;

interface TemplatePayload {
  id: string;
  type: AssessmentType;
  name: string;
  description?: string;
  version: string;
  isSystem: boolean;
  isActive: boolean;
  sections: any[];
  scoringLogic?: any;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Verify API key
  const apiKey = request.headers.get("X-API-Key");

  if (!SYNC_API_KEY) {
    logger.warn("Template sync attempted but not configured", { ip });
    return NextResponse.json(
      { error: "Template sync not configured" },
      { status: 500 }
    );
  }

  if (!apiKey || !safeEqual(apiKey, SYNC_API_KEY)) {
    logger.warn("Template sync unauthorized attempt", { ip, userAgent });
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const templates: TemplatePayload[] = body.templates;

    if (!templates || !Array.isArray(templates)) {
      logger.warn("Template sync invalid payload", { ip });
      return NextResponse.json(
        { error: "Invalid payload: templates array required" },
        { status: 400 }
      );
    }

    if (templates.length > MAX_TEMPLATES) {
      logger.warn("Template sync payload too large", { ip, count: templates.length });
      return NextResponse.json(
        { error: `Too many templates: max ${MAX_TEMPLATES} per request` },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;

    for (const template of templates) {
      const existing = await prisma.assessmentTemplate.findUnique({
        where: { id: template.id },
      });

      if (existing) {
        await prisma.assessmentTemplate.update({
          where: { id: template.id },
          data: {
            type: template.type,
            name: template.name,
            description: template.description,
            version: template.version,
            isSystem: template.isSystem,
            isActive: template.isActive,
            sections: template.sections,
            scoringLogic: template.scoringLogic,
          },
        });
        updated++;
      } else {
        await prisma.assessmentTemplate.create({
          data: {
            id: template.id,
            type: template.type,
            name: template.name,
            description: template.description,
            version: template.version,
            isSystem: template.isSystem,
            isActive: template.isActive,
            sections: template.sections,
            scoringLogic: template.scoringLogic,
          },
        });
        created++;
      }
    }

    logger.info("Template sync completed", { ip, created, updated, total: templates.length });

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: templates.length,
    });
  } catch (error) {
    logger.error("Template sync error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
