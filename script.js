const UNLOCK_DELAY_MS = 60 * 60 * 1000;

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx8sP5FhHeAGgrnBGhhWCQS_MEKcepVCiUp-pCTUWhia7VCENjsxmpbjGujpPsraWFM/exec";

const K = { start: "imgt211.start", att: "imgt211.att" };
const $ = (s) => document.querySelector(s);
const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
const pad = (n) => String(n).padStart(2, "0");
const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [(s / 3600) | 0, ((s % 3600) / 60) | 0, s % 60].map(pad).join(":");
};

let startedAt = store.get(K.start);
const msLeft = () => startedAt + UNLOCK_DELAY_MS - Date.now();

/* ---------- Hero gate: Yes works, No runs away ---------- */
const no = $("#noBtn"),
  labels = ["No", "Nope", "Try Yes", "Nice try", "Just say yes"];
let dodges = 0,
  nx = 0,
  ny = 0;
// Move No to a random spot on screen (never on top of Yes). Works on phones: tracks its own offset.
function moveNo() {
  const r = no.getBoundingClientRect(),
    y = $("#yesBtn").getBoundingClientRect();
  const bx = r.left - nx,
    by = r.top - ny; // resting position without the offset
  for (let i = 0; i < 8; i++) {
    const tx = 12 + Math.random() * Math.max(0, innerWidth - r.width - 24);
    const ty = Math.max(
      12,
      Math.min(innerHeight - r.height - 12, by + (Math.random() * 2 - 1) * 120),
    );
    const hit =
      tx < y.right + 8 &&
      tx + r.width > y.left - 8 &&
      ty < y.bottom + 8 &&
      ty + r.height > y.top - 8;
    if (!hit || i === 7) {
      nx = tx - bx;
      ny = ty - by;
      break;
    }
  }
  no.style.transform = `translate(${nx}px, ${ny}px)`;
}
function dodge(e) {
  e.preventDefault();
  no.textContent = labels[++dodges % labels.length];
  moveNo();
  if (e.type === "focus") no.blur();
}
["pointerenter", "pointerdown", "touchstart", "focus", "click"].forEach((ev) =>
  no.addEventListener(ev, dodge),
);
// Even if nobody touches it, No keeps wandering until Yes is clicked.
const roam = setInterval(
  () =>
    document.body.classList.contains("started")
      ? clearInterval(roam)
      : moveNo(),
  1400,
);

function begin(animate) {
  document.body.classList.add("started");
  const swap = () => {
    $("#gate").hidden = true;
    $("#in").hidden = false;
    tick();
    observe();
  };
  if (animate) {
    $("#gate").classList.add("out");
    setTimeout(swap, 450);
    setTimeout(() => $("#agenda").scrollIntoView({ behavior: "smooth" }), 1500); // agenda + speakers first
  } else swap();
}
$("#yesBtn").addEventListener("click", () => {
  startedAt = Date.now();
  store.set(K.start, startedAt);
  begin(true);
});
if (startedAt) begin(false); // returning visitor: timer keeps running

/* ---------- Timer ---------- */
function tick() {
  if (!startedAt) return;
  const left = msLeft();
  $("#clock").textContent = clock(left);
  $("#clockNote").textContent = left > 0 ? "Time left" : "Time's up";
  if ($("#modal").open && !$("#viewLocked").hidden)
    left > 0 ? ($("#lockClock").textContent = clock(left)) : renderModal();
}
setInterval(tick, 1000);

/* ---------- Modal: form -> locked -> certificate ---------- */
const modal = $("#modal");
const show = (id) =>
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== id));
function renderModal() {
  const rec = store.get(K.att);
  if (!rec) {
    $("#qBox").hidden = true;
    return show("viewForm");
  }
  $("#qBox").hidden = false;
  if (msLeft() <= 0) {
    show("viewCert");
    drawCertificate($("#certCanvas"), rec);
    return;
  }
  $("#lockName").textContent = rec.fullName;
  $("#lockClock").textContent = clock(msLeft());
  show("viewLocked");
}
$("#openModal").addEventListener("click", () => {
  renderModal();
  modal.showModal();
});
$("#closeModal").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.close();
});

$("#attForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const rec = {
    fullName: $("#fName").value.trim(),
    section: $("#fSection").value.trim(),
    question: $("#fQuestion").value.trim(),
    startedAt,
    submittedAt: Date.now(),
  };
  if (!rec.fullName) return;
  store.set(K.att, rec);
  // Send to Google Sheets (no-cors: the browser can't read the reply, so the row is the confirmation).
  if (APPS_SCRIPT_URL) {
    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ type: "attendance", ...rec }),
    }).catch(() => {});
  }
  e.target.reset();
  renderModal();
});

/* ---------- Certificate: the name is drawn on your template, then exported as a PDF ---------- */
// Where the name goes, in template pixels (2000 x 1414): center of the name line, its y, and the widest the name may be.
const NAME_LINE = { x: 1000, y: 826, maxW: 900 };
let tplPromise;
const loadTemplate = () =>
  (tplPromise =
    tplPromise ||
    new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = CERT_TEMPLATE_SRC;
    }));
