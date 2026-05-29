const API = {
  listarSessoes: "/sessoes",
  mapaSessao: (sessionId) => `/sessoes/${encodeURIComponent(sessionId)}/mapa`,
  limparSessoes: "/admin/limpeza-sessoes",
  logs: "/dashboard/logs",
};

const STORAGE_KEY = "cinema-dashboard-monitored-sessions";
const REFRESH_INTERVAL_MS = 15000;
const LOG_POLL_INTERVAL_MS = 1400;
const TERMINAL_MAX_LINES = 320;

const elements = {
  statsGrid: document.querySelector("#statsGrid"),
  sessionCountBadge: document.querySelector("#sessionCountBadge"),
  sessionsList: document.querySelector("#sessionsList"),
  selectedSessionTitle: document.querySelector("#selectedSessionTitle"),
  selectedSessionBadge: document.querySelector("#selectedSessionBadge"),
  sessionMeta: document.querySelector("#sessionMeta"),
  seatGrid: document.querySelector("#seatGrid"),
  cleanupBtn: document.querySelector("#cleanupBtn"),
  cleanupResult: document.querySelector("#cleanupResult"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  monitorForm: document.querySelector("#monitorForm"),
  monitorInput: document.querySelector("#monitorInput"),
  refreshBtn: document.querySelector("#refreshBtn"),
  autoRefresh: document.querySelector("#autoRefresh"),
  lastSync: document.querySelector("#lastSync"),
  terminalOutput: document.querySelector("#terminalOutput"),
  terminalCursor: document.querySelector("#terminalCursor"),
  terminalState: document.querySelector("#terminalState"),
  terminalPause: document.querySelector("#terminalPause"),
  terminalAutoScroll: document.querySelector("#terminalAutoScroll"),
  clearTerminalBtn: document.querySelector("#clearTerminalBtn"),
};

const state = {
  sessions: [],
  selectedSessionId: null,
  search: "",
  filter: "all",
  monitoredSessionIds: loadMonitoredSessionIds(),
  mapaPorSessao: new Map(),
  refreshTimer: null,
  terminal: {
    cursor: 0,
    timer: null,
  },
};

let mapRequestId = 0;

function loadMonitoredSessionIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch (_err) {
    return [];
  }
}

function saveMonitoredSessionIds() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.monitoredSessionIds));
}

function formatDate(dateValue) {
  if (!dateValue) return "Nao definido";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Nao definido";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function terminalLevelClass(level) {
  const upper = String(level || "").toUpperCase();
  if (upper === "SUCCESS") return "level-success";
  if (upper === "WARN") return "level-warn";
  if (upper === "ERROR") return "level-error";
  return "level-info";
}

function formatTerminalTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString("pt-BR", { hour12: false });
}

function isNearTerminalBottom() {
  const output = elements.terminalOutput;
  const threshold = 24;
  return output.scrollHeight - output.scrollTop - output.clientHeight <= threshold;
}

function updateTerminalStatus(text) {
  elements.terminalState.textContent = text;
}

function updateTerminalCursor(value) {
  elements.terminalCursor.textContent = `Cursor: ${value}`;
}

function appendTerminalLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return;

  const output = elements.terminalOutput;
  const keepAtBottom =
    elements.terminalAutoScroll.checked && (output.childElementCount === 0 || isNearTerminalBottom());

  const html = logs
    .map((entry) => {
      const level = String(entry.level || "INFO").toUpperCase();
      return `
        <p class="terminal-line ${terminalLevelClass(level)}">
          <span class="t-time">${escapeHtml(formatTerminalTime(entry.timestamp))}</span>
          <span class="t-level">${escapeHtml(level)}</span>
          <span class="t-message">[${escapeHtml(entry.source)}] ${escapeHtml(entry.message)}</span>
        </p>
      `;
    })
    .join("");

  output.insertAdjacentHTML("beforeend", html);

  while (output.childElementCount > TERMINAL_MAX_LINES) {
    output.firstElementChild?.remove();
  }

  if (keepAtBottom) {
    output.scrollTop = output.scrollHeight;
  }
}

function seatClass(status) {
  if (status === "PENDENTE") return "pending";
  if (status === "OCUPADO") return "occupied";
  return "available";
}

