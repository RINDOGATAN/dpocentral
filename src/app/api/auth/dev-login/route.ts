import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encode } from "next-auth/jwt";

/**
 * Development-only instant login endpoint.
 *
 * Usage: http://localhost:3001/api/auth/dev-login?email=dev@example.com
 *
 * This endpoint only works in development mode.
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const email = request.nextUrl.searchParams.get("email") || "dev@example.com";

  try {
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: email.split("@")[0],
        },
      });
    }

    // Create JWT token
    const token = await encode({
      token: {
        sub: user.id,
        email: user.email,
        name: user.name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      },
      secret: process.env.NEXTAUTH_SECRET!,
    });

    // Create response with redirect
    const response = NextResponse.redirect(new URL("/privacy", request.url));

    // Set the session cookie
    response.cookies.set({
      name: "next-auth.session-token",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error("Dev login error:", error);
    return NextResponse.json(
      { error: "Failed to create dev session" },
      { status: 500 }
    );
  }
}
