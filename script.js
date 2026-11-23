/* IMGT211: SQL Functions Seminar - countdown, attendance, timed certificate */

// Certificate unlocks this long after attendance is submitted (1 hour).
const UNLOCK_DELAY_MS = 60 * 60 * 1000;

// Optional: paste your Google Apps Script web-app URL to collect submissions from every device.
// const APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXX/exec";

const KEYS = { att: "imgt211.attendance", log: "imgt211.log", start: "imgt211.start" };
const $ = (s) => document.querySelector(s);

/* ---------- localStorage helpers (fail quietly in private mode) ---------- */
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

const pad = (n) => String(n).padStart(2, "0");
function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
}
const clock = (ms) => parts(ms).map(pad).join(":");

/* ---------- Hero countdown ---------- */
let startAt = store.get(KEYS.start);

function toLocalInput(ms) {
  return new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function updateHero() {
  const diff = startAt ? startAt - Date.now() : 0;
  const [h, m, s] = parts(diff);
  $("#cdH").textContent = pad(h);
  $("#cdM").textContent = pad(m);
  $("#cdS").textContent = pad(s);
  $("#cdStatus").textContent = !startAt
    ? "Set the start time to begin the countdown."
    : diff <= 0
      ? "The seminar has started."
      : "Starts " + new Date(startAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

$("#timerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  startAt = new Date($("#startInput").value).getTime();
  store.set(KEYS.start, startAt);
  updateHero();
});
$("#clearTimer").addEventListener("click", () => {
  startAt = null; store.del(KEYS.start); $("#startInput").value = ""; updateHero();
});
if (startAt) $("#startInput").value = toLocalInput(startAt);

/* ---------- Modal ---------- */
const modal = $("#modal");
const show = (id) => document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== id));

// Chooses which view to show: form -> locked -> certificate.
function renderModal() {
  const rec = store.get(KEYS.att);
  if (!rec) return show("viewForm");
  if (Date.now() - rec.submittedAt >= UNLOCK_DELAY_MS) {
    show("viewCert");
    drawCertificate($("#certCanvas"), rec);
  } else {
    $("#lockName").textContent = rec.fullName;
    $("#lockClock").textContent = clock(UNLOCK_DELAY_MS - (Date.now() - rec.submittedAt));
    show("viewLocked");
  }
}

$("#openModal").addEventListener("click", () => { renderModal(); modal.showModal(); });
$("#closeModal").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); }); // click backdrop

$("#attForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const rec = {
    fullName: $("#fName").value.trim(),
    section: $("#fSection").value.trim(),
    question: $("#fQuestion").value.trim(),
    submittedAt: Date.now(),
  };
  if (!rec.fullName) return;
  store.set(KEYS.att, rec);
  store.set(KEYS.log, (store.get(KEYS.log) || []).concat(rec)); // host view reads this list

  // Send to Google Sheets later (Apps Script doPost reads JSON from e.postData.contents):
  // fetch(APPS_SCRIPT_URL, { method: "POST", mode: "no-cors",
  //   headers: { "Content-Type": "text/plain" }, body: JSON.stringify(rec) }).catch(() => {});

  e.target.reset();
  renderModal();
});

$("#resetRecord").addEventListener("click", () => {
  if (confirm("Clear your saved attendance on this device? The 1-hour timer will restart if you submit again.")) {
    store.del(KEYS.att); renderModal();
  }
});

