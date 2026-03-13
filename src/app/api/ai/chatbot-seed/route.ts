/**
 * Chatbot KB Seed API — Seeds KB articles with embeddings into the database
 *
 * POST /api/ai/chatbot-seed — Seeds new articles (skips existing)
 * POST /api/ai/chatbot-seed?force=true — Reseeds all articles (deletes + recreates)
 *
 * Only accessible by GRCAdministrator.
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { seedKBEmbeddings, reseedKBEmbeddings, isKBSeeded } from "@/lib/chatbot/kb-embeddings";

export const POST = withAuth(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const force = searchParams.get("force") === "true";

      console.log(`[KB Seed] ${force ? "Force re-seeding" : "Seeding"} KB articles...`);

      let result;
      if (force) {
        result = await reseedKBEmbeddings();
      } else {
        result = await seedKBEmbeddings();
      }

      return NextResponse.json({
        success: true,
        ...result,
        message: `KB seeding complete: ${result.seeded} articles embedded`,
      });
    } catch (error) {
      console.error("[KB Seed] Error:", error);
      return NextResponse.json(
        { error: "Failed to seed KB embeddings", details: String(error) },
        { status: 500 }
      );
    }
  },
  { resource: "grc.configuration", action: "create" }
);

export const GET = withAuth(
  async () => {
    try {
      const seeded = await isKBSeeded();
      return NextResponse.json({ seeded });
    } catch (error) {
      console.error("[KB Seed] Status check error:", error);
      return NextResponse.json({ error: "Failed to check KB status" }, { status: 500 });
    }
  },
  { resource: "grc.configuration", action: "view" }
);
