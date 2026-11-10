// RehearseAI interview summary: navigation, scaling and the per-slide animations.
(() => {
  "use strict";

  const stage = document.getElementById("stage");
  const slides = [...stage.querySelectorAll(".slide")];
  const counter = document.getElementById("counter");
  const progress = document.getElementById("progress");
  const dots = document.getElementById("dots");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");

  // Timers belong to the current slide and are cleared when it changes.
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, reduced ? 0 : ms));
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  const clearTimers = () => {
    timers.forEach((t) => (clearTimeout(t), clearInterval(t)));
    timers = [];
  };

  // ---------- scale the 1440x900 stage to the window ----------
  const fit = () => {
    const s = Math.min(innerWidth / 1440, innerHeight / 900);
    stage.style.transform = `scale(${s})`;
  };
  addEventListener("resize", fit);
  fit();

  // ---------- navigation ----------
  slides.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dot";
    b.textContent = i + 1;
    b.setAttribute("aria-label", `Slide ${i + 1}: ${s.getAttribute("aria-label").replace(/^\d+ of \d+: /, "")}`);
    b.addEventListener("click", () => go(i));
    dots.append(b);
  });

  let current = -1;
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === current) return;
    clearTimers();
    closePhase();
    slides.forEach((s, j) => {
      s.classList.toggle("is-active", j === i);
      s.setAttribute("aria-hidden", j === i ? "false" : "true");
      s.inert = j !== i;
    });
    // Restart CSS entrance animations on the new slide.
    const s = slides[i];
    s.classList.remove("is-active");
    void s.offsetWidth;
    s.classList.add("is-active");

    current = i;
    stage.dataset.slide = String(i);
    counter.textContent = `${pad(i + 1)} / ${pad(slides.length)}`;
    progress.style.width = `${((i + 1) / slides.length) * 100}%`;
    [...dots.children].forEach((d, j) => (j === i ? d.setAttribute("aria-current", "step") : d.removeAttribute("aria-current")));
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    history.replaceState(null, "", `#${i + 1}`);
    (enter[i] || (() => {}))();
  }

  prev.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest("button, a") && (e.key === " " || e.key === "Enter")) return;
    const k = e.key;
    if (current === 2 && openPhase >= 0 && (k === "ArrowDown" || k === "ArrowUp" || k === "Escape")) {
      if (k === "Escape") closePhase();
      else openPhaseAt(openPhase + (k === "ArrowDown" ? 1 : -1));
      e.preventDefault();
      return;
    }
    if (k === "ArrowRight" || k === "PageDown" || k === " ") go(current + 1);
    else if (k === "ArrowLeft" || k === "PageUp" || k === "Backspace") go(current - 1);
    else if (k === "Home") go(0);
    else if (k === "End") go(slides.length - 1);
    else if (/^[1-9]$/.test(k)) go(Number(k) - 1);
    else if (k === "a" || k === "A") approve();
    else if (k === "f" || k === "F") fullscreen();
    else return;
    e.preventDefault();
  });
  // Click / swipe on empty stage space also advances.
  let touchX = null;
  stage.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  // ---------- 3 · pipeline: the image capsule travels through the stages ----------
  const track = document.getElementById("track");
  const capsule = document.getElementById("capsule");
  const boxes = [...document.querySelectorAll("#stages .stage-box")];
  const gate = document.getElementById("gate");
  const approveBtn = document.getElementById("approve");
  const canary = document.getElementById("canary");
  const canaryLabel = document.getElementById("canary-label");
  const GATE = 4;
  let pipeAt = 0;
  let waiting = false;

  function moveCapsule(i) {
    const box = boxes[i];
    const x = box.offsetLeft + box.offsetWidth / 2 - capsule.offsetWidth / 2;
    capsule.style.transform = `translateX(${x}px)`;
    boxes.forEach((b, j) => {
      b.classList.toggle("here", j === i);
      b.classList.toggle("done", j < i && b !== gate);
    });
  }
  function runPipeline() {
    waiting = false;
    pipeAt = 0;
    gate.classList.remove("waiting", "approved");
    approveBtn.disabled = false;
    approveBtn.innerHTML = 'Approve <kbd style="border-color:#1a1206">A</kbd>';
    canary.style.width = "0";
    canaryLabel.textContent = "waiting";
    capsule.style.opacity = "1";
    capsule.style.transition = "none";
    moveCapsule(0);
    void capsule.offsetWidth;
    capsule.style.transition = "";
    const step = () => {
      if (pipeAt >= GATE) {
        waiting = true;
        gate.classList.add("waiting");
        return;
      }
      pipeAt += 1;
      moveCapsule(pipeAt);
      later(step, 1100);
    };
    later(step, 1600);
  }
  function approve() {
    if (current !== 2 || !waiting) return;
    waiting = false;
    gate.classList.remove("waiting");
    gate.classList.add("approved");
    approveBtn.disabled = true;
    approveBtn.textContent = "Approved";
    later(() => {
      pipeAt = 5;
      moveCapsule(5);
      canaryLabel.textContent = "canary 10%";
      canary.style.width = "10%";
    }, 500);
    later(() => {
      canaryLabel.textContent = "healthy · 100%";
      canary.style.width = "100%";
      boxes[5].classList.add("done");
    }, 2900);
  }
  approveBtn.addEventListener("click", approve);
  document.getElementById("pipe-replay").addEventListener("click", () => {
    clearTimers();
    runPipeline();
  });

  // ---------- 3 · pipeline: click a stage to open its details panel ----------
  const slide3 = slides[2];
  const panel = document.getElementById("phase-panel");
  const caret = document.getElementById("phase-caret");
  const phases = [...panel.querySelectorAll(".phase")];
  const hint = document.querySelector(".chrome-bottom .hint");
  const hintDefault = hint.innerHTML;
  let openPhase = -1;
  phases.forEach((ph) => ph.querySelectorAll(".item").forEach((el, i) => el.style.setProperty("--i", i)));
  const probes = document.getElementById("probes");
  for (let i = 0; i < 24; i++) {
    const s = document.createElement("span");
    s.style.setProperty("--p", i);
    probes.append(s);
  }

  function openPhaseAt(i) {
    i = (i + boxes.length) % boxes.length;
    openPhase = i;
    slide3.classList.add("is-open");
    panel.hidden = false;
    panel.classList.toggle("is-gate", i === GATE);
    phases.forEach((ph, j) => (ph.hidden = j !== i));
    boxes.forEach((b, j) => {
      b.classList.toggle("selected", j === i);
      b.setAttribute("aria-expanded", String(j === i));
    });
    panel.setAttribute("aria-label", `Details: ${boxes[i].querySelector(".name").textContent}`);
    hint.innerHTML = "<kbd>↑</kbd> <kbd>↓</kbd> phase · <kbd>Esc</kbd> close · <kbd>←</kbd> <kbd>→</kbd> slides";
    // Point the caret at the card (the track and the panel share a left edge).
    const b = boxes[i];
    caret.style.setProperty("--x", `${b.offsetLeft + b.offsetWidth / 2 - 10}px`);
  }
  function closePhase() {
    if (openPhase < 0) return;
    openPhase = -1;
    slide3.classList.remove("is-open");
    panel.hidden = true;
    boxes.forEach((b) => {
      b.classList.remove("selected");
      b.setAttribute("aria-expanded", "false");
    });
    hint.innerHTML = hintDefault;
  }
  boxes.forEach((b, i) => {
    b.addEventListener("click", (e) => {
      if (e.target.closest("button")) return; // the Approve button keeps its own job
      openPhase === i ? closePhase() : openPhaseAt(i);
    });
    b.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !e.target.closest("button")) {
        e.preventDefault();
        e.stopPropagation();
        openPhase === i ? closePhase() : openPhaseAt(i);
      }
    });
  });
  document.getElementById("phase-close").addEventListener("click", closePhase);

  // ---------- 4 · scenario A: outage clock, error rain, guardrails lighting up ----------
  const compare = document.getElementById("compare");
  const clock = document.getElementById("clock");
  const outageBar = document.getElementById("outage-bar");
  const rain = document.getElementById("rain");
  const guards = [...document.querySelectorAll("#guard .pill")];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement("span");
    s.textContent = "500";
    s.style.left = `${(i * 37) % 96}%`;
    s.style.animationDelay = `${(i * 0.23) % 1.6}s`;
    rain.append(s);
  }
  document.querySelectorAll(".seg button").forEach((b) =>
    b.addEventListener("click", () => {
      compare.dataset.mode = b.dataset.mode;
      document.querySelectorAll(".seg button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    }),
  );
  function runScenarioA() {
    // Nine real minutes, replayed in nine seconds.
    let secs = 0;
    clock.textContent = "00:00 of 500s";
    outageBar.style.width = "0";
    guards.forEach((g) => g.classList.remove("lit"));
    later(() => {
      every(() => {
        if (secs >= 540) return;
        secs = Math.min(540, secs + 6);
        clock.textContent = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)} of 500s`;
        outageBar.style.width = `${(secs / 540) * 100}%`;
      }, 100);
    }, 900);
    guards.forEach((g, i) => later(() => g.classList.add("lit"), 1400 + i * 700));
  }

  // ---------- 5 · scenario B: PRs leave the queue and land in their lanes ----------
  const incoming = [...document.querySelectorAll(".incoming .pr")];
  const slotFor = (lane) => document.querySelector(`.slot[data-slot="${lane}"]`);
  const STATUS = { low: "merged automatically", med: "waiting for 1 review", high: "waiting for code owner" };
  const inboxZero = document.getElementById("inbox-zero");
  function runScenarioB() {
    inboxZero.classList.remove("show");
    later(() => inboxZero.classList.add("show"), 1500 + incoming.length * 650 + 300);
    document.querySelectorAll(".slot").forEach((s) => (s.innerHTML = ""));
    incoming.forEach((p) => p.classList.remove("gone"));
    incoming.forEach((p, i) =>
      later(() => {
        p.classList.add("gone");
        const lane = p.dataset.lane;
        const card = document.createElement("div");
        card.className = "pr";
        card.innerHTML = `${p.innerHTML}<span class="status">${STATUS[lane]}</span>`;
        slotFor(lane).append(card);
        requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("in")));
      }, 1500 + i * 650),
    );
  }

  // ---------- 6 · live demo: countdown, letter drop, ripples ----------
  const demo = slides[5];
  const countdown = demo.querySelector(".countdown span");
  document.querySelectorAll("#demo-title .line").forEach((line, li) => {
    const offset = li * 11;
    line.innerHTML = [...line.dataset.text]
      .map((c, i) => (c === " " ? " " : `<span class="ch" aria-hidden="true" style="--i:${offset + i}">${c}</span>`))
      .join("");
  });
  function runDemo() {
    demo.classList.remove("started");
    if (reduced) {
      demo.classList.add("started");
      return;
    }
    [3, 2, 1].forEach((n, i) =>
      later(() => {
        countdown.textContent = n;
        countdown.classList.remove("tick");
        void countdown.offsetWidth;
        countdown.classList.add("tick");
      }, 300 + i * 850),
    );
    later(() => demo.classList.add("started"), 300 + 3 * 850);
  }
  const links = window.PRESENTATION_LINKS || {};
  for (const [id, key] of [["link-app", "app"], ["link-actions", "actions"], ["link-grafana", "grafana"]]) {
    const a = document.getElementById(id);
    if (links[key]) a.href = links[key];
    else a.hidden = true;
  }

  const enter = { 2: runPipeline, 3: runScenarioA, 4: runScenarioB, 5: runDemo };

  const start = Number(location.hash.slice(1));
  go(Number.isInteger(start) && start >= 1 && start <= slides.length ? start - 1 : 0);
})();
