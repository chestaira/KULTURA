const C = window.KULTURA;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = d => new Date(d).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'});
const ready = !C.SUPABASE_URL.startsWith('ISI');
const db = ready ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY) : null;
$('#y').textContent = new Date().getFullYear();

const params = new URLSearchParams(location.search);
const kat = params.get('k');
$('#cats').innerHTML = `<div class="wrap">` +
  [['Terkini', null], ...C.KATEGORI.map(k => [k, k])]
  .map(([n, k]) => `<a href="${k ? 'index.html?k=' + encodeURIComponent(k) : 'index.html'}" ${(kat === k && document.body.dataset.page === 'home') ? 'aria-current="page"' : ''}>${esc(n)}</a>`).join('') + `</div>`;

const pic = (a, cls = '') => a.cover_url
  ? `<img class="${cls}" src="${esc(a.cover_url)}" alt="" loading="lazy">`
  : `<div class="noimg ${cls}" aria-hidden="true"></div>`;
const link = a => `baca.html?s=${encodeURIComponent(a.slug)}`;

async function track(slug, el) {
  try {
    if (navigator.webdriver || /bot|crawl|spider|preview/i.test(navigator.userAgent)) return;
    const {data: {session}} = await db.auth.getSession();
    if (session) return; // kunjungan admin tidak dihitung
    let vid = localStorage.getItem('kv');
    if (!vid) { vid = crypto.randomUUID(); localStorage.setItem('kv', vid); }
    const h = location.hostname, r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
    const known = [[/instagram/, 'Instagram'], [/google/, 'Google'], [/(^|\.)(t\.co|twitter|x\.com)/, 'X'], [/facebook|fb\./, 'Facebook'], [/tiktok/, 'TikTok'], [/whatsapp|wa\.me/, 'WhatsApp'], [/youtube|youtu\.be/, 'YouTube']];
    let src = params.get('src');
    src = src ? src[0].toUpperCase() + src.slice(1) : !r ? 'Langsung' : r === h ? 'Dalam situs' : (known.find(([re]) => re.test(r)) || [0, r])[1];
    const {data: id} = await db.rpc('track_view', {p_slug: slug, p_visitor: vid, p_source: src.slice(0, 40)});
    if (!id) return;
    const t0 = Date.now(); let sent = 0;
    const tick = () => {
      const b = el.getBoundingClientRect(), p = Math.min(100, Math.max(0, (innerHeight - b.top) / b.height * 100));
      for (const m of [25, 50, 80, 100]) if (p >= m && m > sent && (m < 80 || Date.now() - t0 >= 10000)) { sent = m; db.rpc('track_read', {p_id: id, p_visitor: vid, p_scroll: m}).then(() => {}); }
      if (sent === 100) clearInterval(iv);
    };
    const iv = setInterval(tick, 3000); addEventListener('scroll', tick, {passive: true});
  } catch (e) {}
}

async function home() {
  const main = $('#main');
  let q = db.from('articles').select('slug,title,excerpt,category,cover_url,created_at')
    .eq('published', true).order('created_at', {ascending: false}).limit(60);
  if (kat) q = q.eq('category', kat);
  const {data, error} = await q;
  if (error) return main.innerHTML = `<p class="msg">Gagal memuat tulisan.</p>`;
  if (!data.length) return main.innerHTML = `<p class="msg">Belum ada tulisan${kat ? ' di kategori ' + esc(kat) : ''}.</p>`;
  let html = '', rest = data;
  if (!kat) {
    const [f, ...o] = data, side = o.slice(0, 3); rest = o.slice(3);
    html += `<section class="hero"><a class="feat" href="${link(f)}">${pic(f)}
      <div><span class="chip">${esc(f.category)}</span><h1>${esc(f.title)}</h1><p>${esc(f.excerpt)}</p></div></a>
      <div class="side">${side.map(a => `<a href="${link(a)}">${pic(a)}<div><span class="chip">${esc(a.category)}</span><h2>${esc(a.title)}</h2></div></a>`).join('')}</div></section>`;
  }
  if (rest.length || kat) html += `<h2 class="sec">${kat ? esc(kat) : 'Tulisan lainnya'}</h2><ol class="rows">` +
    (kat ? data : rest).map(a => `<li><a href="${link(a)}">${pic(a)}<div><span class="chip">${esc(a.category)}</span>
      <h3>${esc(a.title)}</h3><p>${esc(a.excerpt)}</p><time>${fmt(a.created_at)}</time></div></a></li>`).join('') + `</ol>`;
  main.innerHTML = html;
}

async function read() {
  const main = $('#main'), s = params.get('s');
  const {data: a} = await db.from('articles').select('*').eq('slug', s).eq('published', true).maybeSingle();
  if (!a) return main.innerHTML = `<p class="msg">Tulisan tidak ditemukan. <a href="index.html">Kembali ke beranda</a></p>`;
  document.title = a.title + ' – KULTURA';
  main.innerHTML = `<article><a class="chip" href="index.html?k=${encodeURIComponent(a.category)}">${esc(a.category)}</a>
    <h1>${esc(a.title)}</h1><p class="meta">${a.author ? 'Oleh ' + esc(a.author) + ' · ' : ''}${fmt(a.created_at)}</p>
    ${a.cover_url ? `<img class="cover" src="${esc(a.cover_url)}" alt="">` : ''}
    <div class="prose">${DOMPurify.sanitize(a.body_html)}</div></article>`;
  track(a.slug, main.querySelector('article'));
}

if (!ready) $('#main').innerHTML = `<p class="msg">Situs belum terhubung ke Supabase. Isi <code>config.js</code> (lihat README).</p>`;
else document.body.dataset.page === 'home' ? home() : read();