async function drawCertificate(c, rec) {
  const img = await loadTemplate();
  try {
    await document.fonts.load('600 100px "Playfair Display"');
  } catch (e) {}
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  let size = 120; // shrink long names to fit the line
  do {
    x.font = `600 ${size}px "Playfair Display", Georgia, serif`;
    size -= 4;
  } while (x.measureText(rec.fullName).width > NAME_LINE.maxW && size > 40);
  x.fillStyle = "#3a0a0c";
  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  x.fillText(rec.fullName, NAME_LINE.x, NAME_LINE.y - 40); // sits just above the line
}

// Minimal one-page PDF (no library): the certificate JPEG scaled to A4 landscape.
function jpegToPdf(jpg, w, h) {
  const enc = new TextEncoder(),
    parts = [],
    off = [];
  let len = 0;
  const add = (v) => {
    const b = typeof v === "string" ? enc.encode(v) : v;
    parts.push(b);
    len += b.length;
  };
  const PW = 842,
    PH = Math.round((842 * h) / w);
  add("%PDF-1.4\n");
  off[1] = len;
  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  off[2] = len;
  add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  off[3] = len;
  add(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );
  off[4] = len;
  add(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
  );
  add(jpg);
  add("\nendstream\nendobj\n");
  const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
  off[5] = len;
  add(
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  );
  const xref = len;
  let t = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++)
    t += String(off[i]).padStart(10, "0") + " 00000 n \n";
  add(t + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}

$("#downloadCert").addEventListener("click", () => {
  const rec = store.get(K.att),
    c = $("#certCanvas");
  c.toBlob(
    async (jpg) => {
      const pdf = jpegToPdf(
        new Uint8Array(await jpg.arrayBuffer()),
        c.width,
        c.height,
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(pdf);
      a.download =
        "IMGT211-Certificate-" + rec.fullName.replace(/\s+/g, "_") + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    "image/jpeg",
    0.95,
  );
});

/* ---------- Scroll + pointer effects ---------- */
// Fade each .reveal element up as it enters the screen (staggered inside the team grid).
var io; // var (not let) so begin() can run observe() on page load
function observe() {
  io =
    io ||
    new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
  document
    .querySelectorAll(".team .reveal")
    .forEach((el, i) => el.style.setProperty("--d", (i % 3) * 0.12 + "s"));
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
}
// Scroll position drives the silver ring parallax (CSS reads --sy).
addEventListener(
  "scroll",
  () => document.documentElement.style.setProperty("--sy", scrollY),
  { passive: true },
);
// Light follows the pointer across photo cards.
document.querySelectorAll(".person").forEach((c) =>
  c.addEventListener("pointermove", (e) => {
    const r = c.querySelector(".ph").getBoundingClientRect();
    c.style.setProperty("--mx", e.clientX - r.left + "px");
    c.style.setProperty("--my", e.clientY - r.top + "px");
  }),
);

/* ---------- Anonymous questions (separate "Questions" tab in the sheet) ---------- */
$("#qForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#qText").value.trim();
  if (!q) return;
  if (!APPS_SCRIPT_URL) {
    $("#qStatus").textContent =
      "Not connected yet: add APPS_SCRIPT_URL in script.js.";
    return;
  }
  // Only the question text and a timestamp are sent. No name, section, or saved attendance data.
  fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      type: "question",
      question: q,
      submittedAt: Date.now(),
    }),
  }).catch(() => {});
  $("#qText").value = "";
  $("#qStatus").textContent = "Sent anonymously. You can send another.";
});

/* ---------- Modern effects: scroll progress, card spotlight, photo tilt, magnetic Yes ---------- */
addEventListener(
  "scroll",
  () => {
    const m = document.documentElement.scrollHeight - innerHeight;
    document.documentElement.style.setProperty("--p", m > 0 ? scrollY / m : 0);
  },
  { passive: true },
);
document.querySelectorAll(".agenda li").forEach((li) =>
  li.addEventListener("pointermove", (e) => {
    const r = li.getBoundingClientRect();
    li.style.setProperty("--mx", e.clientX - r.left + "px");
    li.style.setProperty("--my", e.clientY - r.top + "px");
  }),
);
document.querySelectorAll(".person").forEach((c) => {
  const ph = c.querySelector(".ph");
  c.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = ph.getBoundingClientRect();
    ph.style.setProperty(
      "--ry",
      ((e.clientX - r.left) / r.width - 0.5) * 12 + "deg",
    );
    ph.style.setProperty(
      "--rx",
      (0.5 - (e.clientY - r.top) / r.height) * 10 + "deg",
    );
  });
  c.addEventListener("pointerleave", () => {
    ph.style.setProperty("--rx", "0deg");
    ph.style.setProperty("--ry", "0deg");
  });
});
const yesBtn = $("#yesBtn");
yesBtn.addEventListener("pointermove", (e) => {
  const r = yesBtn.getBoundingClientRect();
  yesBtn.style.setProperty(
    "--tx",
    (e.clientX - r.left - r.width / 2) * 0.25 + "px",
  );
  yesBtn.style.setProperty(
    "--ty",
    (e.clientY - r.top - r.height / 2) * 0.35 + "px",
  );
});
yesBtn.addEventListener("pointerleave", () => {
  yesBtn.style.setProperty("--tx", "0px");
  yesBtn.style.setProperty("--ty", "0px");
});
