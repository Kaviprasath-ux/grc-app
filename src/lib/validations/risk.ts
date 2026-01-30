import { z } from "zod";

export const InherentRiskRatingEnum = z.enum(["High", "Medium", "Low"]);

export const RiskInputSchema = z.object({
    Process_Details: z.string().optional(),
    Assets_Details: z.string().optional(),
}).refine((data) => {
    // Enforce "Either-Or" constraint: Ensure one is present, but NOT both.
    const hasProcess = !!data.Process_Details;
    const hasAssets = !!data.Assets_Details;
    return (hasProcess || hasAssets) && !(hasProcess && hasAssets);
}, {
    message: "Provide either Process_Details or Assets_Details, but not both.",
    path: ["Process_Details"], // Attach error to one of them
});

export const RiskOutputSchema = z.object({
    Risks: z.array(z.object({
        Risk_Name: z.string(),
        Risk_Description: z.string(),
        Inherent_risk_rating: InherentRiskRatingEnum,
    })),
});

export const SemanticMatchInputSchema = z.object({
    Process_name: z.string(),
    Process_Description: z.string(),
    existing_library: z.object({
        Risk_Library: z.array(z.any()), // You can refine these further if structure is known
        Control_Library: z.array(z.any()),
        Threats_library: z.array(z.any()),
        Vulnerabilities_library: z.array(z.any()),
    }),
    generated_risk: z.object({
        Risks: z.array(z.object({
            Risk_Name: z.string(),
            Risk_Description: z.string(),
        })),
    }),
});
