/*
  Warnings:

  - A unique constraint covering the columns `[tmdbId,userId]` on the table `Movie` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Movie` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Movie_tmdbId_key";

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tmdbId_userId_key" ON "Movie"("tmdbId", "userId");

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
