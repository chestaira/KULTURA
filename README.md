# KULTURA – Kabar Ulasan dan Cerita Tentang Ragam Budaya

Website statis + Supabase (gratis) untuk menyimpan artikel dan gambar. Di-hosting di Vercel.

## 1. Siapkan Supabase (sekali saja, ±10 menit)
1. Daftar di supabase.com, buat project baru.
2. Buka **SQL Editor > New query**, paste isi `supabase-setup.sql`, klik **Run**.
3. Buka **Authentication > Users > Add user**, buat akun admin (email + sandi). Lalu di **Authentication > Sign In / Providers** matikan pendaftaran publik (Allow new users to sign up = off) supaya hanya kamu yang bisa masuk.
4. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**, tempel ke `config.js`.

## 2. Deploy ke Vercel
Push folder ini ke GitHub, lalu di vercel.com: Add New Project > pilih repo. Framework Preset: **Other**, tanpa build command.

## 3. Menulis artikel
Buka `alamat-situsmu/admin`, masuk, klik **Tulisan baru**. Tempel (Ctrl+V) teks dari Word/Google Docs ke kotak isi, unggah gambar sampul, dan klik Simpan. Gambar tambahan bisa disisipkan lewat tombol "Sisipkan gambar" atau ditempel langsung.

Kategori bisa diubah di `config.js`.
