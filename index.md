---
layout: null
---
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="互联网的一小块空地。先占个位置，慢慢来。">
  <title>一小块空地</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='10' fill='%23f3f0e8'/%3E%3Cellipse cx='16' cy='17' rx='11' ry='9' fill='%23d86943'/%3E%3Ccircle cx='12' cy='16' r='1.2'/%3E%3Ccircle cx='20' cy='16' r='1.2'/%3E%3C/svg%3E">
  <style>
    :root { color-scheme: light; --paper:#f3f0e8; --ink:#292c27; --muted:#676b60; --accent:#d86943; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--paper); color:var(--ink); font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }
    .page { max-width:1440px; min-height:100svh; margin:auto; padding:36px 6vw 28px; display:flex; flex-direction:column; }
    header, footer { display:flex; align-items:center; justify-content:space-between; gap:20px; }
    .address { font:13px ui-monospace,SFMono-Regular,Consolas,monospace; letter-spacing:.03em; }
    .note { color:var(--muted); font-size:12px; }
    main { flex:1; display:grid; grid-template-columns:1.2fr 1fr; align-items:center; gap:30px; padding:80px 0; }
    .eyebrow { margin:0 0 28px; font-size:12px; letter-spacing:.2em; color:var(--muted); }
    h1 { margin:0; font-size:clamp(42px,6.2vw,84px); font-weight:550; line-height:1.24; letter-spacing:-.055em; }
    .intro { margin:30px 0 0; font-size:15px; line-height:1.9; color:var(--muted); }
    .pebble { display:grid; place-items:center; }
    svg { width:min(100%,390px); height:auto; overflow:visible; }
    .stone { transform-origin:200px 175px; transition:transform .5s ease; }
    body.resting .stone { transform:rotate(-9deg) translateY(7px); }
    .closed { display:none; }
    body.resting .open { display:none; }
    body.resting .closed { display:block; }
    footer { border-top:1px solid #d8d8cd; padding-top:20px; font-size:12px; color:var(--muted); }
    button { border:1px solid #b8bbae; border-radius:999px; padding:11px 17px; color:var(--ink); background:transparent; font:inherit; cursor:pointer; transition:background .2s; }
    button:hover { background:#e7e6da; }
    button:focus-visible { outline:2px solid var(--accent); outline-offset:5px; }
    button[hidden] { display:none; }
    @media (max-width:650px) {
      .page { padding:24px 7vw; }
      main { grid-template-columns:1fr; padding:65px 0 45px; gap:34px; }
      .eyebrow { margin-bottom:20px; }
      .intro { margin-top:22px; }
      svg { width:230px; }
      footer { align-items:center; }
    }
    @media (prefers-reduced-motion:reduce) { .stone, button { transition:none; } }
  </style>
</head>
<body>
  <div class="page">
    <header><span class="address">zxylab.github.io</span><span class="note">一小块空地</span></header>
    <main>
      <section aria-labelledby="title">
        <p class="eyebrow">HELLO, INTERNET.</p>
        <h1 id="title">先占个位置。<br>慢慢来。</h1>
        <p class="intro">这里暂时没什么大事。<br>有趣的东西，以后再放。</p>
      </section>
      <div class="pebble">
        <svg viewBox="0 0 400 330" role="img" aria-label="一颗悠闲的橙色小石头">
          <ellipse cx="204" cy="281" rx="105" ry="9" fill="#deded1"/>
          <g class="stone">
            <path d="M86 182C81 115 126 74 190 78C253 58 304 107 311 168C326 229 279 262 209 262C135 272 91 242 86 182Z" fill="#d86943"/>
            <g fill="#292c27" class="open"><ellipse cx="169" cy="165" rx="4" ry="6"/><ellipse cx="225" cy="165" rx="4" ry="6"/></g>
            <g fill="none" stroke="#292c27" stroke-width="3" stroke-linecap="round" class="closed"><path d="M161 166q8 7 16 0M217 166q8 7 16 0"/></g>
            <path d="M188 189q10 8 20 0" fill="none" stroke="#292c27" stroke-width="3" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
    </main>
    <footer><span>不急着把空白填满。</span><button id="pause" type="button" aria-pressed="false" hidden>发会儿呆 ↗</button></footer>
  </div>
  <script>
    const pause = document.getElementById('pause');
    pause.hidden = false;
    pause.addEventListener('click', () => {
      const resting = document.body.classList.toggle('resting');
      pause.setAttribute('aria-pressed', String(resting));
      pause.textContent = resting ? '好，慢慢来 ↙' : '发会儿呆 ↗';
    });
  </script>
</body>
</html>
