-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "chatRating" DOUBLE PRECISION,
ADD COLUMN     "streamerRating" DOUBLE PRECISION,
ADD COLUMN     "watchDate" TIMESTAMP(3),
ADD COLUMN     "watched" BOOLEAN NOT NULL DEFAULT false;