function statusLabel(status) {
  if (status === "PENDENTE") return "Pendente";
  if (status === "OCUPADO") return "Ocupado";
  return "Disponivel";
}

function sessaoTag(sessao) {
  if (sessao.encerrada) return "Encerrada";
  if (!sessao.existe) return "Nao criada";
  return "Ativa";
}

function sortSessions(items) {
  return items.sort((a, b) => {
    if (a.encerrada !== b.encerrada) return a.encerrada ? 1 : -1;

    const aTime = a.dataHoraFim ? new Date(a.dataHoraFim).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dataHoraFim ? new Date(b.dataHoraFim).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;

    return a.sessionId.localeCompare(b.sessionId);
  });
}

function renderStats() {
  const totalSessoes = state.sessions.length;
  const sessoesAtivas = state.sessions.filter((item) => !item.encerrada).length;
  const assentosDisponiveis = state.sessions.reduce(
    (total, item) => total + item.resumo.disponiveis,
    0
  );
  const mediaOcupacao =
    totalSessoes > 0
      ? (
          state.sessions.reduce((total, item) => total + item.resumo.taxaOcupacao, 0) /
          totalSessoes
        ).toFixed(1)
      : "0.0";

  const cards = [
    { label: "Sessoes monitoradas", value: totalSessoes },
    { label: "Sessoes ativas", value: sessoesAtivas },
    { label: "Assentos disponiveis", value: assentosDisponiveis },
    { label: "Media de ocupacao", value: `${mediaOcupacao}%` },
  ];

  elements.statsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <p class="stat-label">${card.label}</p>
          <p class="stat-value">${card.value}</p>
        </article>
      `
    )
    .join("");
}

function getFilteredSessions() {
  const query = state.search.trim().toLowerCase();

  return state.sessions.filter((item) => {
    if (state.filter === "active" && item.encerrada) return false;
    if (state.filter === "closed" && !item.encerrada) return false;
    if (!query) return true;
    return item.sessionId.toLowerCase().includes(query);
  });
}

function renderSessionsList() {
  const filtered = getFilteredSessions();
  elements.sessionCountBadge.textContent = `${filtered.length} sessoes`;

  if (filtered.length === 0) {
    elements.sessionsList.innerHTML =
      '<p class="empty-state">Nenhuma sessao para o filtro atual.</p>';
    return;
  }

  elements.sessionsList.innerHTML = filtered
    .map((sessao) => {
      const activeClass = sessao.sessionId === state.selectedSessionId ? "active" : "";
      return `
        <button class="session-card ${activeClass}" data-session-id="${sessao.sessionId}" type="button">
          <span class="session-title">${sessao.sessionId}</span>
          <span class="session-meta-mini">
            <span>${sessaoTag(sessao)}</span>
            <span>${sessao.resumo.disponiveis}/${sessao.resumo.capacidadeTotal} livres</span>
            <span>Fim: ${formatDate(sessao.dataHoraFim)}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderSessionDetails() {
  if (!state.selectedSessionId) {
    elements.selectedSessionTitle.textContent = "Selecione uma sessao";
    elements.selectedSessionBadge.className = "chip chip-neutral";
    elements.selectedSessionBadge.textContent = "Sem dados";
    elements.sessionMeta.innerHTML = "";
    elements.seatGrid.innerHTML =
      '<p class="empty-state">Escolha uma sessao para visualizar o mapa de assentos.</p>';
    return;
  }

  const mapa = state.mapaPorSessao.get(state.selectedSessionId);
  if (!mapa) {
    elements.selectedSessionTitle.textContent = `Sessao ${state.selectedSessionId}`;
    elements.selectedSessionBadge.className = "chip chip-neutral";
    elements.selectedSessionBadge.textContent = "Carregando";
    elements.sessionMeta.innerHTML = "";
    elements.seatGrid.innerHTML = '<p class="empty-state">Carregando mapa de assentos...</p>';
    return;
  }

  elements.selectedSessionTitle.textContent = `Sessao ${mapa.sessionId}`;
  const badgeClass = mapa.encerrada ? "chip-closed" : "chip-active";
  elements.selectedSessionBadge.className = `chip ${badgeClass}`;
  elements.selectedSessionBadge.textContent = sessaoTag(mapa);

  elements.sessionMeta.innerHTML = `
    <article class="meta-box">
      <p class="label">Data/hora de encerramento</p>
      <p class="value">${formatDate(mapa.dataHoraFim)}</p>
    </article>
    <article class="meta-box">
      <p class="label">Disponiveis</p>
      <p class="value">${mapa.resumo.disponiveis} / ${mapa.resumo.capacidadeTotal}</p>
    </article>
    <article class="meta-box">
      <p class="label">Ocupacao</p>
      <p class="value">${mapa.resumo.taxaOcupacao}%</p>
    </article>
  `;

  elements.seatGrid.innerHTML = mapa.assentos
    .map(
      (assento) => `
        <span
          class="seat ${seatClass(assento.status)}"
          title="${assento.numero} - ${statusLabel(assento.status)}"
        >
          ${assento.numero}
        </span>
      `
    )
    .join("");
}

function renderAll() {
  renderStats();
  renderSessionsList();
  renderSessionDetails();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_err) {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Falha ao carregar ${url}.`);
  }

  return payload;
}

async function atualizarConsole() {
  if (elements.terminalPause.checked) {
    updateTerminalStatus("Pausado");
    return;
  }

  try {
    const params = new URLSearchParams({
      since: String(state.terminal.cursor),
      limit: "120",
    });
    const payload = await fetchJson(`${API.logs}?${params.toString()}`);

    const logs = Array.isArray(payload?.logs) ? payload.logs : [];
    const cursor =
      Number.isFinite(payload?.cursor) && payload.cursor >= state.terminal.cursor
        ? payload.cursor
        : state.terminal.cursor;

    state.terminal.cursor = cursor;
    updateTerminalCursor(state.terminal.cursor);
    appendTerminalLogs(logs);

    if (logs.length === 0) {
      updateTerminalStatus("Conectado · sem novas entradas");
      return;
    }

    updateTerminalStatus(`Conectado · ${logs.length} nova(s) entrada(s)`);
  } catch (err) {
    updateTerminalStatus(
      err instanceof Error ? `Falha no console: ${err.message}` : "Falha ao atualizar console."
    );
  }
}

function configurarPollingConsole() {
  if (state.terminal.timer) {
    clearInterval(state.terminal.timer);
    state.terminal.timer = null;
  }

  state.terminal.timer = setInterval(async () => {
    await atualizarConsole();
  }, LOG_POLL_INTERVAL_MS);
}

async function carregarSessaoMonitorada(sessionId) {
  const mapa = await fetchJson(API.mapaSessao(sessionId));
  return {
    sessionId: mapa.sessionId,
    existe: Boolean(mapa.existe),
    dataHoraFim: mapa.dataHoraFim,
    encerrada: Boolean(mapa.encerrada),
    resumo: mapa.resumo,
  };
}

async function atualizarSessoes() {
  elements.refreshBtn.disabled = true;

  try {
    const payload = await fetchJson(API.listarSessoes);
    const sessoesDaApi = Array.isArray(payload?.sessoes) ? payload.sessoes : [];

    const base = sessoesDaApi.map((item) => ({
      ...item,
      existe: true,
    }));

    const idsDaApi = new Set(base.map((item) => item.sessionId));
    const extras = await Promise.all(
      state.monitoredSessionIds
        .filter((id) => !idsDaApi.has(id))
        .map((id) => carregarSessaoMonitorada(id).catch(() => null))
    );

    state.sessions = sortSessions([...base, ...extras.filter(Boolean)]);

    if (!state.selectedSessionId && state.sessions.length > 0) {
      state.selectedSessionId = state.sessions[0].sessionId;
    }

    const existsSelected = state.sessions.some(
      (item) => item.sessionId === state.selectedSessionId
    );
    if (!existsSelected) {
      state.selectedSessionId = state.sessions[0]?.sessionId ?? null;
    }

    elements.lastSync.textContent = `Atualizado em ${new Date().toLocaleTimeString(
      "pt-BR"
    )}`;
  } catch (err) {
    elements.lastSync.textContent =
      err instanceof Error ? err.message : "Falha ao atualizar sessoes.";
  } finally {
    elements.refreshBtn.disabled = false;
    renderAll();
  }
}

async function carregarMapaSelecionado() {
  if (!state.selectedSessionId) {
    renderSessionDetails();
    return;
  }

  const requestId = ++mapRequestId;
  renderSessionDetails();

  try {
    const mapa = await fetchJson(API.mapaSessao(state.selectedSessionId));
    if (requestId !== mapRequestId) return;

    state.mapaPorSessao.set(mapa.sessionId, mapa);

    state.sessions = state.sessions.map((item) =>
      item.sessionId === mapa.sessionId
        ? {
            sessionId: mapa.sessionId,
            existe: Boolean(mapa.existe),
            dataHoraFim: mapa.dataHoraFim,
            encerrada: Boolean(mapa.encerrada),
            resumo: mapa.resumo,
          }
        : item
    );

    renderAll();
  } catch (err) {
    if (requestId !== mapRequestId) return;
    elements.seatGrid.innerHTML = `<p class="empty-state">${
      err instanceof Error ? err.message : "Falha ao carregar mapa da sessao."
    }</p>`;
  }
}

async function selecionarSessao(sessionId) {
  state.selectedSessionId = sessionId;
  renderAll();
  await carregarMapaSelecionado();
}

function configureAutoRefresh() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }

  if (!elements.autoRefresh.checked) return;

  state.refreshTimer = setInterval(async () => {
    await atualizarSessoes();
    await carregarMapaSelecionado();
  }, REFRESH_INTERVAL_MS);
}

async function executarLimpeza() {
  elements.cleanupBtn.disabled = true;
  elements.cleanupResult.textContent = "Executando limpeza...";

  try {
    const payload = await fetchJson(API.limparSessoes);
    elements.cleanupResult.textContent = `Limpeza concluida: ${
      payload.sessoesLimpas
    } sessoes removidas, ${payload.assentosOcupadosRemovidos} assentos removidos.`;

    await atualizarSessoes();
    await carregarMapaSelecionado();
  } catch (err) {
    elements.cleanupResult.textContent =
      err instanceof Error ? err.message : "Falha ao executar limpeza.";
  } finally {
    elements.cleanupBtn.disabled = false;
  }
}

function bindEvents() {
  elements.refreshBtn.addEventListener("click", async () => {
    await atualizarSessoes();
    await carregarMapaSelecionado();
  });

  elements.autoRefresh.addEventListener("change", () => {
    configureAutoRefresh();
  });

  elements.terminalPause.addEventListener("change", async () => {
    if (elements.terminalPause.checked) {
      updateTerminalStatus("Pausado");
      return;
    }
    updateTerminalStatus("Retomando atualizacao...");
    await atualizarConsole();
  });

  elements.terminalAutoScroll.addEventListener("change", () => {
    if (elements.terminalAutoScroll.checked) {
      elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
    }
  });

  elements.clearTerminalBtn.addEventListener("click", () => {
    elements.terminalOutput.innerHTML = "";
    updateTerminalStatus("Tela limpa");
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderSessionsList();
  });

  elements.statusFilter.addEventListener("change", (event) => {
    state.filter = event.target.value;
    renderSessionsList();
  });

  elements.sessionsList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-session-id]");
    if (!button) return;
    await selecionarSessao(button.dataset.sessionId);
  });

  elements.monitorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = elements.monitorInput.value.trim();
    if (!value) return;

    if (!state.monitoredSessionIds.includes(value)) {
      state.monitoredSessionIds.push(value);
      saveMonitoredSessionIds();
    }

    elements.monitorInput.value = "";
    await atualizarSessoes();
    await selecionarSessao(value);
  });

  elements.cleanupBtn.addEventListener("click", async () => {
    await executarLimpeza();
  });
}

async function bootstrap() {
  bindEvents();
  configureAutoRefresh();
  configurarPollingConsole();
  updateTerminalCursor(0);
  updateTerminalStatus("Conectando...");
  await atualizarConsole();
  await atualizarSessoes();
  await carregarMapaSelecionado();
}

bootstrap();
