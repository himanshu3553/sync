-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "portalAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "portalEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PortalPublication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "category" TEXT,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalPublication_workflowId_key" ON "PortalPublication"("workflowId");

-- CreateIndex
CREATE INDEX "PortalPublication_workspaceId_idx" ON "PortalPublication"("workspaceId");

-- AddForeignKey
ALTER TABLE "PortalPublication" ADD CONSTRAINT "PortalPublication_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalPublication" ADD CONSTRAINT "PortalPublication_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
