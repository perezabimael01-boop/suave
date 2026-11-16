/* Pip — a small friendly computer mascot that lives in the bottom-left corner.
   Eyes follow the mouse, blinks, waves, reacts to the cards you hover and gives tips.
   Include on any page with: <script src="buddy.js"></script>  */
(function () {
  if (window.__pipLoaded) return; window.__pipLoaded = true;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = `
  .pip{ position:fixed; left:20px; bottom:20px; z-index:60; display:flex; align-items:flex-end; gap:10px; font-family:var(--font, system-ui, sans-serif); }
  .pip-body{ width:76px; height:84px; cursor:pointer; border:0; padding:0; background:none; position:relative; transform-origin:50% 100%; }
  .pip-body:focus-visible{ outline:3px solid var(--accent,#F2B33D); outline-offset:4px; border-radius:14px; }
  .pip svg{ display:block; width:100%; height:100%; overflow:visible; }
  .pip-idle{ animation:pip-bob 3.2s ease-in-out infinite; }
  .pip-jump{ animation:pip-jump .6s cubic-bezier(.3,1.6,.5,1); }
  .pip-spin{ animation:pip-spin .8s ease-in-out; }
  .pip-wave .pip-arm{ animation:pip-wave .5s ease-in-out 3; transform-origin:62px 58px; }
  .pip-eye{ transition:transform .08s linear; }
  .pip-lids{ transform-origin:38px 34px; transform:scaleY(0); }
  .pip-blink .pip-lids{ animation:pip-blink .18s ease-in-out; }
  .pip-mouth{ transition:d .2s; }
  .pip-bubble{ max-width:240px; background:#fff; color:#16202A; border:1px solid #D2DBE2; border-radius:14px 14px 14px 4px;
    padding:10px 14px; font-size:14px; line-height:1.45; box-shadow:0 10px 24px -10px rgba(16,32,52,.35);
    margin-bottom:56px; opacity:0; transform:translateY(6px) scale(.96); transform-origin:0 100%;
    transition:opacity .2s ease, transform .2s ease; pointer-events:none; }
  .pip-bubble.on{ opacity:1; transform:none; pointer-events:auto; }
  .pip-close{ position:absolute; left:58px; top:-4px; width:22px; height:22px; border-radius:50%; border:1px solid #D2DBE2; background:#fff;
    color:#4E5B68; font-size:13px; line-height:1; cursor:pointer; opacity:0; transition:opacity .15s; }
  .pip:hover .pip-close, .pip-close:focus-visible{ opacity:1; }
  .pip-wake{ position:fixed; left:16px; bottom:16px; z-index:60; width:40px; height:40px; border-radius:12px; border:1px solid #D2DBE2;
    background:#fff; cursor:pointer; box-shadow:0 4px 12px -4px rgba(16,32,52,.3); font-size:18px; }
  .pip-heart{ position:fixed; z-index:61; pointer-events:none; font-size:18px; animation:pip-float 1s ease-out forwards; }
  @keyframes pip-bob{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-5px) } }
  @keyframes pip-jump{ 0%{ transform:translateY(0) scale(1,1) } 25%{ transform:translateY(0) scale(1.12,.86) } 55%{ transform:translateY(-26px) scale(.94,1.08) } 100%{ transform:translateY(0) scale(1) } }
  @keyframes pip-spin{ to{ transform:rotate(360deg) } }
  @keyframes pip-wave{ 0%,100%{ transform:rotate(0) } 50%{ transform:rotate(-35deg) } }
  @keyframes pip-blink{ 0%,100%{ transform:scaleY(0) } 50%{ transform:scaleY(1) } }
  @keyframes pip-float{ to{ transform:translateY(-60px) scale(1.4); opacity:0 } }
  @media (max-width:640px){ .pip{ left:12px; bottom:12px } .pip-body{ width:60px; height:66px } .pip-bubble{ max-width:190px; font-size:13px; margin-bottom:44px } }
  @media print{ .pip, .pip-wake{ display:none !important } }
  `;
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var SMILE = 'M30 50 Q38 57 46 50', OPEN = 'M30 49 Q38 61 46 49 Z', FLAT = 'M31 52 L45 52';
  var svg = `
  <svg viewBox="0 0 76 84" aria-hidden="true">
    <ellipse cx="38" cy="81" rx="22" ry="3" fill="rgba(16,32,52,.15)"/>
    <rect x="31" y="66" width="14" height="8" fill="#B4C1CC"/>
    <rect x="22" y="73" width="32" height="6" rx="3" fill="#8C9BA8"/>
    <g class="pip-arm"><path d="M62 58 L70 50" stroke="#7A1222" stroke-width="5" stroke-linecap="round"/><circle cx="71" cy="49" r="4" fill="#F2B33D"/></g>
    <path d="M14 58 L7 64" stroke="#7A1222" stroke-width="5" stroke-linecap="round"/>
    <rect x="8" y="10" width="60" height="58" rx="12" fill="#7A1222"/>
    <rect x="14" y="16" width="48" height="44" rx="8" fill="#F6A5B1"/>
    <circle cx="20" cy="47" r="4" fill="#F2B33D" opacity=".55"/><circle cx="56" cy="47" r="4" fill="#F2B33D" opacity=".55"/>
    <g><circle cx="29" cy="34" r="7" fill="#fff"/><circle class="pip-eye" cx="29" cy="34" r="3.4" fill="#7A1222"/></g>
    <g><circle cx="47" cy="34" r="7" fill="#fff"/><circle class="pip-eye" cx="47" cy="34" r="3.4" fill="#7A1222"/></g>
    <g class="pip-lids"><rect x="21" y="26" width="16" height="16" rx="8" fill="#F6A5B1"/><rect x="39" y="26" width="16" height="16" rx="8" fill="#F6A5B1"/></g>
    <path class="pip-mouth" d="${SMILE}" stroke="#7A1222" stroke-width="3" stroke-linecap="round" fill="#7A1222" fill-opacity="0"/>
    <path d="M38 10 L38 3" stroke="#7A1222" stroke-width="3" stroke-linecap="round"/><circle class="pip-light" cx="38" cy="3" r="3.5" fill="#F2B33D"/>
  </svg>`;

  var root = document.createElement('div'); root.className = 'pip';
  root.innerHTML = '<button class="pip-body pip-idle" type="button" aria-label="Pip, je hulpje. Klik voor een tip.">' + svg +
    '</button><button class="pip-close" type="button" aria-label="Pip verbergen">×</button><div class="pip-bubble" role="status" aria-live="polite"></div>';
  var wake = document.createElement('button'); wake.className = 'pip-wake'; wake.type = 'button';
  wake.setAttribute('aria-label', 'Pip terughalen'); wake.textContent = '👋';

  var body = root.querySelector('.pip-body'), bubble = root.querySelector('.pip-bubble');
  var eyes = root.querySelectorAll('.pip-eye'), mouth = root.querySelector('.pip-mouth');

  function mount() {
    if (store.get('pip-hidden') === '1') { document.body.appendChild(wake); }
    else { document.body.appendChild(root); greet(); }
  }

  /* ----- talking ----- */
  var hideT;
  function say(text, ms, face) {
    bubble.textContent = text; bubble.classList.add('on');
    setMouth(face || OPEN); setTimeout(function () { setMouth(SMILE); }, 900);
    clearTimeout(hideT); hideT = setTimeout(function () { bubble.classList.remove('on'); }, ms || 4200);
  }
  function setMouth(d) { mouth.setAttribute('d', d); mouth.setAttribute('fill-opacity', d === OPEN ? 1 : 0); }
  function play(cls, ms) {
    if (reduce) return;
    body.classList.remove('pip-idle'); body.classList.add(cls);
    setTimeout(function () { body.classList.remove(cls); body.classList.add('pip-idle'); }, ms);
  }

  function greet() {
    var h = new Date().getHours();
    var hi = h < 6 ? 'Nog wakker? 🌙' : h < 12 ? 'Goedemorgen! ☀️' : h < 18 ? 'Goedemiddag! 👋' : 'Goedenavond! 🌆';
    setTimeout(function () { root.classList.add('pip-wave'); say(hi + ' Ik ben Pip. Klik op me voor een tip.', 5000); }, 700);
    setTimeout(function () { root.classList.remove('pip-wave'); }, 2400);
  }

  var tips = [
    'Tip: druk op 1 t/m 6 om meteen een document te openen.',
    'Je ziet altijd eerst een voorbeeld voordat je iets downloadt. 👀',
    'Vanuit het Customer Statement open je lease, final notice en factoring al ingevuld.',
    'Factoring maakt één Invoice of Sale per factuur, elk met eigen datum.',
    'Het deurwaardersrapport? Betalingen boeken zet het in één keer in Suave.',
    'Dubbelklik op mij als je je verveelt. 😄',
    'Hulp nodig? Rechtsonder zit de Hulp-knop.'
  ], tipI = Math.floor(Math.random() * tips.length);

  var clicks = 0, clickT;
  body.addEventListener('click', function () {
    clicks++; clearTimeout(clickT); clickT = setTimeout(function () { clicks = 0; }, 1500);
    if (clicks >= 5) { clicks = 0; play('pip-spin', 800); say('Wieee! Ik word duizelig… 😵‍💫', 3000); hearts(6); return; }
    play('pip-jump', 600); hearts(1);
    say(tips[tipI++ % tips.length]);
  });
  body.addEventListener('dblclick', function () { play('pip-spin', 800); say('Ta-da! 🎉', 2000); hearts(4); });

  function hearts(n) {
    if (reduce) return;
    var r = body.getBoundingClientRect(), icons = ['💙', '🧡', '✨', '⭐'];
    for (var i = 0; i < n; i++) (function (i) {
      setTimeout(function () {
        var s = document.createElement('span'); s.className = 'pip-heart';
        s.textContent = icons[Math.floor(Math.random() * icons.length)];
        s.style.left = (r.left + 20 + Math.random() * 36) + 'px'; s.style.top = (r.top + 4) + 'px';
        document.body.appendChild(s); setTimeout(function () { s.remove(); }, 1000);
      }, i * 110);
    })(i);
  }

  root.querySelector('.pip-close').addEventListener('click', function () {
    say('Oké, tot later! 👋', 1200);
    setTimeout(function () { root.remove(); document.body.appendChild(wake); store.set('pip-hidden', '1'); }, 900);
  });
  wake.addEventListener('click', function () { wake.remove(); store.set('pip-hidden', '0'); document.body.appendChild(root); greet(); });

  /* ----- eyes follow the mouse ----- */
  var raf;
  document.addEventListener('mousemove', function (e) {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var r = body.getBoundingClientRect(); if (!r.width) return;
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * .4);
      var a = Math.atan2(dy, dx), d = Math.min(3.2, Math.hypot(dx, dy) / 60);
      var t = 'translate(' + (Math.cos(a) * d).toFixed(2) + 'px,' + (Math.sin(a) * d).toFixed(2) + 'px)';
      eyes.forEach(function (el) { el.style.transform = t; });
    });
  });

  /* ----- blink ----- */
  (function blink() {
    setTimeout(function () { root.classList.add('pip-blink'); setTimeout(function () { root.classList.remove('pip-blink'); }, 200); blink(); }, 2500 + Math.random() * 3500);
  })();

  /* ----- react to the document cards ----- */
  var lines = {
    statement: 'Customer Statement: hét startpunt per klant. 📊',
    notice: 'Final Notice: de laatste herinnering. Streng maar netjes. ✉️',
    claim: 'Bevel tot Betaling: het verzoekschrift voor het Gerecht. ⚖️',
    lease: 'Lease Contract: huur met koopoptie, alles automatisch ingevuld. 💻',
    factoring: 'Factoring: facturen verkopen aan Suave Solutions. 📄',
    payments: 'Betalingen boeken: scheelt je een hoop typwerk! 💸'
  };
  var lastTool, hoverT;
  document.addEventListener('mouseover', function (e) {
    var card = e.target.closest && e.target.closest('a.tool[data-tool]');
    if (!card || !root.isConnected) return;
    var k = card.getAttribute('data-tool'); if (k === lastTool) return; lastTool = k;
    clearTimeout(hoverT); hoverT = setTimeout(function () { if (lines[k]) say(lines[k], 3000, SMILE); }, 350);
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest && e.target.closest('a.tool') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('a.tool'))) { lastTool = null; clearTimeout(hoverT); }
  });

  /* ----- celebrate downloads / primary actions on the form pages ----- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.btn-primary, [download]');
    if (!b || !root.isConnected) return;
    setTimeout(function () { play('pip-jump', 600); hearts(5); say(['Lekker bezig! 🎉', 'Klaar is Kees! ✅', 'Top, die staat! 🙌'][Math.floor(Math.random() * 3)], 2500); }, 150);
  });

  /* ----- get sleepy when idle ----- */
  var idleT;
  function resetIdle() {
    clearTimeout(idleT);
    idleT = setTimeout(function () { if (root.isConnected) { setMouth(FLAT); say('Zzz… 💤', 3000, FLAT); } }, 90000);
  }
  ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, resetIdle, { passive: true }); });
  resetIdle();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
