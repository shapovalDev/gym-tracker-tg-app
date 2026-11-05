-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('weight_reps', 'bodyweight', 'assisted', 'duration');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "trackingType" "TrackingType" NOT NULL DEFAULT 'weight_reps';

-- AlterTable
ALTER TABLE "ExerciseSet" ADD COLUMN     "durationSec" INTEGER;

-- Hand-written: timed sets are completed with seconds instead of reps.
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_duration_range" CHECK ("durationSec" IS NULL OR ("durationSec" >= 0 AND "durationSec" <= 10800));
ALTER TABLE "ExerciseSet" DROP CONSTRAINT "ExerciseSet_completed_needs_reps";
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_completed_needs_result" CHECK ("status" <> 'completed' OR "reps" >= 1 OR "durationSec" >= 1);
