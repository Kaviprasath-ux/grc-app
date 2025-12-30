import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all services
export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: { title: "asc" },
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

// POST create new service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, serviceUser, serviceCategory, serviceItem } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const service = await prisma.service.create({
      data: {
        title,
        description,
        serviceUser,
        serviceCategory,
        serviceItem,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
