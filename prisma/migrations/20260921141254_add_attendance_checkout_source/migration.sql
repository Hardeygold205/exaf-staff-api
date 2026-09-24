-- CreateEnum
CREATE TYPE "CheckoutSource" AS ENUM ('USER', 'SYSTEM');

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "checkoutSource" "CheckoutSource" NOT NULL DEFAULT 'USER';
