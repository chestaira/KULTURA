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
}

if (!ready) $('#main').innerHTML = `<p class="msg">Situs belum terhubung ke Supabase. Isi <code>config.js</code> (lihat README).</p>`;
else document.body.dataset.page === 'home' ? home() : read();
