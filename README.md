# TODO Tracker (V1.2)

A modern, interactive relocation and travel tracker built with React, TypeScript, and Google Sheets. Designed for tracking bucket-list locations, hotels, and key landmarks across Austin, Texas, the wider USA, and the UK & Ireland.

![TODO Tracker](https://img.shields.io/badge/Version-1.2-indigo)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20TS%20%7C%20Vercel%20%7C%20Sheets-blue)

## 🚀 Features

- **📍 Interactive Map & List**: A split-screen responsive layout using Leaflet and Tailwind CSS.
- **🗺️ Multiple Scopes**: Toggle between Austin, Texas, USA, and UK & Ireland views with automatic map zooming and filtering.
- **🏨 Hotel Tracking**: A dedicated section for tracking accommodations separate from destinations.
- **🔍 Smart Search**: Add new locations instantly using Nominatim (OpenStreetMap) search.
- **🧳 Trips**: Build ordered routes or flexible unordered city breaks, check off stops as you go, and complete a trip without marking skipped places as visited.
- **📖 Diary**: Log activities for today or earlier, attach tracker locations or arbitrary places, and capture the current location with browser geolocation.
- **📷 Photo notes**: Add a short comment to each image and show its camera timestamp when the uploaded file provides one.
- **✅ Visited History**:
  - Grouped by category.
  - 1-5 Star Ratings.
  - Persistent private notes.
  - "Would Return" (Favorite) flags.
- **📱 Mobile Optimized**: Native-app feel with a fixed bottom navigation bar and touch-friendly targets.
- **🔐 Secure**: Password-protected entry with server-side authentication.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Mapping**: Leaflet, React-Leaflet.
- **Backend**: Vercel Serverless Functions (Node.js).
- **Database**: Google Sheets (via `google-spreadsheet`).

## ⚙️ Environment Variables

Create a `.env` file in the root directory (and add these to your Vercel Project Settings):

```env
SHEET_ID=your_google_sheet_id_from_url
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyContent\n-----END PRIVATE KEY-----\n"
PASSWORD=your_app_password_here
VITE_CARTO_API_KEY=your_carto_basemaps_api_key
```

`VITE_CARTO_API_KEY` enables CARTO's dark basemap. Request a free key from
[CARTO Basemaps](https://carto.com/basemaps/apikey/) and add it to the Production,
Preview, and Development environments in Vercel. Because Vite embeds `VITE_`
variables in the browser bundle, this key is public client configuration rather
than a server-side secret. Without it, the app falls back to OpenStreetMap tiles.

Vercel Preview deployments require these variables to be enabled for the Preview
environment. Redeploy after changing environment-variable assignments.

## 📊 Google Sheets Setup

Your spreadsheet requires three tabs (sheets) with specific headers:

### Sheet 1: "Places" (Index 0)
`id`, `category`, `name`, `address`, `lat`, `lng`, `status`, `notes`, `rating`, `priority`, `scope`, `return`, `details`, `date`, `eventStartDate`, `eventEndDate`

### Sheet 2: "Markers" (Index 1)
`id`, `type`, `name`, `address`, `lat`, `lng`, `notes`, `scope`

### Sheet 3: "Hotels" (Index 2)
`id`, `name`, `address`, `lat`, `lng`, `status`, `notes`, `rating`, `priority`, `scope`, `return`

### Sheet 6: "Routes"
`id`, `name`, `placeIds`, `scope`, `tripType`, `completedPlaceIds`, `status`

Existing Routes rows are treated as ordered, planned trips. Missing Trip columns are added automatically after an authenticated request.

### "Diary"
`id`, `date`, `title`, `notes`, `placeId`, `placeType`, `name`, `address`, `lat`, `lng`, `scope`, `createdAt`

The Diary sheet is created automatically when the first authenticated entry is saved.

### "Photos"
`locationId`, `url`, `comment`, `capturedAt`, `uploadedAt`

The three metadata columns are added automatically after an authenticated request. Existing URL-only photo rows remain supported.

**Note:** Ensure you share your Google Sheet with your `GOOGLE_SERVICE_ACCOUNT_EMAIL` and grant it **Editor** permissions.

## 📦 Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run local development (includes API support):
   ```bash
   vercel dev
   ```

## 🚢 Deployment

The project is configured for one-click deployment on **Vercel**.
1. Push your code to GitHub.
2. Import the project to Vercel.
3. Add the Environment Variables listed above.
4. Deploy!

## Austin Experiences

The **Experiences** section (**Explore** in the mobile navigation) keeps a permanent venue/organiser wishlist. Expand a venue to see its offerings, then expand an offering to see multiple sessions. Evergreen offerings do not need dates. Passing, missing or cancelling a session never removes or completes its parent records.

- Owner sign-in enables add, edit and remove at every level. Remove children before removing a parent.
- Offering status, completion count and last completed date are separate from session attendance. **Log completion** pre-fills one more completion for confirmation; edit it to correct history or mark an offering **Would repeat**.
- Sessions can be Interested, Booked, Attended, Missed, Cancelled or Past. Expired Interested sessions display as Past without changing stored records. Booked sessions retain their status so unresolved bookings are visible when expanded.
- Use **Link Diary entry** on an attended session to choose an existing entry. The link opens Diary at that entry and its tracker region. Removing a Diary entry leaves the session intact and displays that the entry is unavailable.
- Filter by category, area, interest, budget, upcoming sessions or completed offerings. Distance uses optional venue coordinates and browser location; venues with unknown coordinates are excluded when a radius is active. Unknown prices do not count as free.
- Dates and times use Austin time, including daylight saving. Times are optional; date-only sessions remain current through their final Austin calendar day.

**Import Austin leads** imports 24 venues/organisers, their offerings and 15 example session leads from issue #30. Stable IDs make repeated imports skip existing records without replacing notes, status or history. Interrupted imports can be retried. Dates are explicitly unverified, prices are unknown, and verification dates remain blank until checked by the owner. Source and organiser links are included. The import is owner-triggered; it never writes during a public read.

Three dedicated Sheets tabs are created automatically on the first experience write: `ExperienceOrganisers`, `ExperienceOfferings`, and `ExperienceSessions`. Each has `id` and `data` headers, with the typed record stored as JSON in `data`. Existing Places, Hotels, Routes, Diary and Photos tabs keep their current schemas. Experience requests use the existing `/api/places` password checks, with `{ type: "experience", action, kind, record }` for writes. No additional environment variables are required.

Run `npm test` for isolated persistence, validation, import, date/filter and API-auth regression tests. Tests use an in-memory Sheets substitute and never read or change live data. Run `npx tsc --noEmit` and `npm run build` for type and production-build checks.
