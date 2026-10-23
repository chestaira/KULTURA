const C = window.KULTURA, $ = s => document.querySelector(s);
const db = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let editId = null, cover = '';
$('#f-cat').innerHTML = C.KATEGORI.map(k => `<option>${esc(k)}</option>`).join('');
const show = id => ['login', 'dash', 'ed', 'stats'].forEach(x => $('#' + x).hidden = x !== id);

async function start() {
  const {data} = await db.auth.getSession();
  data.session ? list() : show('login');
}
$('#login').onsubmit = async e => {
  e.preventDefault();
  const {error} = await db.auth.signInWithPassword({email: $('#em').value, password: $('#pw').value});
  if (error) $('#lerr').textContent = 'Gagal masuk: ' + error.message; else list();
};
$('#out').onclick = async () => { await db.auth.signOut(); show('login'); };

async function list() {
  show('dash');
  const {data} = await db.from('articles').select('id,title,published,created_at').order('created_at', {ascending: false});
  $('#mine').innerHTML = (data || []).map(a => `<li><span>${esc(a.title)} ${a.published ? '' : '<em>(draf)</em>'}</span>
    <span><button class="btn ghost" data-e="${a.id}">Ubah</button> <button class="btn ghost" data-d="${a.id}">Hapus</button></span></li>`).join('') || '<li>Belum ada tulisan.</li>';
}
$('#mine').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.d) { if (confirm('Hapus tulisan ini?')) { await db.from('articles').delete().eq('id', b.dataset.d); list(); } }
  if (b.dataset.e) { const {data} = await db.from('articles').select('*').eq('id', b.dataset.e).single(); form(data); }
};
$('#new').onclick = () => form(null);
$('#cancel').onclick = list;

function form(a) {
  editId = a?.id || null; cover = a?.cover_url || '';
  $('#edt').textContent = a ? 'Ubah tulisan' : 'Tulisan baru';
  $('#f-title').value = a?.title || ''; $('#f-cat').value = a?.category || C.KATEGORI[0];
  $('#f-author').value = a?.author || ''; $('#f-ex').value = a?.excerpt || '';
  $('#body').innerHTML = a?.body_html || ''; $('#f-pub').checked = a ? a.published : true;
  $('#cov-prev').src = cover; $('#cov-prev').hidden = !cover; $('#serr').textContent = '';
  show('ed');
}

// Unggah gambar (diperkecil dulu ke maks 1600px agar situs tetap cepat)
async function shrink(file) {
  const bmp = await createImageBitmap(file), r = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = bmp.width * r; cv.height = bmp.height * r;
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(ok => cv.toBlob(ok, 'image/jpeg', 0.85));
}
async function upload(file) {
  const blob = file.type === 'image/gif' ? file : await shrink(file);
  const path = Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.jpg';
  const {error} = await db.storage.from('gambar').upload(path, blob, {contentType: blob.type, cacheControl: '31536000'});
  if (error) { $('#serr').textContent = 'Gagal mengunggah gambar.'; return null; }
  return db.storage.from('gambar').getPublicUrl(path).data.publicUrl;
}
$('#f-cover').onchange = async e => {
  const u = e.target.files[0] && await upload(e.target.files[0]);
  if (u) { cover = u; $('#cov-prev').src = u; $('#cov-prev').hidden = false; }
};
const insertImg = u => u && document.execCommand('insertHTML', false, `<img src="${u}" alt=""><p><br></p>`);
$('#f-img').onchange = async e => { $('#body').focus(); insertImg(e.target.files[0] && await upload(e.target.files[0])); e.target.value = ''; };

// Toolbar
document.querySelector('.tb').onclick = e => {
  const c = e.target.closest('button')?.dataset.c; if (!c) return;
  $('#body').focus();
  if (c === 'bold' || c === 'italic') document.execCommand(c);
  if (c === 'h2') document.execCommand('formatBlock', false, 'h2');
  if (c === 'quote') document.execCommand('formatBlock', false, 'blockquote');
  if (c === 'ul') document.execCommand('insertUnorderedList');
  if (c === 'link') { const u = prompt('Alamat tautan (https://...)'); if (u) document.execCommand('createLink', false, u); }
  if (c === 'img') $('#f-img').click();
};

