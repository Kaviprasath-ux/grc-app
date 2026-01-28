import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== TYPES ====================

export interface AIFrameworkRequirement {
    code: string;
    name: string;
    description?: string;
    category: string;
    requirement_category?: string;
    requirement_code?: string;
    requirement?: string;
    control_mapping?: string;
    requirement_type?: string;
    chapter_type?: string;
}

export interface AIFrameworkResult {
    requirements: AIFrameworkRequirement[];
    total_requirements?: number;
    framework_name?: string;
}

export interface FrameworkInput {
    framework_name: string;
    description?: string;
    type?: string;
    country?: string;
    industry?: string;
    code?: string;
}

export interface SaveFrameworkResult {
    frameworkId: string;
    totalRequirements: number;
    totalCategories: number;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse category string to extract code and name
 * Example: "A.5 - Organizational Controls" → {code: "A.5", name: "Organizational Controls"}
 */
function parseCategoryString(categoryStr: string): { code: string | null; name: string } {
    const match = categoryStr.match(/^([A-Z0-9.]+)\s*-\s*(.+)$/);
    if (match) {
        return {
            code: match[1].trim(),
            name: match[2].trim(),
        };
    }
    // If no code found, use entire string as name
    return {
        code: null,
        name: categoryStr.trim(),
    };
}

/**
 * Get parent code from a requirement code
 * Example: "A.5.1.1" → "A.5.1"
 */
function getParentCode(code: string): string | null {
    const segments = code.split('.');
    if (segments.length <= 1) {
        return null; // Top-level requirement
    }
    return segments.slice(0, -1).join('.');
}

/**
 * Get hierarchy level from requirement code
 * Example: "A.5.1.1" → 3
 */
function getLevel(code: string): number {
    return code.split('.').length;
}

/**
 * Normalize AI requirement to standard format
 */
function normalizeRequirement(req: AIFrameworkRequirement): AIFrameworkRequirement {
    return {
        code: req.requirement_code || req.code,
        name: req.requirement || req.name,
        description: req.description,
        category: req.requirement_category || req.category,
        requirement_type: req.requirement_type,
        chapter_type: req.chapter_type,
        control_mapping: req.control_mapping,
    };
}

// ==================== MAIN FUNCTION ====================

/**
 * Save AI-generated framework data to database
 * 
 * This function:
 * 1. Creates a Framework record
 * 2. Extracts and creates RequirementCategory records
 * 3. Creates hierarchical Requirement records with proper parent-child relationships
 * 4. Uses transactions for atomicity
 * 
 * @param aiResult - AI-generated framework data from RunPod
 * @param frameworkInput - User input for framework metadata
 * @returns Promise with framework ID and counts
 */
export async function saveFrameworkFromAIResult(
    aiResult: AIFrameworkResult,
    frameworkInput: FrameworkInput
): Promise<SaveFrameworkResult> {
    console.log('[Framework Persistence] Starting to save AI-generated framework...');
    console.log(`[Framework Persistence] Framework: ${frameworkInput.framework_name}`);
    console.log(`[Framework Persistence] Total requirements from AI: ${aiResult.requirements.length}`);

    // Normalize all requirements first
    const normalizedRequirements = aiResult.requirements.map(normalizeRequirement);

    return await prisma.$transaction(async (tx) => {
        // ==================== STEP 1: CREATE FRAMEWORK ====================
        console.log('[Framework Persistence] Step 1: Creating framework...');

        const framework = await tx.framework.create({
            data: {
                code: frameworkInput.code || undefined,
                name: frameworkInput.framework_name,
                description: frameworkInput.description || undefined,
                type: frameworkInput.type || 'Framework',
                country: frameworkInput.country || undefined,
                industry: frameworkInput.industry || undefined,
                status: 'Subscribed',
                isCustom: true,
                compliancePercentage: 0,
                policyPercentage: 0,
                evidencePercentage: 0,
            },
        });

        console.log(`[Framework Persistence] ✅ Framework created: ${framework.id}`);

        // ==================== STEP 2: NORMALIZE CATEGORIES ====================
        console.log('[Framework Persistence] Step 2: Extracting and creating categories...');

        // Extract unique categories
        const uniqueCategories = new Set<string>();
        normalizedRequirements.forEach((req) => {
            if (req.category) {
                uniqueCategories.add(req.category);
            }
        });

        console.log(`[Framework Persistence] Found ${uniqueCategories.size} unique categories`);

        // Create category map: categoryString → categoryId
        const categoryMap = new Map<string, string>();
        let sortOrder = 0;

        for (const categoryStr of Array.from(uniqueCategories)) {
            const { code, name } = parseCategoryString(categoryStr);

            const category = await tx.requirementCategory.create({
                data: {
                    code: code || undefined,
                    name,
                    frameworkId: framework.id,
                    sortOrder: sortOrder++,
                },
            });

            categoryMap.set(categoryStr, category.id);
            console.log(`[Framework Persistence] ✅ Category created: ${categoryStr} → ${category.id}`);
        }

        // ==================== STEP 3: BUILD REQUIREMENT HIERARCHY ====================
        console.log('[Framework Persistence] Step 3: Building requirement hierarchy...');

        // Sort requirements by level (ascending) to ensure parents are created first
        const sortedRequirements = normalizedRequirements.sort((a, b) => {
            return getLevel(a.code) - getLevel(b.code);
        });

        console.log('[Framework Persistence] Requirements sorted by hierarchy level');

        // Create requirement map: code → requirementId
        const requirementMap = new Map<string, string>();

        // ==================== STEP 4: INSERT REQUIREMENTS ====================
        console.log('[Framework Persistence] Step 4: Creating requirements...');

        let createdCount = 0;
        let skippedCount = 0;

        for (const req of sortedRequirements) {
            const level = getLevel(req.code);
            const parentCode = getParentCode(req.code);
            const categoryId = req.category ? categoryMap.get(req.category) : undefined;

            // Check if parent exists (for level > 1)
            if (parentCode && !requirementMap.has(parentCode)) {
                console.warn(
                    `[Framework Persistence] ⚠️  Parent not found for ${req.code} (parent: ${parentCode}). Skipping...`
                );
                skippedCount++;
                continue;
            }

            const parentId = parentCode ? requirementMap.get(parentCode) : null;

            try {
                const requirement = await tx.requirement.create({
                    data: {
                        code: req.code,
                        name: req.name,
                        description: req.description || undefined,
                        level,
                        parentId: parentId || undefined,
                        frameworkId: framework.id,
                        categoryId: categoryId || undefined,
                        requirementType: req.requirement_type || 'Mandatory',
                        chapterType: req.chapter_type || 'Domain',
                        sortOrder: createdCount,
                    },
                });

                requirementMap.set(req.code, requirement.id);
                createdCount++;

                if (createdCount % 10 === 0) {
                    console.log(`[Framework Persistence] Progress: ${createdCount}/${sortedRequirements.length} requirements created`);
                }
            } catch (error) {
                console.error(`[Framework Persistence] ❌ Error creating requirement ${req.code}:`, error);
                skippedCount++;
            }
        }

        console.log(`[Framework Persistence] ✅ Requirements created: ${createdCount}`);
        if (skippedCount > 0) {
            console.warn(`[Framework Persistence] ⚠️  Requirements skipped: ${skippedCount}`);
        }

        // ==================== STEP 5: RETURN RESULT ====================
        const result: SaveFrameworkResult = {
            frameworkId: framework.id,
            totalRequirements: createdCount,
            totalCategories: categoryMap.size,
        };

        console.log('[Framework Persistence] ✅ Transaction completed successfully');
        console.log(`[Framework Persistence] Result:`, result);

        return result;
    });
}

/**
 * Check if a framework with the given name already exists
 */
export async function frameworkExists(name: string): Promise<boolean> {
    const existing = await prisma.framework.findUnique({
        where: { name },
    });
    return !!existing;
}

/**
 * Delete a framework and all its related data
 * Useful for testing and cleanup
 */
export async function deleteFramework(frameworkId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
        // Delete requirements (cascade will handle RequirementControl, RequirementException)
        await tx.requirement.deleteMany({
            where: { frameworkId },
        });

        // Delete categories
        await tx.requirementCategory.deleteMany({
            where: { frameworkId },
        });

        // Delete framework
        await tx.framework.delete({
            where: { id: frameworkId },
        });
    });
}
