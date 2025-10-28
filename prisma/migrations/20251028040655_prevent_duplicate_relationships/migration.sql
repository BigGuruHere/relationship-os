/*
  Warnings:

  - A unique constraint covering the columns `[userId,linkedUserId]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_linkedUserId_key" ON "public"."Contact"("userId", "linkedUserId");
