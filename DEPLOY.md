# 🛡️ SafeLink-AI — Deployment Guide

## One-Click Deploy

### Frontend (Vercel — Free)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-repo/SafeZone-AI&project-name=safelink-ai&framework=vite&root-directory=frontend&build-command=npm%20run%20build&output-directory=dist&env=VITE_API_URL)

### Backend (Render — Free)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-repo/SafeZone-AI)

---

## Manual Deploy Steps

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "SafeLink-AI - Full deployment"
git remote add origin https://github.com/your-username/SafeZone-AI.git
git push -u origin main
```

### Step 2: Deploy Backend to Render (Free)
1. Go to [render.com](https://render.com) and sign up
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name**: `safelink-ai-backend`
   - **Runtime**: Python 3
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free
5. Click **Deploy**
6. Copy your backend URL (e.g., `https://safelink-ai-backend.onrender.com`)

### Step 3: Deploy Frontend to Vercel (Free)
1. Go to [vercel.com](https://vercel.com) and sign up
2. Click **New → Project**
3. Import your GitHub repo
4. Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variable:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://safelink-ai-backend.onrender.com` (your Render URL)
6. Click **Deploy**
7. Your app is live! 🎉

---

## Offline Mode

SafeLink-AI works **completely offline** once loaded:
- ✅ Full dashboard with risk data cached in IndexedDB
- ✅ Offline mesh network simulation (17 nodes, multi-hop routing)
- ✅ Offline SOS submission and queue
- ✅ Service Worker caches all assets
- ✅ Background sync when connectivity returns

### How Offline Works
1. **First visit**: Service Worker caches app shell + API responses
2. **Offline**: IndexedDB serves cached data, mesh engine runs locally
3. **SOS Offline**: Reports queue in IndexedDB, sync when online
4. **Mesh Network**: Full simulation runs in browser (no server needed)

---

## Demo Credentials

| Method | Credential |
|--------|-----------|
| Email | `rethikas2782@gmail.com` |
| Password | `1234` |
| PIN | `1234` |
| Face | 📱 Mobile only — camera scan |
| Thumb | 📱 Mobile only — WebAuthn |

---

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + Framer Motion
- **Backend**: FastAPI + Python 3.11
- **Database**: JSON files (demo) / IndexedDB (offline)
- **Mesh Engine**: Pure JS BFS routing with Haversine distance
- **PWA**: Service Worker + IndexedDB + Manifest
