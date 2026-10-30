# PLN MV Work Compliance Monitor

Aplikasi web untuk monitoring kepatuhan SOP pekerjaan Medium Voltage (MV) PLN menggunakan analisis gambar dari kamera Ezviz melalui Node-RED dan AI Vision (OpenAI-compatible).

## Fitur

- Upload gambar manual atau drag & drop.
- Feed capture otomatis dari Node-RED / MV Guard server.
- Analisis AI dua tahap:
  1. Deteksi apakah gambar berisi medium voltage switchgear.
  2. Deteksi aktivitas grounding dan voltage check selama 10 capture.
- Status monitoring dengan banner hasil evaluasi SOP.

## Struktur File

| File | Keterangan |
|------|------------|
| `index.html` | Antarmuka utama aplikasi |
| `server.js` | Backend Express untuk menerima gambar dari Node-RED dan menyajikannya ke browser |
| `package.json` | Dependensi dan script Node.js |
| `ezviz-capture-flow.json` | Contoh flow Node-RED sederhana untuk Ezviz snapshot (opsional) |

## Instalasi

```bash
npm install
```

## Menjalankan Aplikasi

```bash
npm start
```

Aplikasi akan berjalan di `http://localhost:3006` secara default.

### Mengubah Port

Jika port 3006 sudah digunakan, jalankan dengan port lain:

```bash
# Windows
set PORT=3007
npm start

# Linux/macOS
PORT=3007 npm start
```

## Konfigurasi

### 1. AI Provider

Di halaman web, isi:
- **Base URL**: endpoint OpenAI-compatible (contoh: `https://api.openai.com/v1` atau `http://localhost:11434/v1`).
- **API Key**: kunci API Anda.
- **Model Vision**: contoh `gpt-4o-mini`, `gpt-4o`, `qwen2.5-vl`, dll.

### 2. Feed dari Node-RED

Aplikasi dapat menerima gambar secara otomatis dari Node-RED melalui endpoint:

```
POST /api/capture?device=<SERIAL>
```

Header yang dibutuhkan:
```
Authorization: Bearer w0WqCO3CWyIZkcQmCHqDR6GjNnMGiVRS
Content-Type: image/jpeg
```

Di flow Node-RED Anda, ubah `API_URL` agar mengarah ke server ini:

```js
const API_URL = 'http://<SERVER_IP>:3006/api/capture';
```

Ganti `<SERVER_IP>` dengan IP atau hostname tempat server ini dijalankan.

### 3. Feed URL di Browser

Setelah menjalankan server, buka `http://localhost:3006`, lalu di bagian **Feed Capture Ezviz via Node-RED / MV Guard** gunakan URL:

```
http://localhost:3006/api/latest?device=<SERIAL>
```

Ganti `<SERIAL>` dengan serial perangkat Ezviz Anda, contoh `BH7353783`.

Klik **Start Feed** untuk mulai polling gambar terbaru. Aktifkan **Auto-process ke AI** agar setiap gambar baru langsung dianalisis.

## Endpoint API

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/` | Menyajikan `index.html` |
| POST | `/api/capture?device=<SERIAL>` | Menerima gambar dari Node-RED (wajib Bearer token) |
| GET | `/api/latest?device=<SERIAL>` | Mengambil gambar terbaru perangkat |
| GET | `/api/devices` | Melihat daftar perangkat yang sudah mengirim gambar |

## Variabel Lingkungan

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `3006` | Port server Express |
| `CAPTURE_TOKEN` | `w0WqCO3CWyIZkcQmCHqDR6GjNnMGiVRS` | Token Bearer untuk validasi POST `/api/capture` |

## Catatan Keamanan

- Gunakan `CAPTURE_TOKEN` yang kuat di production.
- Jangan commit file `.env` atau kredensial ke repository.

## Lisensi

Internal use only.