// ==UserScript==
// @name         Suave Auto-Send (Intercom)
// @namespace    https://perezabimael01-boop.github.io/suave/
// @version      1.0.0
// @description  One click from the Collection Agency Check page: opens Intercom and starts sending the reminders (same as 2 · Intercom Versturen).
// @match        https://app.intercom.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://perezabimael01-boop.github.io/suave/suave-autosend.user.js
// @downloadURL  https://perezabimael01-boop.github.io/suave/suave-autosend.user.js
// ==/UserScript==
// Generated from herinneringen.html (function intercomVersturen). Do not edit by hand.
(function(){
  "use strict";
  var KEY = "suave.autosend";
  // 1. Grab the list from the address (#suave-send=…) before Intercom changes the address.
  var m = location.hash.match(/suave-send=([^&]+)/);
  if (m){
    try { sessionStorage.setItem(KEY, m[1]); } catch(e){}
    try { history.replaceState(null, "", location.pathname + location.search); } catch(e){}
  }
  var raw = null; try { raw = sessionStorage.getItem(KEY); } catch(e){}
  if (!raw) return;

  function decode(b64){
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/"); while (b64.length % 4) b64 += "=";
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function intercomVersturen(){
    if (window.__icVersturen){ window.__icVersturen.show(); return; }
    if (!/(^|\.)intercom\.com$/.test(location.hostname)){ alert("Open eerst app.intercom.com en klik dan op 2 · Intercom Versturen."); return; }

    // ---- Suave's Intercom settings (from your workspace) ----
    const APP_ID = (location.pathname.match(/\/(?:apps|inbox)\/([a-z0-9]{6,})/) || [])[1] || "ka42edsc";
    const ADMIN_ID = 8698880;            // David — the teammate the messages come from
    const WA_INTEGRATION_ID = 6781;      // WhatsApp number Suave (+1 555 763 9010)
    const EMAIL_SENDER_ID = "398115";    // support@paywithsuave.com
    const TEMPLATES = [
      { min: 1,  max: 29,    key: "1_29days", label: "1–29 dagen",
        wa: "1_29days", params: p => ["Afl.", p.amount, p.first, String(p.days)],
        title: "Your payment is late",
        text: p => `Hi ${p.first} you missed your payment. It's now ${p.days} day past due.\n\nYou owe: Afl. ${p.amount}\n\nPlease pay today to keep your account in good standing.` },
      { min: 30, max: 59,    key: "30_59", label: "30–59 dagen",
        wa: "30_59days_past_template", params: p => [p.first, String(p.days), "Afl.", p.amount],
        title: "Your payment is past due",
        text: p => `Hi ${p.first}, your payment is ${p.days} days late.\n\nYou owe: Afl. ${p.amount}\n\nYou will be charged 25 FL every day for each late invoice. Please pay today to stop the late fees.` },
      { min: 60, max: 99999, key: "60plus", label: "60+ dagen",
        wa: "60_days_", params: p => [p.first, "Afl.", p.amount, String(p.days)],
        title: "Final notice: please pay now",
        text: p => `Hi ${p.first}, you owe Afl. ${p.amount}. Your payment is more than ${p.days} days late.\n\nWe have tried to reach you several times about this.\n\nPlease pay all late invoices within 14 days. Until you pay, you will be charged 25 FL every day for each late invoice.` },
      // Used only for lists from the Fraude Contacten page (never picked by days).
      { min: -2, max: -2, key: "fraude", label: "Fraude",
        wa: "collection_template", params: p => [p.first],
        title: "Important: Account Past Due",
        text: p => `Hi ${p.first},\n\nMy name is David from the Collections Department at Suave Solutions.\n\nThis is a formal notification that your account is significantly past due.${Number(p.amount) > 0 ? ` Your monthly payment is Afl. ${p.amount}.` : ""}\n\nTo prevent further administrative action, restrictions on your services, or referral to external agencies, please contact us immediately.` }
    ];

    const LS = "suaveIc.";
    const get = (k, d) => { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
    const put = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch(e){} };
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const S = { rows: [], log: get("log", {}), running: false, stop: false };

    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      .p{ position:fixed; top:0; right:0; z-index:2147483647; width:540px; max-width:100vw; height:100vh; background:#fff; color:#1d2a36;
          font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif; box-shadow:-8px 0 30px rgba(0,0,0,.18); display:flex; flex-direction:column; }
      .h{ display:flex; align-items:center; padding:12px 14px; background:#1F5F92; color:#fff; } .h b{ flex:1; font-size:15px; }
      .h button{ background:none; border:0; color:#fff; font-size:20px; cursor:pointer; }
      .b{ flex:1; overflow:auto; padding:12px 14px; }
      .row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .btn{ background:#1F5F92; color:#fff; border:0; border-radius:6px; padding:9px 14px; font:inherit; font-weight:600; cursor:pointer; }
      .btn.sec{ background:#eef3f6; color:#1d2a36; } .btn.red{ background:#c0392b; } .btn:disabled{ opacity:.5; cursor:default; }
      label.c{ display:flex; gap:6px; align-items:center; font-size:13.5px; }
      textarea{ width:100%; box-sizing:border-box; min-height:70px; margin-top:8px; font:12px monospace; border:1px solid #c9d3db; border-radius:6px; padding:6px; }
      .msg{ margin:10px 0; padding:8px 10px; border-radius:6px; background:#eef3f6; font-size:13px; }
      .msg.err{ background:#fdecea; color:#922; } .msg.good{ background:#e3f4f0; color:#1f6e60; }
      .muted{ color:#6b7884; font-size:12px; }
      table{ width:100%; border-collapse:collapse; font-size:13px; margin-top:8px; }
      th,td{ text-align:left; padding:5px 4px; border-bottom:1px solid #edf1f4; vertical-align:top; }
      th{ font-size:12px; color:#6b7884; font-weight:600; position:sticky; top:-12px; background:#fff; }
      td.r{ text-align:right; white-space:nowrap; } td.n{ cursor:pointer; color:#1f5f92; }
      .pill{ font-size:11.5px; padding:1px 7px; border-radius:999px; white-space:nowrap; }
      .b0{ background:#e3f4f0; color:#1f6e60; } .b1{ background:#fff3d6; color:#8a5a00; } .b2{ background:#fdecea; color:#922; } .b3{ background:#2b2f36; color:#fff; }
      .st{ font-size:12px; } .st.ok{ color:#1f6e60; } .st.err{ color:#c0392b; }
      .prev{ white-space:pre-wrap; background:#f7f9fa; border:1px solid #e3e8ec; border-radius:6px; padding:8px; margin-top:4px; font-size:12.5px; color:#1d2a36; }
      .f{ border-top:1px solid #e3e8ec; padding:10px 14px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; } .f .sp{ flex:1; }
    </style>
    <div class="p">
      <div class="h"><b>2 · Intercom Versturen</b><button id="x" title="Sluiten">×</button></div>
      <div class="b">
        <div class="row">
          <button class="btn" id="paste">Plak lijst</button>
          <label class="c"><input type="checkbox" id="test"> Testrun (niets versturen of wijzigen)</label>
        </div>
        <div class="muted" style="margin-top:6px">Plakken lukt niet? Plak de lijst hieronder met Ctrl+V.</div>
        <textarea id="manual" placeholder="Hier plakken (Ctrl+V)…"></textarea>
        <div id="info"></div>
        <div id="list"></div>
      </div>
      <div class="f">
        <span id="count" class="muted"></span><span class="sp"></span>
        <button class="btn sec" id="report" disabled>Rapport</button>
        <button class="btn red" id="stop" hidden>Stoppen</button>
        <button class="btn" id="send" disabled>Versturen</button>
      </div>
    </div>`;
    document.body.appendChild(host);
    const $ = id => root.getElementById(id);
    const info = (h, c) => { $("info").innerHTML = h ? `<div class="msg ${c || ""}">${h}</div>` : ""; };

    // ---------- Intercom (same requests the inbox itself makes) ----------
    const csrf = () => (document.querySelector("meta[name=csrf-token]") || {}).content || "";
    async function ic(method, path, body){
      const r = await fetch(path, { method, credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "X-CSRF-Token": csrf() },
        body: body ? JSON.stringify(body) : undefined });
      let j = null; try { j = await r.json(); } catch(e){}
      if (!r.ok){
        const m = j && (j.errors ? (j.errors[0] && (j.errors[0].message || j.errors[0])) : j.message);
        throw new Error("Intercom " + r.status + (m ? ": " + m : ""));
      }
      return j || {};
    }
    async function findContact(email){
      const j = await ic("POST", "/ember/users/search.json", { app_id: APP_ID,
        predicates: [{ attribute: "email", comparison: "eq", value: email, type: "string" }], page: 1, per_page: 5, include_count: false });
      return (j.users || [])[0] || null;
    }
    async function createContact(p){
      const j = await ic("POST", "/ember/users", { user_id: "", app_id: APP_ID, name: p.name || "", name_masked: false, role: "user_role",
        email: p.email, email_masked: false, phone: p.phone || "", phone_masked: false, whatsapp_number_masked: false,
        recent_page_views: [], user_event_summaries: [], segment_ids: [], taggings: [] });
      if (!j.user || !j.user.id) throw new Error("Intercom kon het contact niet aanmaken");
      return j.user;
    }
    async function setAttr(id, attr, value){
      return ic("PUT", "/ember/user_attributes/" + id, { app_id: APP_ID, id, attribute_identifier: attr, attribute_value: value, attribute_belongs_to_type: "user" });
    }
    const html = s => esc(s).replace(/\n/g, "<br />");
    function recipients(id){ return { to: { ids: [id], emails: [] }, cc: { ids: [], emails: [] }, bcc: { ids: [], emails: [] } }; }
    async function sendWhatsApp(id, t, p){
      return ic("POST", "/ember/users/send_support_conversation.json", {
        type: 115, admin_assignee_id: ADMIN_ID, team_assignee_id: 0, sender_id: String(ADMIN_ID), sender_type: 0,
        recipients: recipients(id), user_ids: [id],
        data: { whatsapp: { integration_id: WA_INTEGRATION_ID, template_name: t.wa, template_language: "en",
          template_components: [{ type: "body", parameters: t.params(p).map(text => ({ type: "text", text })) }] } },
        app_id: APP_ID,
        blocks: [{ type: "subheading", text: html(t.title) }, { type: "paragraph", text: html(t.text(p)), class: "no-margin" }]
      });
    }
    async function sendEmail(id, t, p){
      return ic("POST", "/ember/users/send_support_conversation.json", {
        type: 8, subject: t.title, admin_assignee_id: ADMIN_ID, team_assignee_id: 0, sender_id: EMAIL_SENDER_ID, sender_type: 3,
        recipients: recipients(id), user_ids: [id], app_id: APP_ID,
        blocks: t.text(p).split(/\n{2,}/).map(par => ({ type: "paragraph", text: html(par), class: "no-margin" }))
      });
    }
    function normPhone(raw){
      // Keep a number that already has a country code (+… or 00…); otherwise it is Aruban: add +297.
      const t = String(raw || "").trim();
      let d = t.replace(/\D/g, "");
      if (!d) return "";
      if (t.includes("+")) return "+" + d;
      if (d.startsWith("00")) return "+" + d.slice(2);
      if (d.startsWith("297") && d.length === 10) return "+" + d;
      return "+297" + d.replace(/^0+/, "");
    }

    // ---------- list ----------
    function tplOf(days){ return TEMPLATES.findIndex(t => days >= t.min && days <= t.max); }
    function recently(p){ const l = S.log[(p.user_id || p.email) + ":" + p.tpl]; return l && (Date.now() - new Date(l).getTime()) < 7 * 864e5; }
    function load(text){
      text = String(text || "").trim();
      if (!text.startsWith("SUAVE-HERINNERINGEN:")) { info("Dit is geen lijst van <b>1 · Suave Lijst</b>, de <b>Collection Agency Check</b> of de <b>Fraude Contacten</b>-pagina. Klik daar eerst op <b>Kopieer voor Intercom</b>.", "err"); return; }
      let data; try { data = JSON.parse(text.slice(20)); } catch(e){ info("De lijst is niet compleet gekopieerd. Probeer opnieuw.", "err"); return; }
      const fraud = data.kind === "fraude";
      S.rows = (data.rows || []).map(r => {
        const name = String(r.name || "").trim();
        const w = name.split(" ")[0] || "";
        const p = { ...r, first: w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "there", phone: normPhone(r.phone), status: "", open: false };
        p.email = String(p.email || "").trim().toLowerCase();
        // Fraud list amounts are entered in US$; messages use Aruban florin at 1.79.
        if (fraud){ p.usd = (Number(p.amount) || 0).toFixed(2); p.amount = ((Number(p.amount) || 0) * 1.79).toFixed(2); }
        else p.amount = (Number(p.amount) || 0).toFixed(2);
        p.days = Number(p.days) || 0;
        // A list from the Collection Agency Check page may ask for a specific template (e.g. the final notice).
        const forced = r.tpl ? TEMPLATES.findIndex(t => t.key === r.tpl) : -1;
        p.tpl = fraud ? TEMPLATES.findIndex(t => t.key === "fraude") : (forced >= 0 ? forced : tplOf(p.days));
        p.on = p.tpl >= 0 && !recently(p);
        return p;
      }).sort((a, b) => b.days - a.days);
      const age = data.at ? Math.round((Date.now() - new Date(data.at).getTime()) / 60000) : 0;
      S.rows = S.rows.filter(p => p.email);
      info(`${S.rows.length} ${fraud ? "fraude-contacten" : "klanten"} geladen${age > 60 ? ` (lijst is ${Math.round(age / 60)} uur oud — haal hem liever opnieuw op)` : ""}.`, age > 60 ? "" : "good");
      $("manual").value = "";
      render();
    }
    $("paste").addEventListener("click", async () => {
      try { load(await navigator.clipboard.readText()); }
      catch(e){ info("Chrome liet plakken niet toe. Plak de lijst in het vak hieronder met Ctrl+V.", "err"); $("manual").focus(); }
    });
    $("manual").addEventListener("paste", e => { setTimeout(() => load($("manual").value), 0); });
    $("manual").addEventListener("change", () => { if ($("manual").value.trim()) load($("manual").value); });

    function render(){
      const rows = S.rows;
      $("list").innerHTML = !rows.length ? "" : `<table>
        <thead><tr><th><input type="checkbox" id="all"></th><th>Naam</th><th class="r">Dagen</th><th class="r">Afl.</th><th>Template</th><th></th></tr></thead>
        <tbody>${rows.map((p, i) => { const t = TEMPLATES[p.tpl]; return `<tr>
          <td><input type="checkbox" data-on="${i}" ${p.on ? "checked" : ""} ${p.tpl < 0 ? "disabled" : ""}></td>
          <td class="n" data-open="${i}">${esc(p.name || p.email)}<div class="muted">${esc(p.email)} · ${esc(p.phone || "geen telefoon → e-mail")}${recently(p) ? " · al gestuurd deze week" : ""}</div>
            ${p.open && t ? `<div class="prev"><b>${esc(t.title)}</b>\n\n${esc(t.text(p))}</div>` : ""}</td>
          <td class="r">${t && t.key === "fraude" ? "–" : p.days}</td><td class="r">${esc(p.amount)}${p.usd ? `<div class="muted">$${esc(p.usd)}</div>` : ""}</td>
          <td>${t ? `<span class="pill b${p.tpl}">${esc(t.label)}</span>` : `<span class="muted">geen</span>`}</td>
          <td class="st ${/^(WhatsApp|E-mail|Test)/.test(p.status) ? "ok" : p.status ? "err" : ""}">${esc(p.status)}</td></tr>`; }).join("")}</tbody></table>`;
      root.querySelectorAll("[data-on]").forEach(el => el.addEventListener("change", () => { S.rows[+el.dataset.on].on = el.checked; count(); }));
      root.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => { const p = S.rows[+el.dataset.open]; p.open = !p.open; render(); }));
      const all = $("all"); if (all) all.addEventListener("change", e => { S.rows.forEach(p => { if (p.tpl >= 0) p.on = e.target.checked; }); render(); });
      count();
    }
    const selected = () => S.rows.filter(p => p.on && p.tpl >= 0);
    function count(){
      const n = selected().length;
      $("count").textContent = S.rows.length ? `${n} van ${S.rows.length} geselecteerd` : "";
      $("send").disabled = S.running || !n;
      $("send").textContent = $("test").checked ? `Testrun (${n})` : `Versturen (${n})`;
      $("report").disabled = !S.rows.length;
    }
    $("test").addEventListener("change", count);

    // ---------- send ----------
    $("send").addEventListener("click", async () => {
      const list = selected(), test = $("test").checked;
      if (!list.length) return;
      // Auto-send from the Collection Agency Check page: the user already confirmed there.
      const pre = S.autoConfirmed; S.autoConfirmed = false;
      if (!test && !pre && !confirm(`${list.length} klanten een herinnering sturen via Intercom (WhatsApp, of e-mail als dat niet kan)?`)) return;
      S.running = true; S.stop = false; $("stop").hidden = false; $("paste").disabled = true; count();
      let wa = 0, em = 0, bad = 0;
      for (const p of list){
        if (S.stop) break;
        const t = TEMPLATES[p.tpl];
        p.status = "Bezig…"; render();
        try {
          let c = await findContact(p.email);
          const notes = [];
          if (!c){
            if (test){ p.status = `Test: nieuw contact aanmaken, daarna ${t.key === "fraude" ? (p.phone ? "WhatsApp " + t.wa + " + e-mail" : "e-mail") : (p.phone ? "WhatsApp " + t.wa : "e-mail")}`; wa++; render(); continue; }
            c = await createContact(p); c._new = true; notes.push("nieuw contact");
          }
          if (!c._new && !c.name && p.name){ if (!test) await setAttr(c.id, "name", p.name); notes.push("naam"); }
          let phone = c.whatsapp_number || c.phone || "";
          if (!c._new && !c.phone && p.phone){ if (!test) await setAttr(c.id, "phone", p.phone); phone = p.phone; notes.push("telefoon"); }
          const added = notes.length ? ` (${notes.join(", ")}${c._new ? "" : " ingevuld"})` : "";
          if (test){ p.status = `Test: ${t.key === "fraude" ? (phone ? "WhatsApp " + t.wa + " + e-mail" : "e-mail") : (phone ? "WhatsApp " + t.wa : "e-mail")}${added}`; wa++; render(); continue; }
          let how = "";
          if (t.key === "fraude"){
            // Fraud users get both: the collection_template on WhatsApp (if there is a phone) and an email.
            const parts = [];
            if (phone){
              try { await sendWhatsApp(c.id, t, p); parts.push("WhatsApp"); wa++; }
              catch(e){ parts.push("WhatsApp mislukt (" + e.message + ")"); }
              await sleep(500);
            }
            await sendEmail(c.id, t, p); parts.push("e-mail"); em++;
            how = parts.join(" + ");
          } else if (phone){
            try { await sendWhatsApp(c.id, t, p); how = "WhatsApp"; wa++; }
            catch(e){ await sleep(500); await sendEmail(c.id, t, p); how = "E-mail (WhatsApp mislukt: " + e.message + ")"; em++; }
          } else { await sendEmail(c.id, t, p); how = "E-mail (geen telefoon)"; em++; }
          p.status = how + added; p.on = false;
          S.log[(p.user_id || p.email) + ":" + p.tpl] = new Date().toISOString(); put("log", S.log);
        } catch (e){ p.status = "Fout: " + (e.message || e); bad++; }
        render(); await sleep(1200);
      }
      S.running = false; $("stop").hidden = true; $("paste").disabled = false;
      info(test ? `Testrun klaar: ${wa} klanten zouden een bericht krijgen. Vink Testrun uit om echt te sturen.`
                : `Klaar: ${wa} via WhatsApp, ${em} via e-mail${bad ? ", " + bad + " niet gelukt" : ""}${S.stop ? " (gestopt)" : ""}.`, bad ? "err" : "good");
      count();
    });
    $("stop").addEventListener("click", () => { S.stop = true; });

    $("report").addEventListener("click", () => {
      const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      const lines = [["Naam","E-mail","Telefoon","User ID","Dagen te laat","Bedrag (Afl.)","Vervaldatum","Template","Resultaat"].map(q).join(";")]
        .concat(S.rows.map(p => [p.name, p.email, p.phone, p.user_id, p.days, String(p.amount).replace(".", ","), p.due, TEMPLATES[p.tpl] ? TEMPLATES[p.tpl].wa : "", p.status].map(q).join(";")));
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "herinneringen-" + new Date().toISOString().slice(0, 10) + ".csv"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

    $("x").addEventListener("click", () => { host.style.display = "none"; });
    window.__icVersturen = { show(){ host.style.display = ""; },
      // Used by the "Suave Auto-Send" add-on: load a list and start sending right away.
      auto(text, confirmed){ host.style.display = ""; $("test").checked = false; load(text); S.autoConfirmed = !!confirmed;
        if (selected().length) setTimeout(() => $("send").click(), 400); else info("Niemand om te versturen (iedereen kreeg deze week al hetzelfde bericht).", "good"); } };
  }

  // 2. Wait until Intercom is loaded and logged in, then open the panel and start sending.
  var tries = 0;
  var timer = setInterval(function(){
    tries++;
    var ready = document.body && document.querySelector("meta[name=csrf-token]") && /\/a\/apps\/[a-z0-9]{6,}/.test(location.pathname);
    if (!ready && tries < 120) return;
    clearInterval(timer);
    try { sessionStorage.removeItem(KEY); } catch(e){}
    if (!ready){ alert("Suave Auto-Send: Intercom did not finish loading (are you logged in?). Open the Agency Check page and press the button again."); return; }
    var payload; try { payload = JSON.parse(decode(raw)); } catch(e){ alert("Suave Auto-Send: the list could not be read."); return; }
    setTimeout(function(){
      intercomVersturen();
      window.__icVersturen.auto("SUAVE-HERINNERINGEN:" + JSON.stringify(payload.list), payload.confirmed);
    }, 1500);
  }, 500);
})();
