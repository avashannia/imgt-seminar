/* IMGT211: SQL Functions Seminar - Yes gate, 1-hour timer, attendance to Google Sheets, certificate */

// The seminar hour starts when the student taps Yes. The certificate unlocks when it ends.
const UNLOCK_DELAY_MS = 60 * 60 * 1000;

// Paste your deployed Google Apps Script web-app URL here (see google-apps-script.gs).
const APPS_SCRIPT_URL = "https://script.google.com/macros/library/d/1cNhp5QRw28FBYS65hOkI9breXVsG-Tr4Fm4Z6GNJLiK4GliRcFgWsSiv/1";

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
let dodges = 0;
function dodge(e) {
  e.preventDefault();
  const r = Math.min(150, innerWidth / 3);
  no.style.transform = `translate(${(Math.random() * 2 - 1) * r}px, ${(Math.random() * 2 - 1) * 70}px)`;
  no.textContent = labels[++dodges % labels.length];
  if (e.type === "focus") no.blur();
}
["pointerenter", "pointerdown", "touchstart", "focus", "click"].forEach((ev) =>
  no.addEventListener(ev, dodge),
);

function begin(animate) {
  document.body.classList.add("started");
  const swap = () => {
    $("#gate").hidden = true;
    $("#live").hidden = false;
    tick();
  };
  if (animate) {
    $("#gate").classList.add("out");
    setTimeout(swap, 450);
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
  $("#clockNote").textContent =
    left > 0 ? "Seminar time remaining" : "Time's up. Claim your certificate.";
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
  if (!rec) return show("viewForm");
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
      body: JSON.stringify(rec),
    }).catch(() => {});
  }
  e.target.reset();
  renderModal();
});

/* ---------- Certificate (canvas) ---------- */
function drawCertificate(c, rec) {
  const W = (c.width = 1600),
    H = (c.height = 1130),
    x = c.getContext("2d");
  const line = (t, y, f, col) => {
    x.font = f;
    x.fillStyle = col;
    x.textAlign = "center";
    x.fillText(t, W / 2, y);
  };
  x.fillStyle = "#F5F2EB";
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "#1E3A2F";
  x.lineWidth = 18;
  x.strokeRect(40, 40, W - 80, H - 80);
  x.strokeStyle = "#4ADE80";
  x.lineWidth = 4;
  x.strokeRect(75, 75, W - 150, H - 150);
  x.fillStyle = "#111312";
  x.fillRect(75, 75, W - 150, 170);
  line(
    "IMGT211",
    150,
    "600 44px ui-monospace, Menlo, Consolas, monospace",
    "#4ADE80",
  );
  line(
    "SQL Functions Seminar",
    215,
    "700 54px -apple-system, Helvetica, Arial, sans-serif",
    "#F5F2EB",
  );
  line(
    "Certificate of Participation",
    380,
    "700 84px -apple-system, Helvetica, Arial, sans-serif",
    "#1E3A2F",
  );
  line(
    "This certifies that",
    470,
    "36px -apple-system, Helvetica, Arial, sans-serif",
    "#111312",
  );
  let size = 120; // shrink long names to fit
  do {
    x.font = `700 ${size}px -apple-system, Helvetica, Arial, sans-serif`;
    size -= 4;
  } while (x.measureText(rec.fullName).width > W - 360 && size > 40);
  line(rec.fullName, 620, x.font, "#111312");
  x.strokeStyle = "#1E3A2F";
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(300, 655);
  x.lineTo(W - 300, 655);
  x.stroke();
  line(
    "has attended and participated in the",
    730,
    "36px -apple-system, Helvetica, Arial, sans-serif",
    "#111312",
  );
  line(
    "IMGT211: SQL Functions Seminar",
    800,
    "700 52px -apple-system, Helvetica, Arial, sans-serif",
    "#1E3A2F",
  );
  if (rec.section)
    line(
      "Section / ID: " + rec.section,
      860,
      "32px -apple-system, Helvetica, Arial, sans-serif",
      "#111312",
    );
  line(
    new Date(rec.submittedAt).toLocaleDateString("en-PH", {
      dateStyle: "long",
    }),
    925,
    "32px -apple-system, Helvetica, Arial, sans-serif",
    "#111312",
  );
  x.strokeStyle = "#111312";
  x.lineWidth = 2;
  [
    [260, 640, "Lead Speaker"],
    [W - 640, W - 260, "Course Instructor"],
  ].forEach(([a, b, t]) => {
    x.beginPath();
    x.moveTo(a, 1020);
    x.lineTo(b, 1020);
    x.stroke();
    x.font = "28px -apple-system, Helvetica, Arial, sans-serif";
    x.fillStyle = "#111312";
    x.fillText(t, (a + b) / 2, 1058);
  });
}
$("#downloadCert").addEventListener("click", () => {
  const rec = store.get(K.att);
  $("#certCanvas").toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "IMGT211-Certificate-" + rec.fullName.replace(/\s+/g, "_") + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});
