// SPDX-License-Identifier: GPL-3.0-or-later
const PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", url: "https://chat.deepseek.com/", hosts: ["chat.deepseek.com"] },
  { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com/", hosts: ["chatgpt.com", "chat.openai.com"] },
  { id: "hy4", name: "Hy4 (WorkBuddy)", url: "https://www.workbuddy.ai/app", hosts: ["www.workbuddy.ai"] },
  { id: "gemini", name: "Gemini", url: "https://gemini.google.com/app", hosts: ["gemini.google.com"] },
  { id: "kimi", name: "Kimi", url: "https://www.kimi.ai/", hosts: ["www.kimi.ai", "kimi.ai"] },
  { id: "glm", name: "GLM", url: "https://chat.z.ai/", hosts: ["chat.z.ai"] },
  { id: "qwen", name: "Qwen", url: "https://chat.qwen.ai/", hosts: ["chat.qwen.ai"] },
  { id: "arena", name: "Arena", url: "https://arena.ai/text/direct", hosts: ["arena.ai"] },
  { id: "meta", name: "Meta AI", url: "https://www.meta.ai/", hosts: ["www.meta.ai", "meta.ai"] },
];

const byId = (id) => document.getElementById(id);
const providerSelect = byId("provider");
for (const p of PROVIDERS) {
  const option = document.createElement("option");
  option.value = p.id;
  option.textContent = p.name;
  providerSelect.appendChild(option);
}
byId("ver").textContent = `v${chrome.runtime.getManifest().version}`;

let agentStatus = { active: false, busy: false, provider: "" };
let providerChoiceLocked = false;

function state(dotId, valueId, tone, text) {
  byId(dotId).className = `dot ${tone || ""}`;
  byId(valueId).textContent = text;
}

function renderBridge(s) {
  if (!s || !s.connected) {
    state("bridge-dot", "bridge-state", "error", "Disconnected");
    state("studio-dot", "studio-state", "error", "Disconnected");
    return;
  }
  state("bridge-dot", "bridge-state", "connected", "Connected");
  const servers = Array.isArray(s.servers) ? s.servers : [];
  const roblox = servers.find((item) => item.id === "roblox");
  const mcpUp = roblox ? !!roblox.alive : !!s.mcpAlive;
  if (!mcpUp) state("studio-dot", "studio-state", "connecting", "Connecting");
  else if (s.studio === false) state("studio-dot", "studio-state", "error", "Disconnected");
  else state("studio-dot", "studio-state", "connected", "Connected");
}

function renderAgent(s) {
  const previousPageDetail = agentStatus.pageReady === false ? agentStatus.pageDetail : null;
  agentStatus = s || agentStatus;
  if (agentStatus.busy) state("agent-dot", "agent-state", "connecting", "Working");
  else if (agentStatus.active) state("agent-dot", "agent-state", "connected", "Active");
  else if (agentStatus.pageReady === false) state("agent-dot", "agent-state", "error", "Page not ready");
  else state("agent-dot", "agent-state", "", "Idle");
  byId("start").disabled = !!agentStatus.busy || !!agentStatus.active || agentStatus.pageReady === false;
  if (agentStatus.pageReady === false && agentStatus.pageDetail) byId("hint").textContent = agentStatus.pageDetail;
  else if (previousPageDetail && byId("hint").textContent === previousPageDetail) byId("hint").textContent = "";
  byId("stop").disabled = !agentStatus.busy;
  if (!providerChoiceLocked && agentStatus.provider && PROVIDERS.some((p) => p.id === agentStatus.provider)) {
    providerSelect.value = agentStatus.provider;
  }
}

function providerForUrl(url) {
  try {
    const host = new URL(url).hostname;
    return PROVIDERS.find((p) => p.hosts.includes(host)) || null;
  } catch { return null; }
}

function findProviderTab(provider, tabs) {
  const active = tabs.find((t) => t.active && providerForUrl(t.url)?.id === provider.id);
  return active || tabs.find((t) => providerForUrl(t.url)?.id === provider.id) || null;
}

function sendToSelected(type, openIfMissing = false) {
  const provider = PROVIDERS.find((p) => p.id === providerSelect.value) || PROVIDERS[0];
  chrome.tabs.query({}, (tabs) => {
    const tab = findProviderTab(provider, tabs);
    if (!tab) {
      if (openIfMissing) chrome.tabs.create({ url: provider.url });
      byId("hint").textContent = `${provider.name} opened. Start after its composer is ready.`;
      return;
    }
    chrome.tabs.update(tab.id, { active: true });
    chrome.tabs.sendMessage(tab.id, { type }, (result) => {
      if (chrome.runtime.lastError) {
        byId("hint").textContent = "Reload the AI page so the extension can attach.";
        return;
      }
      if (result) renderAgent(result);
      if (result && result.pageReady === false) return;
      byId("hint").textContent = type === "sll-stop-session" ? "Session stopped." : "Session command sent.";
    });
  });
}

function refresh() {
  chrome.runtime.sendMessage({ type: "status" }, (s) => s && renderBridge(s));
  chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
    const activeProvider = activeTabs[0] && providerForUrl(activeTabs[0].url);
    if (!providerChoiceLocked && activeProvider) providerSelect.value = activeProvider.id;
    const selected = PROVIDERS.find((p) => p.id === providerSelect.value) || PROVIDERS[0];
    chrome.tabs.query({}, (tabs) => {
      const tab = findProviderTab(selected, tabs);
      if (!tab) { renderAgent({ active: false, busy: false, provider: selected.id }); return; }
      chrome.tabs.sendMessage(tab.id, { type: "sll-session-status" }, (s) => {
        if (!chrome.runtime.lastError && s) renderAgent(s);
      });
    });
  });
}

providerSelect.addEventListener("change", () => {
  providerChoiceLocked = true;
  chrome.storage.local.set({ sllProvider: providerSelect.value });
  byId("hint").textContent = `Selected ${providerSelect.options[providerSelect.selectedIndex].text}.`;
});
byId("start").addEventListener("click", () => sendToSelected("sll-start-session", true));
byId("stop").addEventListener("click", () => sendToSelected("sll-stop-session"));
byId("reconnect").addEventListener("click", () => {
  state("bridge-dot", "bridge-state", "connecting", "Connecting");
  chrome.runtime.sendMessage({ type: "reconnect" }, () => setTimeout(refresh, 500));
});
byId("restart").addEventListener("click", () => {
  state("studio-dot", "studio-state", "connecting", "Connecting");
  chrome.runtime.sendMessage({ type: "restart_mcp" }, () => setTimeout(refresh, 800));
});
byId("settings").addEventListener("click", () => sendToSelected("zs-open-menu", true));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "zs-status") renderBridge(msg);
});
chrome.storage.local.get("sllProvider", (r) => {
  if (r && PROVIDERS.some((p) => p.id === r.sllProvider)) {
    providerSelect.value = r.sllProvider;
    providerChoiceLocked = true;
  }
  refresh();
});
setInterval(refresh, 2000);
