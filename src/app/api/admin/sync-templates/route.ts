import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AssessmentType } from "@prisma/client";

// API key for template sync (set in environment)
const SYNC_API_KEY = process.env.TEMPLATE_SYNC_API_KEY;

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
  // Verify API key
  const apiKey = request.headers.get("X-API-Key");

  if (!SYNC_API_KEY) {
    return NextResponse.json(
      { error: "Template sync not configured" },
      { status: 500 }
    );
  }

  if (apiKey !== SYNC_API_KEY) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const templates: TemplatePayload[] = body.templates;

    if (!templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: "Invalid payload: templates array required" },
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

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: templates.length,
    });
  } catch (error) {
    console.error("Template sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
