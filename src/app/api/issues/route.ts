import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all issues
export async function GET() {
  try {
    const issues = await prisma.issue.findMany({
      include: { department: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(issues);
  } catch (error) {
    console.error("Error fetching issues:", error);
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 });
  }
}

// POST create new issue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, domain, category, issueType, status, dueDate, departmentId } = body;

    if (!title || !domain || !category) {
      return NextResponse.json(
        { error: "Title, domain, and category are required" },
        { status: 400 }
      );
    }

    const issue = await prisma.issue.create({
      data: {
        title,
        description,
        domain,
        category,
        issueType,
        status: status || "Open",
        dueDate: dueDate ? new Date(dueDate) : null,
        departmentId,
      },
      include: { department: true },
    });

    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    console.error("Error creating issue:", error);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }
}
