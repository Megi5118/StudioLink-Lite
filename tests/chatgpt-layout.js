// SPDX-License-Identifier: GPL-3.0-or-later
// Geometry regression for the screenshot's grid with NO named header area.
// Run tests/chatgpt-layout.html in Chromium via a localhost HTTP server.
(() => {
  const main = document.querySelector("main");
  const surface = document.querySelector("[data-composer-surface]");
  const editor = () => document.getElementById("prompt-textarea");
  const wide = () => { main.style.width = "min(768px, calc(100% - 32px))"; };
  const narrow = () => { main.style.width = "340px"; };
  const setText = (text) => { editor().textContent = text; };
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  async function settle() { for (let i = 0; i < 8; i++) await frame(); }
  document.getElementById("empty").onclick = () => setText("");
  document.getElementById("typed").onclick = () => setText("test wiadomości");
  document.getElementById("wide").onclick = wide;
  document.getElementById("narrow").onclick = narrow;
  document.getElementById("run-layout").onclick = async function () {
    this.disabled = true;
    const results = document.getElementById("test-results");
    let passed = 0, failed = 0;
    results.textContent = "";
    const check = (name, yes) => { yes ? passed++ : failed++; results.textContent += `${yes ? "PASS" : "FAIL"} ${name}\n`; };
    for (const legacy of [false, true]) {
      surface.classList.toggle("legacy", legacy);
      for (const small of [false, true]) {
        small ? narrow() : wide();
        for (const text of ["", "test wiadomości", "wiersz 1\nwiersz 2\nwiersz 3"]) {
          setText(text); await settle();
          const tag = `${legacy ? "stary grid" : "grid bez header"}, ${small ? "340px" : "768px"}, ${text ? "tekst" : "pusto"}`;
          const bar = document.getElementById("zs-bar");
          const br = bar.getBoundingClientRect(), sr = surface.getBoundingClientRect();
          const er = editor().getBoundingClientRect(), nr = document.querySelector(".native-trailing").getBoundingClientRect();
          check(`${tag}: pasek poza siatką strony`, bar.parentElement.id === "zs-root" && !surface.contains(bar));
          check(`${tag}: pełna szerokość i brak nachodzenia na pole`, Math.abs(br.left - sr.left) < 2 && Math.abs(br.width - sr.width) < 2 && br.bottom + 2 <= er.top);
          check(`${tag}: natywne przyciski przy prawej krawędzi`, Math.abs(nr.right - (sr.right - 16)) < 2 && er.width > sr.width - 40);
          check(`${tag}: elementy paska bez przepełnienia`, [...bar.children].filter(e => e.getClientRects().length).every(e => {
            const r = e.getBoundingClientRect(); return r.left >= br.left && r.right <= br.right + 1 && r.top >= br.top && r.bottom <= br.bottom + 1;
          }) && bar.scrollWidth <= bar.clientWidth + 1);
        }
      }
    }
    // React-style composer remount: bar must re-anchor, not stay in a stale subtree.
    const band = editor().parentElement;
    const replacement = band.cloneNode(true); band.replaceWith(replacement);
    surface.classList.remove("legacy"); wide(); setText("test wiadomości");
    await settle();
    check("odtworzenie edytora zachowuje pasek poza formularzem", document.getElementById("zs-bar").parentElement.id === "zs-root");
    results.textContent += `\n${passed} passed, ${failed} failed`;
    results.className = failed ? "fail" : "pass";
    this.disabled = false;
  };
})();
