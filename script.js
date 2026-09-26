(function () {
  const items = window.POIMEN_MEDIA || [];
  const grid = document.getElementById("gallery-grid");
  const empty = document.getElementById("gallery-empty");
  const lightbox = document.getElementById("lightbox");
  const lbContent = lightbox.querySelector(".lb-content");
  let visible = [];
  let current = 0;

  document.getElementById("year").textContent = new Date().getFullYear();

  function render(filter) {
    visible = items.filter((it) => filter === "all" || it.type === filter);
    grid.innerHTML = "";
    empty.hidden = visible.length > 0;

    visible.forEach((it, i) => {
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.style.setProperty("--i", i);
      tile.setAttribute("aria-label", it.caption || (it.type === "video" ? "Play video" : "View photo"));

      if (it.type === "video") {
        const v = document.createElement("video");
        v.src = it.src;
        if (it.poster) v.poster = it.poster;
        v.muted = true;
        v.preload = "metadata";
        tile.appendChild(v);
        tile.insertAdjacentHTML("beforeend", '<span class="play">▶</span>');
      } else {
        const img = document.createElement("img");
        img.src = it.src;
        img.alt = it.caption || "POIMEN photo";
        img.loading = "lazy";
        tile.appendChild(img);
      }

      if (it.caption) {
        const cap = document.createElement("span");
        cap.className = "cap";
        cap.textContent = it.caption;
        tile.appendChild(cap);
      }

      tile.addEventListener("click", () => open(i));
      grid.appendChild(tile);
    });
  }

  function show(i) {
    current = (i + visible.length) % visible.length;
    const it = visible[current];
    lbContent.innerHTML = "";
    const el = document.createElement(it.type === "video" ? "video" : "img");
    el.src = it.src;
    if (it.type === "video") {
      el.controls = true;
      el.autoplay = true;
      if (it.poster) el.poster = it.poster;
    } else {
      el.alt = it.caption || "POIMEN photo";
    }
    lbContent.appendChild(el);
    if (it.caption) {
      const p = document.createElement("p");
      p.textContent = it.caption;
      lbContent.appendChild(p);
    }
  }

  function open(i) {
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    show(i);
  }

  function close() {
    lightbox.hidden = true;
    lbContent.innerHTML = "";
    document.body.style.overflow = "";
  }

  lightbox.querySelector(".lb-close").addEventListener("click", close);
  lightbox.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
  lightbox.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) close(); });
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });

  document.querySelectorAll(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      render(btn.dataset.filter);
    });
  });

  render("all");

  // Split the hero title into letters so they can animate in one by one
  const title = document.querySelector(".hero h1");
  title.setAttribute("aria-label", title.textContent);
  title.innerHTML = [...title.textContent]
    .map((ch, i) => `<span aria-hidden="true" style="--i:${i}">${ch}</span>`)
    .join("");

  // Hero spotlight follows the pointer
  const hero = document.getElementById("hero");
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
    hero.style.setProperty("--my", `${e.clientY - r.top}px`);
  });

  // Instrument sounds, synthesized with the Web Audio API (no audio files needed)
  let ctx, master, noise;

  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(comp).connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  // Plucked string (Karplus-Strong)
  function pluck(freq, t, { dur = 2, decay = 0.996, gain = 0.4, dest = master } = {}) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const n = Math.max(2, Math.round(sr / freq));
    const line = new Float32Array(n);
    for (let i = 0; i < n; i++) line[i] = Math.random() * 2 - 1;
    for (let i = 0; i < len; i++) {
      const j = i % n;
      out[i] = line[j];
      line[j] = decay * 0.5 * (line[j] + line[(j + 1) % n]);
    }
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = gain;
    src.connect(g).connect(dest);
    src.start(t);
  }

  function strum(notes, t, gap, opts) {
    notes.forEach((f, i) => pluck(f, t + i * gap, opts));
  }

  function filtered(type, freq, gain) {
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    f.type = type;
    f.frequency.value = freq;
    g.gain.value = gain;
    f.connect(g).connect(master);
    return f;
  }

  function envelope(node, t, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    return g;
  }

  function noiseHit(t, type, freq, peak, dur) {
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    src.buffer = noise;
    f.type = type;
    f.frequency.value = freq;
    src.connect(f);
    envelope(f, t, peak, dur).connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  function kick(t) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    envelope(o, t, 1, 0.4).connect(master);
    o.start(t);
    o.stop(t + 0.4);
  }

  function tom(t, freq) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.25);
    envelope(o, t, 0.6, 0.3).connect(master);
    o.start(t);
    o.stop(t + 0.3);
  }

  function snare(t) {
    noiseHit(t, "highpass", 1500, 0.6, 0.2);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 185;
    envelope(o, t, 0.3, 0.1).connect(master);
    o.start(t);
    o.stop(t + 0.1);
  }

  function keyNote(freq, t, dur) {
    [["triangle", 1, 0.18], ["sine", 2, 0.06]].forEach(([type, mult, peak]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq * mult;
      envelope(o, t, peak, dur).connect(master);
      o.start(t);
      o.stop(t + dur);
    });
  }

  const SOUNDS = {
    electric(t) {
      const drive = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = (41 * x) / (1 + 40 * Math.abs(x));
      }
      drive.curve = curve;
      drive.connect(filtered("lowpass", 3200, 0.25));
      const opts = { dur: 1.6, decay: 0.998, gain: 0.5, dest: drive };
      strum([82.41, 123.47, 164.81], t, 0.012, opts); // E5
      strum([110, 164.81, 220], t + 0.55, 0.012, opts); // A5
      strum([98, 146.83, 196], t + 0.9, 0.012, opts); // G5
    },
    bass(t) {
      const dest = filtered("lowpass", 900, 1.4);
      const opts = { dur: 1.2, decay: 0.998, gain: 0.8, dest };
      [[41.2, 0], [41.2, 0.25], [55, 0.5], [61.74, 0.75], [49, 1.0]].forEach(([f, at]) => pluck(f, t + at, opts));
    },
    acoustic(t) {
      const opts = { dur: 2.2, decay: 0.997, gain: 0.25 };
      strum([98, 123.47, 146.83, 196, 246.94, 392], t, 0.025, opts); // G
      strum([130.81, 164.81, 196, 261.63, 329.63], t + 0.8, 0.025, opts); // C
    },
    keys(t) {
      [261.63, 329.63, 392, 493.88].forEach((f, i) => keyNote(f, t + i * 0.12, 1.2)); // Cmaj7 arpeggio
      [261.63, 329.63, 392, 493.88, 587.33].forEach((f) => keyNote(f, t + 0.6, 2)); // Cmaj9 chord
    },
    drums(t) {
      const step = 0.18;
      const pattern = ["kh", "h", "sh", "h", "kh", "kh", "sh", "t"];
      pattern.forEach((hits, i) => {
        const at = t + i * step;
        if (hits.includes("k")) kick(at);
        if (hits.includes("s")) snare(at);
        if (hits.includes("h")) noiseHit(at, "highpass", 7000, 0.25, 0.05);
        if (hits.includes("t")) { tom(at, 220); tom(at + step / 2, 150); }
      });
      kick(t + 8 * step);
      noiseHit(t + 8 * step, "highpass", 5000, 0.5, 1.4); // crash
    },
  };

  document.querySelectorAll(".instrument").forEach((btn) => {
    const hint = btn.querySelector(".inst-hint");
    btn.addEventListener("click", () => {
      audio();
      SOUNDS[btn.dataset.sound](ctx.currentTime + 0.05);
      btn.classList.remove("playing");
      void btn.offsetWidth; // restart the CSS animations
      btn.classList.add("playing");
      hint.textContent = "♪ Playing";
      clearTimeout(btn.timer);
      btn.timer = setTimeout(() => {
        btn.classList.remove("playing");
        hint.textContent = "Tap to hear";
      }, 2600);
    });
  });

  // YouTube: swap the thumbnail for the real player on click (keeps the page fast)
  document.querySelectorAll(".yt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.id}?autoplay=1&rel=0`;
      iframe.title = btn.querySelector(".yt-title").textContent;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      const player = document.createElement("div");
      player.className = "yt";
      player.appendChild(iframe);
      btn.replaceWith(player);
    });
  });

  // Nav shadow once the page is scrolled
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Reveal elements as they enter the viewport
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach((el) => revealer.observe(el));

  // Highlight the nav link for the section in view
  const links = document.querySelectorAll(".nav nav a");
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${entry.target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["about", "band", "listen", "gallery", "contact"].forEach((id) => spy.observe(document.getElementById(id)));
})();
