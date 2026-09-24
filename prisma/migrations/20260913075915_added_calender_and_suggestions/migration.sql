-- CreateEnum
CREATE TYPE "AttendanceReviewStatus" AS ENUM ('NONE', 'PENDING_REVIEW', 'REVIEWED');

-- CreateEnum
CREATE TYPE "CheckoutReasonType" AS ENUM ('FORGOT_TO_CHECKOUT', 'WORKING_IN_OFFICE', 'URGENT_TASK', 'MEETING', 'COMPANY_ASSIGNMENT', 'REQUESTED_TO_WORK_LATE', 'TECHNICAL_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'IMPLEMENTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SuggestionVoteType" AS ENUM ('LIKE', 'DISLIKE');

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "checkoutReasonText" TEXT,
ADD COLUMN     "checkoutReasonType" "CheckoutReasonType",
ADD COLUMN     "reviewStatus" "AttendanceReviewStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "uploads" ADD COLUMN     "eventId" TEXT;

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_votes" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SuggestionVoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestion_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suggestions_createdAt_idx" ON "suggestions"("createdAt");

-- CreateIndex
CREATE INDEX "suggestions_status_createdAt_idx" ON "suggestions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "suggestion_votes_suggestionId_type_idx" ON "suggestion_votes"("suggestionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "suggestion_votes_suggestionId_userId_key" ON "suggestion_votes"("suggestionId", "userId");

-- CreateIndex
CREATE INDEX "attendance_userId_reviewStatus_idx" ON "attendance"("userId", "reviewStatus");

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_votes" ADD CONSTRAINT "suggestion_votes_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_votes" ADD CONSTRAINT "suggestion_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
