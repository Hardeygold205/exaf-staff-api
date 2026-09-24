-- CreateEnum
CREATE TYPE "OfficeBranch" AS ENUM ('ABUJA', 'KANO');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "officeBranch" "OfficeBranch" NOT NULL DEFAULT 'ABUJA',
ADD COLUMN     "shift" "Shift" NOT NULL DEFAULT 'ONSITE';
