# Environment Setup for Austin Tracker

To run this application, you need to set up a Google Service Account and connect it to your Google Sheet.

### 1. Google Sheets Setup
1.  Create a new Google Sheet.
2.  **Sheet 1 (First Tab - "Places"):**
    Add these headers: `id`, `category`, `name`, `address`, `lat`, `lng`, `status`, `notes`
    *Example Row:* `1`, `Food`, `Terry Black's BBQ`, `1003 Barton Springs Rd`, `30.2597`, `-97.7548`, `To Do`, `Best brisket`
3.  **Sheet 2 (Second Tab - "Markers"):**
    Add these headers: `id`, `type`, `name`, `address`, `lat`, `lng`, `notes`
    *Example Row:* `h1`, `home`, `Our New House`, `123 Austin St`, `30.25`, `-97.74`, `Move in date: July 1st`
    *Note:* `type` should be `home` or `office` to get the special icons.
4.  Copy the **Sheet ID** from the URL (the long string between `/d/` and `/edit`).

### 2. Google Service Account
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project.
3.  Enable the **Google Sheets API**.
4.  Go to **IAM & Admin > Service Accounts** and create a new Service Account.
5.  Create a **JSON Key** for the service account and download it.
6.  **CRITICAL**: Open your Google Sheet and "Share" it with the `client_email` found in your JSON file (give it "Editor" access).

### 3. Environment Variables
Create a `.env.local` file in the root directory and add the following:

```env
SHEET_ID=your_google_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyContent\n-----END PRIVATE KEY-----\n"
```

*Note: Ensure the `GOOGLE_PRIVATE_KEY` includes the `\n` characters and is wrapped in quotes if setting it via the Vercel dashboard.*

### 4. Running Locally
```bash
npm install
npm run dev
```
*(Note: Serverless functions in `api/` require `vercel dev` to run locally if you have the Vercel CLI installed).*