// Tempel dari Word / Google Docs: bersihkan format, pertahankan tebal/miring/judul/daftar
const TAGS = ['p','h2','h3','strong','em','a','ul','ol','li','blockquote','br','img'];
function clean(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('b[style*="normal"]').forEach(b => b.replaceWith(...b.childNodes));
  d.querySelectorAll('span[style]').forEach(s => {
    const st = s.getAttribute('style'); let h = s.innerHTML;
    if (/font-weight:\s*(700|bold)/.test(st)) h = '<strong>' + h + '</strong>';
    if (/font-style:\s*italic/.test(st)) h = '<em>' + h + '</em>';
    s.innerHTML = h;
  });
  d.querySelectorAll('h1').forEach(h => { const n = d.createElement('h2'); n.innerHTML = h.innerHTML; h.replaceWith(n); });
  return DOMPurify.sanitize(d.body.innerHTML, {ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ['href', 'src', 'alt']});
}
$('#body').addEventListener('paste', async e => {
  const imgs = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'));
  if (imgs.length) { e.preventDefault(); for (const f of imgs) insertImg(await upload(f)); return; }
  const h = e.clipboardData.getData('text/html');
  if (h) { e.preventDefault(); document.execCommand('insertHTML', false, clean(h)); }
});

$('#ed').onsubmit = async e => {
  e.preventDefault();
  const body = clean($('#body').innerHTML), text = $('#body').textContent.trim();
  if (!text && !body.includes('<img')) return $('#serr').textContent = 'Isi tulisan masih kosong.';
  const title = $('#f-title').value.trim();
  const row = {
    title, category: $('#f-cat').value, author: $('#f-author').value.trim() || null,
    excerpt: $('#f-ex').value.trim() || text.slice(0, 160) + (text.length > 160 ? '…' : ''),
    cover_url: cover || null, body_html: body, published: $('#f-pub').checked
  };
  const q = editId ? db.from('articles').update(row).eq('id', editId)
    : db.from('articles').insert({...row, slug: title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) + '-' + Math.random().toString(36).slice(2, 6)});
  const {error} = await q;
  if (error) $('#serr').textContent = 'Gagal menyimpan: ' + error.message; else list();
};
// Statistik
$('#st').onclick = () => stats();
$('#back').onclick = list;
$('#range').onchange = () => stats();
async function stats() {
  show('stats'); $('#sbody').innerHTML = '<p class="msg">Memuat…</p>';
  const days = +$('#range').value, {data: d, error} = await db.rpc('get_stats', {p_days: days});
  if (error) return $('#sbody').innerHTML = `<p class="err">Gagal memuat statistik: ${esc(error.message)}. Pastikan analytics-setup.sql sudah dijalankan.</p>`;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0, n = x => Number(x).toLocaleString('id-ID');
  const byDay = Object.fromEntries(d.daily.map(x => [x.day, x.views])), bars = [];
  for (let i = days - 1; i >= 0; i--) { const k = new Date(Date.now() - i * 864e5).toLocaleDateString('sv-SE', {timeZone: 'Asia/Jakarta'}); bars.push([k, byDay[k] || 0]); }
  const mx = Math.max(1, ...bars.map(b => b[1]));
  if (!d.total) return $('#sbody').innerHTML = '<p class="msg">Belum ada kunjungan pada periode ini. Kunjungan admin tidak dihitung, jadi coba buka artikel dari HP atau browser lain tanpa login.</p>';
  $('#sbody').innerHTML = `
    <div class="tiles">
      <div class="tile"><b>${n(d.total)}</b><span>Tampilan</span></div>
      <div class="tile"><b>${n(d.unique)}</b><span>Pembaca unik</span></div>
      <div class="tile"><b>${pct(d.finished, d.total)}%</b><span>Membaca sampai selesai</span></div>
    </div>
    <h2 class="sec">Tampilan per hari</h2>
    <div class="chart" role="img" aria-label="Grafik tampilan per hari">${bars.map(([k, v]) => `<i style="height:${Math.max(2, v / mx * 100)}%" title="${k}: ${v} tampilan"></i>`).join('')}</div>
    <h2 class="sec">Per artikel</h2>
    <div class="tw"><table><thead><tr><th>Judul</th><th>Tampilan</th><th>Pembaca</th><th>Rata-rata dibaca</th><th>Selesai</th></tr></thead><tbody>
    ${d.articles.map(a => `<tr><td>${esc(a.title)}</td><td>${n(a.views)}</td><td>${n(a.visitors)}</td><td>${a.avg_scroll}%</td><td>${n(a.finished)} (${pct(a.finished, a.views)}%)</td></tr>`).join('')}
    </tbody></table></div>
    <h2 class="sec">Asal pengunjung</h2>
    <ul class="mine">${d.sources.map(s => `<li><span>${esc(s.source)}</span><span>${n(s.views)} (${pct(s.views, d.total)}%)</span></li>`).join('')}</ul>
    <p class="hint">Selesai = pembaca menggulir sampai ±80% artikel dan bertahan minimal 10 detik. Pembaca unik dihitung per browser, jadi angkanya perkiraan.</p>`;
}

start();
