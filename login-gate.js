// Login gate for the private Suave tools (Fraud Contacts, Agency Check).
// Include in <head>:  <script src="login-gate.js"></script>
// The page stays hidden until the password is checked by Suave's Cloudflare Worker.
// The password is the same one the Worker uses (FRAUDE_KEY); it is remembered in this browser.
(function(){
  var WORKER = "https://suave-fraude.perezabimael01.workers.dev";
  var CONN_KEY = "suave.fraude.conn";
  var root = document.documentElement;
  root.classList.add("locked");
  var css = document.createElement("style");
  css.textContent =
    "html.locked main, html.locked .help-chat, html.locked #suave-help{ visibility:hidden !important; }" +
    ".gate{ position:fixed; inset:0; z-index:2147483000; display:grid; place-items:center; padding:16px; background:linear-gradient(#347AF0 0%, #347AF0 40%, #C2D0E8 75%, #F2E9D8 100%); font-family:Montserrat, 'IBM Plex Sans', system-ui, sans-serif; }" +
    ".gate-box{ width:min(400px,100%); background:#fff; border-radius:16px; padding:32px 28px 26px; box-shadow:0 30px 60px -30px rgba(20,40,80,.55); text-align:center; box-sizing:border-box; }" +
    ".gate-box h1{ margin:14px 0 4px; font-size:21px; font-weight:700; color:#2C2C2C; } .gate-box p{ margin:0 0 20px; color:#626262; font-size:14px; line-height:1.5; }" +
    ".gate-box input{ width:100%; box-sizing:border-box; padding:12px 14px; border:1px solid #D8DEE8; border-radius:8px; font:inherit; font-size:15px; outline:none; }" +
    ".gate-box input:focus{ border-color:#347AF0; box-shadow:0 0 0 3px rgba(52,122,240,.18); }" +
    ".gate-box button{ width:100%; margin-top:12px; padding:12px; border:0; border-radius:8px; background:#347AF0; color:#fff; font:inherit; font-weight:600; font-size:15px; cursor:pointer; box-shadow:0 8px 25px -8px #347AF0; }" +
    ".gate-box button:disabled{ opacity:.6; cursor:default; } .gate-err{ min-height:20px; margin-top:10px; font-size:13.5px; color:#B42318; }" +
    ".gate-back{ display:inline-block; margin-top:14px; font-size:13.5px; color:#347AF0; text-decoration:none; }" +
    ".gate-logout{ font:600 13.5px Montserrat, system-ui, sans-serif; color:#347AF0; background:#EEF4FE; border:0; border-radius:999px; padding:7px 14px; cursor:pointer; margin-left:auto; margin-right:12px; }";
  document.head.appendChild(css);

  function getConn(){ try { return JSON.parse(localStorage.getItem(CONN_KEY) || "{}"); } catch(e){ return {}; } }
  function setConn(c){ try { localStorage.setItem(CONN_KEY, JSON.stringify(c)); } catch(e){} }
  function check(key){
    return fetch(WORKER + "/auth", { headers: { "X-Fraude-Key": key }, cache: "no-store" })
      .then(function(r){ return r.status === 200 ? "ok" : (r.status === 401 ? "wrong" : "error"); })
      .catch(function(){ return "offline"; });
  }
  function unlock(){
    root.classList.remove("locked");
    var g = document.getElementById("suave-gate"); if (g) g.remove();
    var bar = document.querySelector(".app-bar-inner");
    if (bar && !document.getElementById("gate-logout")){
      var b = document.createElement("button"); b.id = "gate-logout"; b.className = "gate-logout"; b.type = "button"; b.textContent = "Log out";
      b.onclick = function(){ var c = getConn(); c.key = ""; setConn(c); location.reload(); };
      var brand = bar.querySelector(".app-brand"); bar.insertBefore(b, brand || null);
    }
  }
  function showGate(msg){
    if (document.getElementById("suave-gate")) { document.getElementById("gate-err").textContent = msg || ""; return; }
    var g = document.createElement("div"); g.className = "gate"; g.id = "suave-gate";
    g.innerHTML = '<form class="gate-box" autocomplete="on">' +
      '<svg viewBox="0 0 990 193" height="30" fill="#347AF0" aria-label="Suave"><path d="M0 186.1V122.7H47.1C47.1 127.4 48.6 131.3 51.5 134.4C54.5 137.4 57.9 139.8 61.9 141.6C65.9 143.3 70 144.6 74.2 145.3C78.4 146 81.8 146.3 84.4 146.3C87.9 146.3 91.4 145.5 94.8 144C98.2 142.5 99.9 139.3 99.9 134.4C99.9 131.1 97.5 128.4 92.7 126.4C87.9 124.4 81.8 122.5 74.4 120.6C67 118.8 59.1 116.5 50.6 114C42.2 111.4 34.3 107.8 26.9 103.2C19.5 98.7 13.4 92.7 8.6 85.3C3.8 77.9 1.4 68.5 1.4 57C1.4 48.1 3.5 40.4 7.6 33.9C11.7 27.5 16.8 22.2 23 18.1C29.3 14 35.9 11 43.1 9C50.2 7 57 6 63.3 6C75.3 6 86.1 8.7 95.7 14.1C105.3 19.5 112 25.9 115.7 33.4L118.5 10.2H161.8V73.5H116.1C116.1 69.8 115 66.3 112.9 63.1C110.8 60 108 57.2 104.6 54.7C101.2 52.2 97.4 50.3 93.2 48.9C89 47.5 84.6 46.8 80.2 46.8C76.4 46.8 73.2 47.8 70.5 49.8C67.8 51.8 66.5 55 66.5 59.4C66.5 63.4 68.9 66.6 73.9 68.9C78.8 71.3 84.9 73.6 92.3 75.8C99.7 78 107.7 80.5 116.4 83.2C125.1 85.9 133.1 89.5 140.5 93.9C147.9 98.4 154 104 159 111C163.9 117.9 166.4 126.7 166.4 137.5C166.4 145.7 164.5 153.1 160.9 159.7C157.3 166.2 152.5 171.8 146.5 176.4C140.5 181 133.5 184.4 125.6 186.8C117.6 189.1 109.4 190.3 100.9 190.3C88.3 190.3 77.2 187.7 67.7 182.5C58.2 177.4 51.3 171.4 47.1 164.6L44 186.1H0Z"/><path d="M178.7 10.2H263.8V95C263.8 110.2 265.1 121.4 267.8 128.5C270.5 135.7 275.5 139.3 282.8 139.3C288.9 139.3 294.1 136.8 298.4 131.9C302.8 127 304.9 120.5 304.9 112.5V56.6H281.7V10.2H372.8V139.3H390V186.1H323.6L314.1 163.9C312.2 166 309.9 168.6 307.2 171.8C304.5 175 301.2 178 297.4 180.8C293.5 183.6 288.9 186 283.5 188C278.1 190 271.6 191 264.1 191C250.8 191 239.6 189.2 230.5 185.7C221.5 182.2 214.2 176.9 208.7 169.9C203.2 162.8 199.3 153.9 197 143.1C194.6 132.4 193.4 119.7 193.4 105.2V56.6H178.7V10.2Z"/><path d="M408 25C411.5 22.9 416 20.4 421.3 17.6C426.7 14.8 432.8 12 439.5 9.3C446.1 6.6 453.3 4.4 460.9 2.6C468.5 0.9 476.4 0 484.7 0C495.2 0 506.1 1.1 517.4 3.3C528.6 5.6 538.9 9.4 548.1 14.9C557.4 20.5 565 27.9 571 37.3C577 46.7 580 58.4 580 72.5V141H601.1V186.1H525.8L517.4 170.2C514.1 174.7 510.4 178.4 506.3 181.3C502.2 184.2 498 186.5 493.6 188.2C489.3 189.8 485 191 480.8 191.7C476.6 192.4 472.9 192.7 469.9 192.7C461.4 192.7 453.1 191.6 444.9 189.2C436.7 186.9 429.3 183.4 422.8 178.7C416.2 174 410.9 167.9 406.7 160.6C402.6 153.2 400.6 144.3 400.6 134C400.6 124.2 402.5 115.2 406.4 107.3C410.3 99.3 415.5 92.5 422.2 86.9C428.9 81.2 436.7 76.9 445.6 73.9C454.5 70.8 463.9 69.3 473.8 69.3C478.9 69.3 483.5 69.8 487.6 70.9C491.7 71.9 495.3 73.2 498.2 74.6C501.1 76 503.5 77.4 505.2 78.8C507 80.2 508.1 81.1 508.6 81.6V69.3C508.6 61.3 505.4 56 499.1 53.5C492.7 50.9 484.8 49.6 475.2 49.6C464.6 49.6 454.9 51.3 446.1 54.9C437.3 58.4 429.6 62 422.8 65.8L408 25ZM486.1 147C491.5 147 496.1 145.7 500.1 143.1C504.1 140.6 506.9 138 508.6 135.4V122C508.3 121.6 507.8 120.8 507 119.8C506.2 118.7 504.9 117.6 503.3 116.4C501.7 115.2 499.6 114.2 497.1 113.3C494.7 112.3 491.6 111.8 487.8 111.8C480.8 111.8 475.6 113.6 472.3 117.1C469.1 120.6 467.4 125.1 467.4 130.5C467.4 135.4 469.2 139.4 472.7 142.4C476.2 145.5 480.7 147 486.1 147Z"/><path d="M705.1 129.1C705.1 127.2 705.4 124.8 706 121.9C706.6 118.9 707.3 115.7 708.3 112.2C709.2 108.7 710.3 105 711.6 101.3C712.9 97.5 714.3 93.9 715.7 90.4L732.5 54.9H713.9V10.2H804.6V54.9H786.4L725.5 186.1H671L605.6 54.9H589V10.2H696V54.9H678.4L694.6 92.1C696.9 98.9 698.9 105.9 700.5 112.9C702.2 119.9 703.2 125.3 703.7 129.1H705.1Z"/><path d="M990 161.8C976.9 173 963 181 948.5 185.5C934 190.1 917.5 192.4 899.3 192.4C888.2 192.4 877.2 190.6 866.2 186.9C855.2 183.3 845.3 177.7 836.5 170.1C827.7 162.4 820.5 152.6 814.8 140.5C809.2 128.4 806.4 114 806.4 97.1C806.4 82.8 808.9 69.9 813.8 58.6C818.7 47.2 825.4 37.5 833.8 29.5C842.3 21.6 852.2 15.5 863.7 11.4C875.2 7.3 887.7 5.3 901 5.3C915.6 5.3 928.4 7.4 939.5 11.6C950.7 15.8 960 21.7 967.5 29.2C975 36.7 980.6 45.5 984.4 55.7C988.1 65.9 990 77 990 89C990 93.7 989.6 98.3 988.9 102.9C988.2 107.4 987.2 111.7 985.8 115.7H875C875.5 118.1 876.2 120.9 877.3 124.2C878.3 127.4 880.1 130.6 882.7 133.6C885.3 136.7 888.8 139.3 893.3 141.4C897.7 143.5 903.7 144.6 911.2 144.6C914.3 144.6 917.6 144.4 921.2 144.2C924.9 144 928.8 143.3 933 142.1C937.2 140.9 941.7 139.2 946.4 137C951.1 134.8 955.8 131.7 960.5 127.7L990 161.8ZM903.1 52.8C897.7 52.8 893.3 53.8 889.9 55.9C886.5 58 883.8 60.6 881.8 63.5C879.9 66.4 878.5 69.5 877.6 72.8C876.8 76.1 876.3 78.8 876 80.9H929.2C929.2 77.6 928.8 74.3 928.1 70.9C927.4 67.5 926.2 64.4 924.4 61.7C922.6 59 920.1 56.9 916.7 55.2C913.3 53.6 908.8 52.8 903.1 52.8Z"/></svg>' +
      '<h1>Log in</h1><p>This page is private. Enter the Suave tools password to continue.</p>' +
      '<input type="text" name="username" value="suave-tools" autocomplete="username" hidden>' +
      '<input type="password" id="gate-key" name="password" autocomplete="current-password" placeholder="Password" required>' +
      '<button type="submit" id="gate-btn">Log in</button><div class="gate-err" id="gate-err" role="alert"></div>' +
      '<a class="gate-back" href="index.html">← Back to all tools</a></form>';
    (document.body || root).appendChild(g);
    document.getElementById("gate-err").textContent = msg || "";
    var f = g.querySelector("form"), input = document.getElementById("gate-key"), btn = document.getElementById("gate-btn");
    setTimeout(function(){ input.focus(); }, 50);
    f.addEventListener("submit", function(e){
      e.preventDefault();
      var key = input.value.trim(); if (!key) return;
      btn.disabled = true; btn.textContent = "Checking…"; document.getElementById("gate-err").textContent = "";
      check(key).then(function(res){
        btn.disabled = false; btn.textContent = "Log in";
        if (res === "ok"){ var c = getConn(); c.url = WORKER; c.key = key; setConn(c); location.reload(); }
        else if (res === "wrong"){ document.getElementById("gate-err").textContent = "Wrong password."; input.select(); }
        else { document.getElementById("gate-err").textContent = "Cannot reach the login server right now. Try again in a moment."; }
      });
    });
  }
  function start(){
    var key = getConn().key;
    if (!key){ showGate(); return; }
    check(key).then(function(res){
      if (res === "ok") unlock();
      else if (res === "wrong"){ var c = getConn(); c.key = ""; setConn(c); showGate("Your password has changed. Please log in again."); }
      else showGate("Cannot reach the login server right now. Try again in a moment.");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
