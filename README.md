# DiTz Music

Website musik responsif untuk mencari katalog lagu dan memutar preview resmi 30 detik dari iTunes Search API.

## Fitur

- Pencarian lagu, artis, dan album
- Preview audio 30 detik
- Player: play/pause, next, previous, progress, volume
- Favorit tersimpan di `localStorage`
- Tema gelap/terang
- PWA / bisa ditambahkan ke layar utama
- Mobile responsive
- Serverless API proxy untuk Vercel
- Fallback JSONP jika proxy tidak tersedia

## Menjalankan lokal

```bash
npm install
npm run dev
```

Lalu buka URL yang ditampilkan oleh Vercel CLI.

## Deploy ke Vercel

1. Upload folder ini ke GitHub.
2. Buka Vercel dan pilih **Add New Project**.
3. Import repository.
4. Framework preset: **Other**.
5. Klik **Deploy**.

Tidak perlu environment variable atau API key.

## Catatan legal

Website hanya memutar URL preview yang disediakan oleh Apple. Untuk musik penuh, pengguna diarahkan ke halaman resmi iTunes/Apple Music melalui tombol **Buka**.
