import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all exceptions with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const departmentId = searchParams.get("departmentId");
    const controlId = searchParams.get("controlId");
    const policyId = searchParams.get("policyId");
    const riskId = searchParams.get("riskId");
    const requesterId = searchParams.get("requesterId");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (departmentId) where.departmentId = departmentId;
    if (controlId) where.controlId = controlId;
    if (policyId) where.policyId = policyId;
    if (riskId) where.riskId = riskId;
    if (requesterId) where.requesterId = requesterId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { exceptionCode: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [exceptions, total] = await Promise.all([
      prisma.exception.findMany({
        where,
        include: {
          department: true,
          control: true,
          policy: true,
          risk: true,
          requester: true,
          approver: true,
          comments: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.exception.count({ where }),
    ]);

    return NextResponse.json({
      data: exceptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching exceptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch exceptions" },
      { status: 500 }
    );
  }
}

// POST create new exception
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      exceptionCode,
      name,
      description,
      category,
      departmentId,
      controlId,
      policyId,
      riskId,
      requesterId,
      approverId,
      status,
      endDate,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Exception name is required" },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: "Exception category is required" },
        { status: 400 }
      );
    }

    // Generate exception code if not provided (EC1, EC2, EC3... like UAT)
    let code = exceptionCode;
    if (!code) {
      const lastException = await prisma.exception.findFirst({
        orderBy: { createdAt: "desc" },
        select: { exceptionCode: true },
      });

      let nextNum = 1;
      if (lastException?.exceptionCode) {
        const match = lastException.exceptionCode.match(/EC(\d+)/);
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }
      code = `EC${nextNum}`;
    }

    const exception = await prisma.exception.create({
      data: {
        exceptionCode: code,
        name,
        description,
        category,
        departmentId: departmentId || null,
        controlId: category === "Control" ? controlId : null,
        policyId: category === "Policy" ? policyId : null,
        riskId: category === "Risk" ? riskId : null,
        requesterId: requesterId || null,
        approverId: approverId || null,
        status: status || "Pending",
        endDate: endDate ? new Date(endDate) : null,
      },
      include: {
        department: true,
        control: true,
        policy: true,
        risk: true,
        requester: true,
        approver: true,
        comments: true,
      },
    });

    return NextResponse.json(exception, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating exception:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Exception with this code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create exception" },
      { status: 500 }
    );
  }
}
