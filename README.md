# TODO Tracker (V1.2)

A modern, interactive relocation and travel tracker built with React, TypeScript, and Google Sheets. Designed for tracking bucket-list locations, hotels, and key landmarks across both local (Austin) and national (USA) scopes.

![TODO Tracker](https://img.shields.io/badge/Version-1.2-indigo)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20TS%20%7C%20Vercel%20%7C%20Sheets-blue)

## 🚀 Features

- **📍 Interactive Map & List**: A split-screen responsive layout using Leaflet and Tailwind CSS.
- **🗺️ Dual Scope**: Toggle between "Austin" and "USA" views with automatic map zooming and filtering.
- **🏨 Hotel Tracking**: A dedicated section for tracking accommodations separate from destinations.
- **🔍 Smart Search**: Add new locations instantly using Nominatim (OpenStreetMap) search.
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
```

## 📊 Google Sheets Setup

Your spreadsheet requires three tabs (sheets) with specific headers:

### Sheet 1: "Places" (Index 0)
`id`, `category`, `name`, `address`, `lat`, `lng`, `status`, `notes`, `rating`, `scope`, `return`

### Sheet 2: "Markers" (Index 1)
`id`, `type`, `name`, `address`, `lat`, `lng`, `notes`, `scope`

### Sheet 3: "Hotels" (Index 2)
`id`, `name`, `address`, `lat`, `lng`, `status`, `notes`, `rating`, `scope`, `return`

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
