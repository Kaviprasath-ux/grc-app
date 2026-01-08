import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all control domains
export async function GET() {
  try {
    const domains = await prisma.controlDomain.findMany({
      include: {
        _count: {
          select: { controls: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(domains);
  } catch (error) {
    console.error("Error fetching control domains:", error);
    return NextResponse.json(
      { error: "Failed to fetch control domains" },
      { status: 500 }
    );
  }
}

// POST create new control domain
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Domain name is required" },
        { status: 400 }
      );
    }

    // Auto-generate sequential code in DOM-XXX format
    const lastDomain = await prisma.controlDomain.findFirst({
      where: {
        code: {
          startsWith: "DOM-",
        },
      },
      orderBy: { code: "desc" },
    });

    let nextSequence = 1;
    if (lastDomain?.code) {
      const match = lastDomain.code.match(/^DOM-(\d+)$/);
      if (match) {
        nextSequence = parseInt(match[1], 10) + 1;
      }
    }

    const domainCode = `DOM-${nextSequence.toString().padStart(3, "0")}`;

    const domain = await prisma.controlDomain.create({
      data: { code: domainCode, name },
    });

    return NextResponse.json(domain, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating control domain:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Domain with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create control domain" },
      { status: 500 }
    );
  }
}