/* ---------- Certificate (canvas) ---------- */
function drawCertificate(c, rec) {
  const W = (c.width = 1600), H = (c.height = 1130), x = c.getContext("2d");
  const line = (txt, y, font, color) => {
    x.font = font; x.fillStyle = color; x.textAlign = "center"; x.fillText(txt, W / 2, y);
  };

  x.fillStyle = "#F5F2EB"; x.fillRect(0, 0, W, H);                       // cream paper
  x.strokeStyle = "#1E3A2F"; x.lineWidth = 18; x.strokeRect(40, 40, W - 80, H - 80);
  x.strokeStyle = "#4ADE80"; x.lineWidth = 4; x.strokeRect(75, 75, W - 150, H - 150);
  x.fillStyle = "#111312"; x.fillRect(75, 75, W - 150, 170);             // black header band
  line("IMGT211", 150, "600 44px ui-monospace, Menlo, Consolas, monospace", "#4ADE80");
  line("SQL Functions Seminar", 215, "700 54px Georgia, serif", "#F5F2EB");

  line("Certificate of Participation", 380, "700 84px Georgia, serif", "#1E3A2F");
  line("This certifies that", 470, "italic 36px Georgia, serif", "#111312");

  // Shrink long names until they fit inside the border
  let size = 120;
  do { x.font = `700 ${size}px Georgia, serif`; size -= 4; } while (x.measureText(rec.fullName).width > W - 360 && size > 40);
  line(rec.fullName, 620, x.font, "#111312");
  x.strokeStyle = "#1E3A2F"; x.lineWidth = 3;
  x.beginPath(); x.moveTo(300, 655); x.lineTo(W - 300, 655); x.stroke();

  line("has attended and participated in the", 730, "italic 36px Georgia, serif", "#111312");
  line("IMGT211: SQL Functions Seminar", 800, "700 52px Georgia, serif", "#1E3A2F");
  if (rec.section) line("Section / ID: " + rec.section, 860, "32px Georgia, serif", "#111312");
  line(new Date(rec.submittedAt).toLocaleDateString("en-PH", { dateStyle: "long" }), 925, "32px Georgia, serif", "#111312");

  // Signature lines
  x.strokeStyle = "#111312"; x.lineWidth = 2;
  [[260, 640, "Lead Speaker"], [W - 640, W - 260, "Course Instructor"]].forEach(([a, b, label]) => {
    x.beginPath(); x.moveTo(a, 1020); x.lineTo(b, 1020); x.stroke();
    x.font = "28px Georgia, serif"; x.fillStyle = "#111312"; x.textAlign = "center";
    x.fillText(label, (a + b) / 2, 1058);
  });
}

$("#downloadCert").addEventListener("click", () => {
  const rec = store.get(KEYS.att);
  $("#certCanvas").toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "IMGT211-Certificate-" + rec.fullName.replace(/\s+/g, "_") + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
});

/* ---------- Host view (submissions stored in this browser) ---------- */
$("#openHost").addEventListener("click", () => {
  const list = $("#hostList"), log = store.get(KEYS.log) || [];
  list.textContent = "";
  if (!log.length) list.innerHTML = "<li>No submissions on this device yet.</li>";
  log.forEach((r) => {
    const li = document.createElement("li"), sm = document.createElement("small");
    li.textContent = r.fullName + (r.section ? " (" + r.section + ")" : "");
    sm.textContent = new Date(r.submittedAt).toLocaleString() + (r.question ? " | Q: " + r.question : "");
    li.append(sm); list.append(li);
  });
  show("viewHost"); modal.showModal();
});

$("#exportCsv").addEventListener("click", () => {
  const q = (v) => '"' + String(v || "").replace(/"/g, '""') + '"';
  const rows = [["fullName", "section", "question", "submittedAt"]].concat(
    (store.get(KEYS.log) || []).map((r) => [r.fullName, r.section, r.question, new Date(r.submittedAt).toISOString()])
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
  a.download = "imgt211-attendance.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ---------- One-second tick ---------- */
function tick() {
  updateHero();
  const rec = store.get(KEYS.att);
  if (!modal.open || !rec || $("#viewLocked").hidden) return;
  const left = UNLOCK_DELAY_MS - (Date.now() - rec.submittedAt);
  if (left <= 0) renderModal();                       // auto-unlock the certificate
  else $("#lockClock").textContent = clock(left);
}
setInterval(tick, 1000);
updateHero();