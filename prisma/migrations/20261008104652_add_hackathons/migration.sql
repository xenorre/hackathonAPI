-- CreateTable
CREATE TABLE "hackathon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hackathonParticipant" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hackathonParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hackathon_authorId_idx" ON "hackathon"("authorId");

-- CreateIndex
CREATE INDEX "hackathonParticipant_userId_idx" ON "hackathonParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "hackathonParticipant_hackathonId_userId_key" ON "hackathonParticipant"("hackathonId", "userId");

-- AddForeignKey
ALTER TABLE "hackathon" ADD CONSTRAINT "hackathon_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathonParticipant" ADD CONSTRAINT "hackathonParticipant_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathonParticipant" ADD CONSTRAINT "hackathonParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
