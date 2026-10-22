-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('working', 'warmup');

-- AlterTable
ALTER TABLE "ExerciseSet" ADD COLUMN     "note" VARCHAR(200),
ADD COLUMN     "setType" "SetType" NOT NULL DEFAULT 'working';
