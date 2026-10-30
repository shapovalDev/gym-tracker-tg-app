-- AlterTable
ALTER TABLE "ProgramWorkout" ADD COLUMN     "weekday" SMALLINT;

-- Hand-written: valid day range and at most one workout per day in a program.
ALTER TABLE "ProgramWorkout" ADD CONSTRAINT "ProgramWorkout_weekday_range" CHECK ("weekday" IS NULL OR ("weekday" >= 0 AND "weekday" <= 6));
CREATE UNIQUE INDEX "ProgramWorkout_programId_weekday_key" ON "ProgramWorkout"("programId", "weekday") WHERE "weekday" IS NOT NULL;
