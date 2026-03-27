-- CreateTable
CREATE TABLE "Assento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LIVRE',
    "bloqueadoEm" DATETIME,
    "expiradoEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "filmeId" TEXT NOT NULL,
    "salaId" TEXT NOT NULL,
    "horario" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "assentoId" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiradoEm" DATETIME NOT NULL,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Reserva_assentoId_fkey" FOREIGN KEY ("assentoId") REFERENCES "Assento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Assento_salaId_numero_key" ON "Assento"("salaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_assentoId_status_key" ON "Reserva"("assentoId", "status");
