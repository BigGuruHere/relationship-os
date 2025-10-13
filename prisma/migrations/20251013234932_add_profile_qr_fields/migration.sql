-- AlterTable
ALTER TABLE "public"."Profile" ADD COLUMN     "qrGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "qrReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qrSvg" TEXT;
