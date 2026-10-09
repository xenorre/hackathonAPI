-- AlterTable
ALTER TABLE "hackathon" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Prisma manages updatedAt after existing rows are backfilled.
ALTER TABLE "hackathon" ALTER COLUMN "updatedAt" DROP DEFAULT;
