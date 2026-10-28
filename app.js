(function () {
  "use strict";
  var CLIPS = window.CLIPS || [], SECTIONS = window.SECTIONS || [];
  var MAP = window.ASSET_MAP || {};
  function A(p) { return MAP[p] || p; }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fmt(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }
  function inSection(c) { return CLIPS.filter(function (x) { return x.section === c.section; }); }

  var video = $("video"), cur = null, evEls = [], barEls = [], raf = 0, lastActive = "", homeScroll = 0;

  function card(c) {
    var a = el("a", "card"); a.href = "#/" + encodeURIComponent(c.id);
    var th = el("div", "th"), img = el("img"); img.loading = "lazy"; img.decoding = "async"; img.alt = ""; img.src = A(c.poster);
    th.appendChild(img); th.appendChild(el("span", "dur", fmt(c.dur).replace(/\.\d$/, ""))); a.appendChild(th);
    var b = el("div", "body"); b.appendChild(el("div", "txt", c.overview || (c.events[0] && (c.events[0].caption || c.events[0].transcript)) || ""));
    var ch = el("div", "chips"), seen = {};
    c.lanes.forEach(function (l) {
      var key = l.kind === "speech" ? "speech" : l.label; if (seen[key]) return; seen[key] = 1;
      var s = el("span", "chip"), d = el("i", "dot"); d.style.background = l.color; s.appendChild(d);
      s.appendChild(document.createTextNode(key)); ch.appendChild(s);
    });
    b.appendChild(ch); b.appendChild(el("div", "cid", c.id)); a.appendChild(b);
    return a;
  }

  function buildHome() {
    var root = $("sections");
    SECTIONS.forEach(function (s) {
      var sec = el("section", "sec"); sec.id = "sec-" + s.key;
      sec.appendChild(el("h2", null, s.title)); sec.appendChild(el("p", "secdesc", s.desc));
      var list = CLIPS.filter(function (c) { return c.section === s.key; });
      if (!list.length) sec.appendChild(el("div", "placeholder", "Examples coming soon."));
      else { var g = el("div", "gallery"); list.forEach(function (c) { g.appendChild(card(c)); }); sec.appendChild(g); }
      root.appendChild(sec);
    });
  }

  function ticks(dur) {
    var r = $("ruler"); r.innerHTML = "";
    var step = dur <= 12 ? 2 : dur <= 40 ? 5 : dur <= 90 ? 10 : 30;
    for (var t = step; t < dur - step * 0.3; t += step) {
      var s = el("span", null, t + "s"); s.style.left = (100 * t / dur) + "%"; r.appendChild(s);
    }
  }

  function open(c) {
    if (!cur) homeScroll = window.scrollY;
    cur = c; lastActive = "";
    $("home").hidden = true; $("player").hidden = false; window.scrollTo(0, 0);
    document.title = "SoundTrace · " + c.id;
    var sec = SECTIONS.filter(function (s) { return s.key === c.section; })[0];
    $("secname").textContent = sec ? sec.title : "";
    var SB = { pipeline: ["Annotation pipeline", "Training annotations from our automatic multi-stage annotation pipeline (not a model prediction)."],
      model: ["Model output \u00b7 Full-captioning mode", "Our trained model, given only the video, predicts every sound event, its time ranges and boxes."],
      model_ts: ["Model output \u00b7 Timestamp-request mode", "Our trained model was asked for boxes at the marked timestamps; it still predicts the full time ranges of the events active then."] };
    var sb = SB[c.section] || [sec ? sec.title : "", ""];
    $("srcban").className = "srcban srcban-" + c.section; $("srcban-k").textContent = sb[0]; $("srcban-d").textContent = sb[1];
    video.poster = A(c.poster); video.src = A(c.video); video.load();
    $("spec").src = A(c.spec); $("cid").textContent = "clip " + c.id;
    $("ov").hidden = !(c.overview || c.av_overview);
    $("ov1").textContent = c.overview; $("ov2").textContent = c.av_overview;
    var list = inSection(c), i = list.indexOf(c);
    $("prev").href = "#/" + encodeURIComponent(list[(i - 1 + list.length) % list.length].id);
    $("next").href = "#/" + encodeURIComponent(list[(i + 1) % list.length].id);
    hideKF(true);
    ticks(c.dur);
    Array.prototype.slice.call(document.querySelectorAll("#tl .rqm")).forEach(function (m) { m.remove(); });
    (c.marks || []).forEach(function (t) {
      var m = el("i", "rqm"); m.style.left = (100 * t / c.dur) + "%"; m.title = "box requested at " + t.toFixed(2) + "s"; $("tl").appendChild(m);
    });
    $("note").hidden = !c.note; $("note").textContent = c.note || "";
    var lanes = $("lanes"); lanes.innerHTML = ""; barEls = [];
    var laneEls = c.lanes.map(function (l) {
      var d = el("div", "lane"); d.appendChild(el("span", "lab", l.label)); lanes.appendChild(d); return d;
    });
    var caps = $("caps"); caps.innerHTML = ""; caps.scrollTop = 0; evEls = [];
    c.events.forEach(function (e, k) {
      var col = c.lanes[e.lane].color;
      e.win.forEach(function (w, wi) {
        var b = el("div", "bar"); b.style.background = col; b.dataset.sel = k + ":" + wi;
        b.style.left = (100 * w.s / c.dur) + "%"; b.style.width = (100 * (w.e - w.s) / c.dur) + "%";
        laneEls[e.lane].appendChild(b); barEls.push([b, w.s, w.e]);
        b.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); seek(w.s + 0.01); toggleKF(k, wi); });
        b.addEventListener("pointerenter", function (ev) { if (ev.pointerType === "mouse") previewKF(k, wi); });
        b.addEventListener("pointerleave", function (ev) { if (ev.pointerType === "mouse") unpreviewKF(); });
        w.kf.forEach(function (f) {
          var m = el("i", "kfm"); m.dataset.sel = k + ":" + wi; m.style.left = (100 * f.t / c.dur) + "%"; laneEls[e.lane].appendChild(m);
        });
      });
      var d = el("div", "ev"); d.tabIndex = 0; d.setAttribute("role", "button"); d.style.setProperty("--c", col); d.dataset.ev = k;
      var hd = el("div", "hd");
      hd.appendChild(el("span", "ty", e.type === "speech" ? e.speaker : e.type));
      hd.appendChild(el("span", null, fmt(e.ranges[0][0]) + "–" + fmt(e.ranges[e.ranges.length - 1][1])));
      if (e.sources && e.sources.length) hd.appendChild(el("span", null, "· box: " + e.sources.join(", ")));
      d.appendChild(hd);
      if (e.type === "speech") {
        if (e.speaker_desc) d.appendChild(el("div", "sd", e.speaker_desc));
        if (e.transcript) d.appendChild(el("q", null, e.transcript));
      } else d.appendChild(el("div", "tx", e.caption));
      var wl = el("div", "wins");
      e.win.forEach(function (w, wi) {
        var n = w.kf.length, chip = el("button", "win", fmt(w.s) + "–" + fmt(w.e) + (n ? " · " + n + " kf" : ""));
        chip.type = "button"; chip.dataset.sel = k + ":" + wi; chip.style.setProperty("--c", col);
        chip.addEventListener("click", function (ev) { ev.stopPropagation(); seek(w.s + 0.01); toggleKF(k, wi, d); });
        chip.addEventListener("pointerenter", function (ev) { if (ev.pointerType === "mouse") previewKF(k, wi); });
        chip.addEventListener("pointerleave", function (ev) { if (ev.pointerType === "mouse") unpreviewKF(); });
        wl.appendChild(chip);
      });
      d.appendChild(wl);
      d.addEventListener("click", function () {
        var t = video.currentTime || 0, wi = 0;
        e.win.forEach(function (w, i) { if (t >= w.s && t <= w.e) wi = i; });
        if (!(t >= e.win[wi].s && t <= e.win[wi].e)) seek(e.win[wi].s + 0.01);
        toggleKF(k, wi, d);
      });
      d.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); d.click(); } });
      caps.appendChild(d); evEls.push([d, e.ranges]);
    });
    update();
  }

  // ---- window panel: one localization window's text + its stored keyframe boxes (hover = preview, tap = pin).
  // It sits in the page flow (never over other content): under the timeline, or inside the caption card it was
  // opened from (there the card already shows the transcript, so the panel does not repeat it).
  var pop = $("kfpop"), shown = "", pinned = false, hideTimer = 0, host = null;
  function home() { var tl = $("tl"); if (pop.previousElementSibling !== tl) tl.parentNode.insertBefore(pop, tl.nextSibling); }
  function renderKF(k, wi) {
    var e = cur.events[k], w = e.win[wi], col = cur.lanes[e.lane].color;
    pop.innerHTML = ""; pop.style.setProperty("--c", col);
    var hd = el("div", "kfhd");
    hd.appendChild(el("span", "ty", e.type === "speech" ? e.speaker : e.type));
    hd.appendChild(el("span", "kfsum", fmt(w.s) + "–" + fmt(w.e) + (e.win.length > 1 ? " · window " + (wi + 1) + "/" + e.win.length : "")
      + " · " + (w.kf.length ? w.kf.length + " keyframe" + (w.kf.length > 1 ? "s" : "") : "no boxes")));
    var x = el("button", "kfx", "×"); x.type = "button"; x.setAttribute("aria-label", "Close");
    x.addEventListener("click", function () { hideKF(true); }); hd.appendChild(x);
    pop.appendChild(hd);
    var txt = el("div", "kftx");
    if (e.type === "speech") { if (e.transcript && !host) txt.appendChild(el("q", null, e.transcript)); }
    else txt.textContent = w.text || e.caption;
    if (txt.firstChild) pop.appendChild(txt);
    if (!w.kf.length) return;
    var sw = el("div", "kfsw"), strip = el("div", "kfstrip"), more = el("button", "kfmore", "›");
    more.type = "button"; more.setAttribute("aria-label", "More keyframes");
    more.addEventListener("click", function () { strip.scrollBy({ left: strip.clientWidth * 0.8, behavior: "smooth" }); });
    function edge() { sw.classList.toggle("more", strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4); }
    strip.addEventListener("scroll", edge, { passive: true });
    w.kf.forEach(function (f) {
      var fig = el("figure", "kf"), wrap = el("div", "kfimg"), img = el("img");
      img.loading = "lazy"; img.decoding = "async"; img.alt = ""; img.src = A(f.f); wrap.appendChild(img);
      f.b.forEach(function (b) {
        var r = el("div", "kfbox"); r.style.left = b[0] / 10 + "%"; r.style.top = b[1] / 10 + "%";
        r.style.width = (b[2] - b[0]) / 10 + "%"; r.style.height = (b[3] - b[1]) / 10 + "%";
        if (b[4]) { var l = el("span", "kflab", b[4]); if (b[1] < 80) l.classList.add("in"); if (b[0] > 600) l.classList.add("r"); r.appendChild(l); }
        wrap.appendChild(r);
      });
      fig.appendChild(wrap);
      var cap = el("figcaption"); cap.appendChild(el("b", null, f.t.toFixed(2) + "s")); if (f.d) cap.appendChild(document.createTextNode(" " + f.d));
      cap.title = f.d || ""; fig.appendChild(cap);
      fig.addEventListener("click", function () {
        video.pause(); seek(f.t); pinned = true;
        strip.querySelectorAll(".kf.on").forEach(function (o) { o.classList.remove("on"); }); fig.classList.add("on");
      });
      strip.appendChild(fig);
    });
    sw.appendChild(strip); sw.appendChild(more); pop.appendChild(sw);
    requestAnimationFrame(edge);
  }
  function showKF(k, wi, pin, where) {
    if (!cur || !cur.events[k]) return;
    var key = k + ":" + wi + (where ? "c" : "");
    if (where) { if (pop.parentNode !== where) where.appendChild(pop); } else home();
    host = where || null;
    if (shown !== key) renderKF(k, wi);
    shown = key; pinned = pinned || pin; pop.hidden = false;
    var sel = k + ":" + wi;
    document.querySelectorAll(".kfm, .bar, .win").forEach(function (m) { m.classList.toggle("sel", m.dataset.sel === sel); });
    document.querySelectorAll(".ev").forEach(function (m) { m.classList.toggle("sel", +m.dataset.ev === k); });
    if (pin && pop.scrollIntoView) pop.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function hideKF(force) {
    if (!force && pinned) return;
    pinned = false; shown = ""; host = null; pop.hidden = true; pop.innerHTML = ""; home();
    document.querySelectorAll(".sel").forEach(function (m) { m.classList.remove("sel"); });
  }
  function toggleKF(k, wi, where) {
    if (pinned && shown === k + ":" + wi + (where ? "c" : "")) hideKF(true); else { pinned = false; showKF(k, wi, true, where); }
  }
  function previewKF(k, wi) { clearTimeout(hideTimer); if (!pinned) showKF(k, wi, false); }
  function unpreviewKF() { clearTimeout(hideTimer); hideTimer = setTimeout(function () { if (!pinned) hideKF(false); }, 300); }
  pop.addEventListener("click", function (ev) { ev.stopPropagation(); });
  pop.addEventListener("keydown", function (ev) { if (ev.key !== "Escape") ev.stopPropagation(); });
  pop.addEventListener("pointerenter", function (ev) { if (ev.pointerType === "mouse") clearTimeout(hideTimer); });
  pop.addEventListener("pointerleave", function (ev) { if (ev.pointerType === "mouse") unpreviewKF(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") hideKF(true); });
  document.addEventListener("pointerdown", function (ev) {
    if (!shown || !pinned) return;
    if (ev.target.closest("#kfpop, .bar, .ev")) return;
    hideKF(true);
  });

  function seek(t) { if (!cur) return; video.currentTime = Math.max(0, Math.min(cur.dur - 0.05, t)); update(); }

  function update() {
    if (!cur) return;
    var t = video.currentTime || 0;
    $("playhead").style.left = (100 * Math.min(1, t / cur.dur)) + "%";
    barEls.forEach(function (b) { b[0].classList.toggle("on", t >= b[1] && t <= b[2]); });
    var act = [], first = null, latest = -1;
    evEls.forEach(function (x, k) {
      var on = false;
      x[1].forEach(function (r) { if (t >= r[0] && t <= r[1]) { on = true; if (r[0] > latest) { latest = r[0]; first = x[0]; } } });
      x[0].classList.toggle("on", on); if (on) act.push(k);
    });
    var key = act.join(",");
    if (key !== lastActive) {
      lastActive = key;
      if (first) {
        var box = $("caps"), top = first.offsetTop - box.offsetTop;
        box.scrollTop = top - 8;
      }
    }
  }

  function loop() { update(); raf = video.paused ? 0 : requestAnimationFrame(loop); }
  video.addEventListener("play", function () { if (!raf) raf = requestAnimationFrame(loop); });
  ["timeupdate", "seeked", "loadedmetadata", "pause"].forEach(function (n) { video.addEventListener(n, update); });

  var tl = $("tl"), dragging = false;
  function tlSeek(ev) {
    var r = tl.getBoundingClientRect();
    seek(cur.dur * Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)));
  }
  tl.addEventListener("pointerdown", function (ev) { dragging = true; tlSeek(ev); });
  tl.addEventListener("pointermove", function (ev) { if (dragging && ev.pointerType === "mouse") tlSeek(ev); });
  window.addEventListener("pointerup", function () { dragging = false; });
  tl.addEventListener("pointercancel", function () { dragging = false; });

  function route() {
    var m = location.hash.match(/^#\/(.+)$/), id = m && decodeURIComponent(m[1]);
    var c = id && CLIPS.filter(function (x) { return x.id === id; })[0];
    if (c) { open(c); return; }
    var wasPlayer = !!cur;
    cur = null; video.pause(); video.removeAttribute("src"); video.load();
    $("player").hidden = true; $("home").hidden = false; document.title = "SoundTrace: What, When, and Where Sounds Occur in Videos";
    if (wasPlayer) window.scrollTo(0, homeScroll);
  }
  buildHome();
  window.addEventListener("hashchange", route);
  route();
})();
