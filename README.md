# 🐝 SnookerBee — Snooker Score Tracker

[![Vercel Deployment](https://img.shields.io/badge/deploy-vercel-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![Supabase Database](https://img.shields.io/badge/database-supabase-blueviolet?style=flat-square&logo=supabase)](https://supabase.com/)
[![React Version](https://img.shields.io/badge/react-v19-blue?style=flat-square&logo=react)](https://react.dev/)
[![PWA Ready](https://img.shields.io/badge/pwa-installable-success?style=flat-square)](https://vite-pwa-org.netlify.app/)
[![TypeScript](https://img.shields.io/badge/typescript-v6-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

**SnookerBee** is a modern, mobile-first Progress Web App (PWA) designed to track snooker match scores with professional, strict rule enforcement. Built with React, TypeScript, and Vite, it delivers a tactile, audio-assisted, and offline-capable scoring experience optimized for landscape viewports.

---

## 🌟 Key Features

*   **🟢 Immersive Design**: A gorgeous, landscape-optimized, green-felt table layout with pastel details, subtle micro-animations, and animated confetti/victory effects.
*   **⚖️ Strict Rules Engine**: A pure state-machine reducer that handles the official red-color sequence, nominating free balls, re-spotted blacks on tie, turn rotation management (1v1, teams, and solo free-for-alls), and a 10-step deep-cloned undo stack.
*   **🔊 Tactile Sound Effects**: Zero-dependency Web Audio API oscillator synthesizers trigger offline chimes for successful pots, warning buzzes for fouls, chimes for break milestones (25, 50, 100), and victory fanfares.
*   **👥 Flexible Game Modes**:
    *   **1 vs 1**: Standard head-to-head match.
    *   **Teams**: 2v2 or 3v3 alternating team configurations.
    *   **Free-for-All**: 2-8 players, solo scoring, round-robin visits.
*   **📶 Progressive Web App (PWA)**: Installable directly to your iPhone/Android homescreen shortcut with a custom soothing icon, offline functionality, and cached resources.
*   **☁️ Cloud Synchronisation**: Synchronise match history, aggregate player statistics, and display recent history boards using **Supabase** databases and **Google OAuth** login services.

---

## 🛠️ Technology Stack

*   **Frontend**: React 19 + TypeScript + Vite
*   **Routing**: React Router v7
*   **Styling**: Modern Vanilla CSS (using pastel CSS custom tokens, glassmorphism, responsive grid layouts)
*   **PWA Cache**: `vite-plugin-pwa` + Workbox caching strategies
*   **Audio**: Web Audio API (Oscillators, Gains, and Envelopes)
*   **Backend & Auth**: Supabase PostgreSQL database + Google OAuth

---

## 🚀 Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or higher recommended)
*   npm or yarn

### Installation & Run

1.  Clone the repository:
    ```bash
    git clone https://github.com/arshad0126/snookerbee.git
    cd snookerbee
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Launch local development server:
    ```bash
    npm run dev
    ```
4.  Open the browser to the local URL (usually `http://localhost:5173`).

---

## 💾 Supabase Database Schema

To set up your cloud database, create a new project in your **Supabase Console**, open the **SQL Editor**, and run the following script:

```sql
-- Create matches table
create table matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  mode text not null,
  reds_count int not null,
  best_of int not null,
  created_at timestamptz default now(),
  duration_ms bigint not null,
  winner_name text not null
);

-- Enable Row Level Security (RLS)
alter table matches enable row level security;
create policy "Users can CRUD their own matches" on matches 
  for all using (auth.uid() = user_id);

-- Create match_players table
create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_name text not null,
  team_name text,
  total_score int default 0,
  highest_break int default 0,
  frames_won int default 0,
  fouls_committed int default 0,
  time_spent_ms bigint default 0
);

alter table match_players enable row level security;
create policy "Users can CRUD their own match players" on match_players
  for all using (
    match_id in (select id from matches where user_id = auth.uid())
  );

-- Create match_frames table
create table match_frames (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  frame_number int not null,
  duration_ms bigint,
  action_log jsonb
);

alter table match_frames enable row level security;
create policy "Users can CRUD their own match frames" on match_frames
  for all using (
    match_id in (select id from matches where user_id = auth.uid())
  );
```

---

## 🌐 Environment Configurations

For cloud database synchronization and Google OAuth login integration, configure the following variables in Vercel or your local `.env` configuration file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```
