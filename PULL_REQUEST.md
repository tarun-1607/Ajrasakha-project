# Pull Request: AI Chat Assistant, Farm Map, Language Picker & Weather Fallback

## Proposed Changes

This PR integrates a comprehensive suite of features designed to make **Ajrasakha** a highly interactive, accessible, and robust AI companion for farmers. 

### 1. 🤖 AI Chat Integration (`src/components/ai-elements/` & `src/routes/api/chat.ts`)
- **Interactive Chat Interface**: Integrated dynamic chat rendering (`conversation.tsx`, `message.tsx`) with markdown grid rendering for complex advice tables.
- **Adaptive System Prompting**: Gemini is configured with farmer context (crop, season, state) and **live weather data**. It is instructed to cite actual local temperatures/rain stats when answering agricultural tasks.
- **Voice & Image Support**: Integrated Speech-to-Text hooks (`use-speech.ts`) and image attachment utilities for pest/disease analysis.
- **AI Related Questions**: Implemented an automated follow-up engine (`related-questions.tsx`) that generates 3 contextual questions after every response.
- **Feedback Logging**: Added thumbs up/down logging synced with the Supabase `message_feedbacks` table.

### 2. 🗺️ Draggable Farm Map (`src/components/ajrasakha/farm-map.tsx`)
- **Interactive Google Map**: Integrated `@vis.gl/react-google-maps` with a draggable marker card side-by-side with farm profiles.
- **Automated Geolocation**: Utilizes browser Geolocation APIs on mount to fetch coordinates.
- **"Locate Me" Button**: Added an overlay button to explicitly re-trigger location prompts and center the map.
- **Local Fallback**: Renders an interactive fallback card if the Maps API Key is missing, preventing white screens.
- **SSR/Hydration Safe**: Delayed map loading until client-side mount, resolving TanStack Start hydration mismatch.

### 3. 🌐 Dynamic Language Selector (`src/components/ajrasakha/language-picker.tsx`)
- **Globe Switcher**: Added an HSL-themed language selector supporting English, Hindi (हिन्दी), Marathi (मराठी), and Kannada (ಕನ್ನಡ).
- **Auto-Syncing**: Saves preferences to LocalStorage and updates the user's Supabase profile (`preferred_language`) instantly.

### 4. 🌦️ Local Weather Fallback (`src/lib/weather.server.ts`)
- **Self-Healing Lookup**: If the server runs locally without the production `SUPABASE_SERVICE_ROLE_KEY`, it automatically bypasses database cache errors and pulls live metrics directly from Open-Meteo & OpenStreetMap APIs.

---

## Files Modified / Added

### Core Routes & Setup
- `[MODIFY]` [__root.tsx](file:///c:/Users/tarun/Documents/project%20new/src/routes/__root.tsx) - Globals wrapper (Language & Maps API provider integration).
- `[MODIFY]` [dashboard.tsx](file:///c:/Users/tarun/Documents/project%20new/src/routes/_authenticated/dashboard.tsx) - Interactive grid with Map, Weather, Language Picker, and Government Schemes search.
- `[MODIFY]` [index.tsx](file:///c:/Users/tarun/Documents/project%20new/src/routes/index.tsx) - Fallback redirect logic on network/Supabase errors.

### Components
- `[NEW]` [farm-map.tsx](file:///c:/Users/tarun/Documents/project%20new/src/components/ajrasakha/farm-map.tsx) - Google Maps & Geolocation component.
- `[NEW]` [language-picker.tsx](file:///c:/Users/tarun/Documents/project%20new/src/components/ajrasakha/language-picker.tsx) - Globe language selector dropdown.

### Server Functions & Weather
- `[MODIFY]` [weather.server.ts](file:///c:/Users/tarun/Documents/project%20new/src/lib/weather.server.ts) - Added Open-Meteo fallback when database keys are missing.

---

## Verification & Testing

### 1. Build Verification
Confirming all components compile cleanly:
```bash
npm run build
```
*Result: Compiles successfully with zero TypeScript or bundler errors.*

### 2. Local Testing (Port 8088)
- Go to [http://localhost:8088/](http://localhost:8088/).
- Set language to Hindi or Marathi and confirm page translation.
- Click **"Locate Me"** on the Map and allow GPS permissions.
- Validate weather values match current district forecasts.
