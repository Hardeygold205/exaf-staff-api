import { z } from 'zod';
import { createZodDto, ZodDto } from 'nestjs-zod';
import { title } from 'process';

export const createSuggestionSchema = z.object({
  title: z.string().trim().min(3).max(500),
  content: z.string().trim().min(3).max(5000),
  isAnonymous: z.boolean().default(false),
});

export const voteSuggestionSchema = z.object({
  type: z.enum(['LIKE', 'DISLIKE']),
});

export const updateSuggestionStatusSchema = z.object({
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'IMPLEMENTED', 'DECLINED']),
});

export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
export type VoteSuggestionInput = z.infer<typeof voteSuggestionSchema>;
export type UpdateSuggestionStatusInput = z.infer<typeof updateSuggestionStatusSchema>;

export class CreateSuggestionDto extends createZodDto(createSuggestionSchema) {}
export class VoteSuggestionDto extends createZodDto(voteSuggestionSchema) {}
export class UpdateSuggestionStatusDto extends createZodDto(updateSuggestionStatusSchema) {}
