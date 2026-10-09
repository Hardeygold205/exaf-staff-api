import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../infra/prisma/prisma.service";
import {
  CreateSuggestionInput,
  UpdateSuggestionStatusInput,
  VoteSuggestionInput,
} from "./suggestions.schemas";

@Injectable()
export class SuggestionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSuggestionInput) {
    const account = await this.prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
    if (!account?.organizationId) throw new Error("Organization required");
    return this.prisma.suggestion.create({
      data: {
        organizationId: account.organizationId,
        content: dto.content,
        isAnonymous: dto.isAnonymous,
        createdById: userId,
      },
    });
  }

  async findAll(userId: string, organizationId?: string) {
    const suggestions = await this.prisma.suggestion.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        votes: {
          select: { userId: true, type: true },
        },
      },
    });

    return suggestions.map((suggestion) => {
      let likes = 0;
      let dislikes = 0;
      let myVote: "LIKE" | "DISLIKE" | null = null;

      for (const vote of suggestion.votes) {
        if (vote.type === "LIKE") likes++;
        else dislikes++;
        if (vote.userId === userId) myVote = vote.type;
      }

      return {
        id: suggestion.id,
        content: suggestion.content,
        isAnonymous: suggestion.isAnonymous,
        author: suggestion.isAnonymous
          ? null
          : {
              id: suggestion.createdBy.id,
              name: `${suggestion.createdBy.firstName} ${suggestion.createdBy.lastName}`,
            },
        status: suggestion.status,
        likes,
        dislikes,
        myVote,
        createdAt: suggestion.createdAt,
        updatedAt: suggestion.updatedAt,
      };
    });
  }

  async vote(userId: string, suggestionId: string, dto: VoteSuggestionInput) {
    const suggestion = await this.prisma.suggestion.findUnique({
      where: { id: suggestionId },
      select: { id: true },
    });

    if (!suggestion) throw new NotFoundException("Suggestion not found");

    return this.prisma.suggestionVote.upsert({
      where: {
        suggestionId_userId: {
          suggestionId,
          userId,
        },
      },
      update: { type: dto.type },
      create: {
        suggestionId,
        userId,
        type: dto.type,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateSuggestionStatusInput) {
    const suggestion = await this.prisma.suggestion.findUnique({
      where: { id },
    });
    if (!suggestion) throw new NotFoundException("Suggestion not found");

    return this.prisma.suggestion.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
