(function () {
  var form = document.getElementById("submission-form");
  if (!form) return;
  var maxMb = parseFloat(form.dataset.maxMb) || 8;
  var maxBytes = maxMb * 1024 * 1024;
  var authors = [].slice.call(form.querySelectorAll(".author"));
  var addBtn = document.getElementById("add-author");
  var remBtn = document.getElementById("remove-author");
  var visible = 1;

  function setRequired(fs, on) {
    [].forEach.call(fs.querySelectorAll("[data-req]"), function (i) { i.required = on; });
  }
  function sync() {
    authors.forEach(function (fs, i) {
      var show = i < visible;
      fs.hidden = !show;
      setRequired(fs, show);
      [].forEach.call(fs.querySelectorAll("input"), function (i2) { i2.disabled = !show; });
    });
    addBtn.hidden = visible >= authors.length;
    remBtn.hidden = visible <= 1;
    var corr = form.querySelector('input[name="corresponding"]:checked');
    if (!corr || +corr.value > visible) {
      var first = form.querySelector('input[name="corresponding"][value="1"]');
      first.checked = true;
    }
    markEmail();
  }
  function markEmail() {
    var c = form.querySelector('input[name="corresponding"]:checked');
    authors.forEach(function (fs, i) {
      var em = fs.querySelector('[data-f="email"]');
      em.required = (i < visible) && c && +c.value === i + 1;
    });
  }
  addBtn.hidden = false;
  addBtn.addEventListener("click", function () { if (visible < authors.length) { visible++; sync(); authors[visible - 1].querySelector("input").focus(); } });
  remBtn.addEventListener("click", function () { if (visible > 1) { visible--; sync(); } });
  form.addEventListener("change", function (e) { if (e.target.name === "corresponding") markEmail(); });
  sync();

  // ---------- anonymity check ----------
  var report = document.getElementById("anon-report");
  var fileInput = document.getElementById("manuscript");
  var findings = [];

  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function names() {
    var out = [];
    authors.slice(0, visible).forEach(function (fs) {
      var g = fs.querySelector('[data-f="given"]').value.trim();
      var f = fs.querySelector('[data-f="family"]').value.trim();
      var em = fs.querySelector('[data-f="email"]').value.trim();
      var orc = fs.querySelector('[data-f="orcid"]').value.trim();
      if (f.length > 2) out.push({ label: "family name “" + f + "”", needle: norm(f) });
      if (g.length > 2 && f) out.push({ label: "name “" + g + " " + f + "”", needle: norm(g + " " + f) });
      if (em) out.push({ label: "email " + em, needle: norm(em) });
      if (orc) out.push({ label: "ORCID " + orc, needle: norm(orc) });
    });
    return out;
  }
  function show() {
    if (!findings.length) { report.hidden = true; return; }
    report.hidden = false;
    report.className = "anon-report anon-report--" + (findings.some(function (f) { return f.level === "warn"; }) ? "warn" : "ok");
    report.innerHTML = "";
    var p = document.createElement("p");
    p.className = "anon-report__title";
    p.textContent = "Automatic check of your file";
    report.appendChild(p);
    var ul = document.createElement("ul");
    findings.forEach(function (f) { var li = document.createElement("li"); li.textContent = f.text; ul.appendChild(li); });
    report.appendChild(ul);
    if (!fileInput.validationMessage) {
      var n = document.createElement("p");
      n.className = "note";
      n.textContent = "This check is only a help. You are responsible for removing identifying information. You can still submit.";
      report.appendChild(n);
    }
  }

  function u16(d, o) { return d[o] | (d[o + 1] << 8); }
  function u32(d, o) { return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0; }
  async function inflate(bytes) {
    var ds = new DecompressionStream("deflate-raw");
    var w = ds.writable.getWriter(); w.write(bytes); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  async function readZip(buf) {
    var d = new Uint8Array(buf), eocd = -1;
    for (var i = d.length - 22; i >= Math.max(0, d.length - 66000); i--) { if (u32(d, i) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error("not a zip");
    var n = u16(d, eocd + 10), off = u32(d, eocd + 16), files = {};
    for (var k = 0; k < n; k++) {
      if (u32(d, off) !== 0x02014b50) break;
      var method = u16(d, off + 10), csize = u32(d, off + 20), nl = u16(d, off + 28), el = u16(d, off + 30), cl = u16(d, off + 32), lh = u32(d, off + 42);
      var name = new TextDecoder().decode(d.subarray(off + 46, off + 46 + nl));
      files[name] = { method: method, csize: csize, lh: lh };
      off += 46 + nl + el + cl;
    }
    async function get(name) {
      var f = files[name]; if (!f) return null;
      var o = f.lh, ln = u16(d, o + 26), le = u16(d, o + 28), s = o + 30 + ln + le;
      var raw = d.subarray(s, s + f.csize);
      var out = f.method === 0 ? raw : await inflate(raw);
      return new TextDecoder().decode(out);
    }
    return { names: Object.keys(files), get: get };
  }
  function tag(xml, t) { var m = xml && xml.match(new RegExp("<" + t + "[^>]*>([^<]*)</" + t + ">")); return m ? m[1].trim() : ""; }
  function plain(xml) { return (xml || "").replace(/<w:tab\/>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }

  async function checkDocx(file) {
    var z = await readZip(await file.arrayBuffer());
    var core = await z.get("docProps/core.xml"), app = await z.get("docProps/app.xml");
    var creator = tag(core, "dc:creator"), last = tag(core, "cp:lastModifiedBy"), company = tag(app, "Company");
    if (creator) findings.push({ level: "warn", text: "File properties list an author: “" + creator + "”. In Word: File > Info > Check for Issues > Inspect Document > Remove Personal Information." });
    if (last && last !== creator) findings.push({ level: "warn", text: "File properties list “last modified by”: “" + last + "”." });
    if (company) findings.push({ level: "warn", text: "File properties list a company: “" + company + "”." });
    var text = await z.get("word/document.xml") || "";
    ["word/footnotes.xml", "word/endnotes.xml"].forEach(function () {});
    var parts = z.names.filter(function (n) { return /^word\/(header|footer|footnotes|endnotes|comments)\d*\.xml$/.test(n); });
    var all = plain(text);
    for (var i = 0; i < parts.length; i++) all += "\n" + plain(await z.get(parts[i]));
    if (z.names.indexOf("word/comments.xml") >= 0) findings.push({ level: "warn", text: "The file contains comments, which may show author names. Delete them before submitting." });
    if (/<w:(ins|del) [^>]*w:author=/.test(text)) findings.push({ level: "warn", text: "The file contains tracked changes with author names. Accept or reject them all." });
    return all;
  }
  async function checkPdf(file) {
    var buf = new Uint8Array(await file.arrayBuffer());
    var s = ""; for (var i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
    var m = s.match(/\/Author\s*\(([^)]*)\)/);
    if (m && m[1].trim()) findings.push({ level: "warn", text: "PDF properties list an author: “" + m[1].trim() + "”. Export again after clearing the author property." });
    // text is usually compressed in PDFs; only uncompressed text can be searched
    return s;
  }

  async function runCheck() {
    findings = []; form.anonymity_report.value = "";
    var file = fileInput.files[0];
    fileInput.setCustomValidity("");
    if (!file) { show(); return; }
    if (file.size > maxBytes) {
      fileInput.setCustomValidity("The file is larger than " + maxMb + " MB.");
      findings.push({ level: "warn", text: "The file is " + (file.size / 1048576).toFixed(1) + " MB and the limit is " + maxMb + " MB. Compress images, or send large files through the link field." });
      show(); fileInput.reportValidity(); return;
    }
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext !== "docx" && ext !== "pdf") {
      fileInput.setCustomValidity("Use a .docx or .pdf file.");
      findings.push({ level: "warn", text: "Only .docx and .pdf files are accepted." });
      show(); fileInput.reportValidity(); return;
    }
    var text = "";
    try { text = ext === "docx" ? await checkDocx(file) : await checkPdf(file); }
    catch (e) { findings.push({ level: "info", text: "The file could not be inspected automatically." }); }
    var hay = norm(text), seen = {};
    names().forEach(function (n) {
      if (n.needle && hay.indexOf(n.needle) >= 0 && !seen[n.label]) { seen[n.label] = 1; findings.push({ level: "warn", text: "The text contains your " + n.label + "." }); }
    });
    var fn = norm(file.name);
    names().forEach(function (n) { if (n.needle.indexOf("@") < 0 && fn.indexOf(n.needle) >= 0) findings.push({ level: "warn", text: "The file name contains “" + n.needle + "”. Rename the file." }); });
    if (/\backnowledg(e)?ments?\b/i.test(text)) findings.push({ level: "warn", text: "The text has an “Acknowledgements” section. Move it to the form field below." });
    if (!findings.length) findings.push({ level: "ok", text: "No author names or identifying properties found." });
    form.anonymity_report.value = findings.map(function (f) { return f.text; }).join(" | ");
    show();
  }
  fileInput.addEventListener("change", runCheck);
  form.addEventListener("input", function (e) { if (e.target.closest && e.target.closest(".author") && fileInput.files[0]) { clearTimeout(runCheck.t); runCheck.t = setTimeout(runCheck, 500); } });

  var supp = document.getElementById("supplementary");
  supp.addEventListener("change", function () {
    supp.setCustomValidity("");
    if (supp.files[0] && supp.files[0].size > maxBytes) { supp.setCustomValidity("The file is larger than " + maxMb + " MB."); supp.reportValidity(); }
  });

  form.addEventListener("submit", function (e) {
    var st = document.getElementById("form-status");
    if (!form.checkValidity()) return;
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; st.textContent = "Sending… please wait.";
  });
})();
