# AI Sentinel: Scam & Phishing Detector

A real-time, lightweight browser extension coupled with a Node.js machine learning backend (Naive Bayes Classifier) to detect social engineering, typosquatting, and insecure or anomalous forms on websites.

---

## Project Structure

```text
├── backend/
│   ├── server.js          # Node.js API server (ML classifier + heuristic engines)
│   └── dataset.json       # JSON training data corpus
├── extension/
│   ├── manifest.json      # Extension config (Manifest V3)
│   ├── background.js      # Service worker & anomaly detection
│   ├── content.js         # DOM analyzer & warning banner injector
│   ├── popup.html/css/js  # User-facing dashboard
│   └── icons/             # Extension icons (recommended to add 16, 48, 128px icons)
├── test_scam.html         # Test phishing page
├── test_safe.html         # Test safe page
└── extension.zip          # Packaged extension zip ready for Chrome Web Store
```

---

## 1. Hosting the Backend API publicly

To distribute the extension to others, the backend API must be publicly accessible on the web instead of running on `localhost`.

### Deploying to Render (Free Node.js Hosting)
1. Push this project workspace to a new public or private repository on your **GitHub** account.
2. Sign up or log in to **[Render](https://render.com/)**.
3. Click **New +** and select **Web Service**.
4. Connect your GitHub repository.
5. Configure the Web Service settings:
   * **Name**: `ai-sentinel-api`
   * **Root Directory**: `backend` (if you want to deploy just the backend subdirectory) or leave blank and set starting commands.
   * **Runtime**: `Node`
   * **Build Command**: `npm install` (if you add dependencies later, otherwise empty)
   * **Start Command**: `node server.js`
6. Click **Deploy Web Service**. Render will generate a public URL for your server (e.g., `https://ai-sentinel-api.onrender.com`).

### Connect the Extension to Deployed API
1. Open `extension/background.js`.
2. Locate the top lines and uncomment the production URL, adding your deployed Render URL:
   ```javascript
   const API_URL = 'https://ai-sentinel-api.onrender.com/api.php';
   ```
3. Run `Compress-Archive -Path extension\* -DestinationPath extension.zip -Force` in PowerShell (or re-create the zip file) to update the zip contents.

---

## 2. Distributing the Extension to Others

### Uploading to the Chrome Web Store
1. Go to the **[Chrome Developer Console](https://chrome.google.com/webstore/devconsole)**.
2. Sign in with a Google account and register as a Chrome Web Store developer (Google charges a one-time $5 USD fee to prevent spam submissions).
3. Click **New Item** and upload the **`extension.zip`** file located in the root of this project.
4. Fill in details (description, screenshots, category).
5. Submit for Review. Google typically reviews and publishes extensions within 1–3 days. Once approved, you can share the store link, and anyone can click "Add to Chrome" to install it.
