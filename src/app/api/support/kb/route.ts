import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-auth';
import { generateEmbedding } from '@/lib/chatbot/kb-embeddings';

type Session = AuthenticatedRequest['user'];

const MODULES = ['general', 'compliance', 'risk-management', 'asset-management', 'internal-audit', 'tprm', 'organization'];
const SCOPES = ['both', 'grc', 'audit', 'tprm'];

// ==================== GET (list articles) ====================
export const GET = withAuth(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const module = searchParams.get('module') || '';

    const where: Record<string, unknown> = {};
    if (module) where.module = module;
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    const articles = await prisma.chatbotKBArticle.findMany({
      where,
      select: {
        id: true,
        articleKey: true,
        module: true,
        category: true,
        productScope: true,
        roles: true,
        question: true,
        answer: true,
        isPublished: true,
        source: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    return NextResponse.json({ articles });
  },
  { resource: 'support.kb', action: 'view' },
);

// ==================== POST (create article) ====================
export const POST = withAuth(
  async (req: NextRequest, _ctx, session: Session) => {
    const body = await req.json().catch(() => ({}));
    const question = (body.question || '').toString().trim();
    const answer = (body.answer || '').toString().trim();
    if (!question || !answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
    }
    const module = MODULES.includes(body.module) ? body.module : 'general';
    const productScope = SCOPES.includes(body.productScope) ? body.productScope : 'both';
    const category = (body.category || module).toString();
    const roles: string[] = Array.isArray(body.roles) ? body.roles.filter((r: unknown) => typeof r === 'string') : [];
    const isPublished = body.isPublished !== false;

    // The embedded text mirrors the seed format (question + answer).
    const content = `${question}\n\n${answer}`;
    const embedding = await generateEmbedding(content);
    const articleKey = `manual-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

    const article = await prisma.chatbotKBArticle.create({
      data: {
        articleKey,
        module,
        category,
        productScope,
        roles,
        question,
        answer,
        content,
        embedding,
        isPublished,
        source: 'manual',
        updatedById: session.id,
      },
    });
    return NextResponse.json({ id: article.id, articleKey: article.articleKey }, { status: 201 });
  },
  { resource: 'support.kb', action: 'create' },
);
