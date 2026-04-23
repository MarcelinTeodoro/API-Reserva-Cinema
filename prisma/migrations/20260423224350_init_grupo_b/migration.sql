-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataHoraFim" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Assento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessaoId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Assento_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "Sessao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Assento_sessaoId_idx" ON "Assento"("sessaoId");

-- CreateIndex
CREATE INDEX "Assento_status_atualizadoEm_idx" ON "Assento"("status", "atualizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Assento_sessaoId_numero_key" ON "Assento"("sessaoId", "numero");
