import { z } from "zod";

export const documentUploadSchema = z.object({
  file: z.any(), // handled via formData usually, but if JSON
});

export const generateTemplateSchema = z.object({
  // Dynamic JSON payload for template generation
  // We allow any valid JSON object as the data model for the template
  data: z.record(z.string(), z.any()),
});

export const processDocumentSchema = z.object({
  file: z.any(),
});

export const apiKeySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["PRODUCTION", "TEST"]),
  rateLimit: z.number().int().min(1).max(10000),
});
