-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "unitPreference" TEXT NOT NULL DEFAULT 'mi',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "currentWeeklyMileageKm" REAL NOT NULL,
    "raceDate" DATETIME NOT NULL,
    "longRunDay" INTEGER NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "raceDate" DATETIME NOT NULL,
    "totalWeeks" INTEGER NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlannedWorkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "targetDistanceKm" REAL,
    "targetPaceZone" TEXT,
    "notes" TEXT,
    "weekIndex" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    CONSTRAINT "PlannedWorkout_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoggedRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plannedWorkoutId" TEXT,
    "date" DATETIME NOT NULL,
    "distanceKm" REAL NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "avgHeartRate" INTEGER,
    "rpe" INTEGER,
    "notes" TEXT,
    CONSTRAINT "LoggedRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoggedRun_plannedWorkoutId_fkey" FOREIGN KEY ("plannedWorkoutId") REFERENCES "PlannedWorkout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "PlannedWorkout_planId_date_idx" ON "PlannedWorkout"("planId", "date");

-- CreateIndex
CREATE INDEX "LoggedRun_userId_date_idx" ON "LoggedRun"("userId", "date");
