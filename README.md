# MealLoop · Campus Food-Ordering & Surplus-Rescue Platform

A production-ready campus food-ordering and surplus-rescue platform built for university dining halls and student canteens. MealLoop eliminates queue times through advance pickup slots, unlocks volume discounts with 8-person group deals, salvages kitchen surplus through progressive rescue discounts, coordinates NGO donations for unsold portions, and redeems orders via atomic single-use pickup QR codes.

---

## 🌟 Key Features

1. **Real Google Authentication (Firebase Auth)**:
   - Popup Google Sign-In with redirect fallback.
   - Persistent authenticated sessions with Google avatar, verified campus email, and user name.
   - Server-side ID token verification via Firebase Admin SDK (`/api/auth/verify-token`).
   - Strict role-based access control (`STUDENT`, `CANTEEN_STAFF`, `ADMIN`, `NGO`). Non-student roles can never be self-assigned from browser code.
2. **Standard Razorpay Checkout**:
   - Official Razorpay modal integration (`checkout.js`).
   - Integer paise calculations across all subtotals, GST (5%), coupons, and referral credits.
   - 10-minute time-limited stock reservations with automatic stock return upon expiry.
   - Server-side HMAC-SHA256 signature verification before any order is marked as paid.
   - Webhook listener (`/api/payments/webhook`) with raw-body signature validation and event deduplication.
   - Clear, labelled Hackathon Demo Payment button for instant evaluation without requiring live payment credentials.
3. **LoopAI Campus Food Assistant**:
   - Powered by Gemini via server-side proxy (`/api/ai/chat`).
   - Tool-calling capabilities for menu browsing, budget filtering, dietary preferences (veg/non-veg), active group deals, and user order tracking.
4. **8-Student Group Deals**:
   - Dynamic deals that unlock at a strict threshold of 8 participants (e.g. 6/8 → 7/8 → 8/8 "DEAL UNLOCKED").
   - Shareable link generator and simulated peer joining for hackathon demonstration.
5. **Progressive Kitchen Rescue Surplus**:
   - Staff-approved surplus batches with time-decay discounts (7% → 15% → 23% → 30% off).
   - Virtual Demo Clock controls (`+1h`, `+2h`, `+3h`, `+4h`) to demonstrate progressive price decay in real time.
   - Automatic NGO dispatch trigger when collection cutoff approaches.
6. **NGO Food Rescue Coordination (Robin Hood Army)**:
   - Dedicated NGO portal displaying available surplus batches, portion counts, and physical pickup windows.
   - Accept / Decline actions with verified physical handover confirmation.
7. **Single-Use Pickup QR Codes & Staff Scanner**:
   - Opaque pickup tokens minted only after payment is verified.
   - High-contrast QR codes rendered client-side from server tokens.
   - Canteen staff Counter 2 scanner with atomic redemption locking (returns HTTP 409 Conflict if scanned twice).

---

## 🚀 Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend**: Node.js, Express, tsx.
- **Authentication**: Firebase Authentication (Google Identity Provider) + Firebase Admin SDK.
- **Database / Rules**: Cloud Firestore with Attribute-Based Access Control (`firestore.rules`).
- **Payments**: Razorpay Standard Checkout & Webhooks.
- **Deployment**: Google Cloud Run (single multi-stage container building frontend and hosting unified backend).

---

## ⚙️ Configuration & Environment Variables

Copy `.env.example` to `.env` or configure secrets in Google Cloud Run / GitHub Secrets:

```bash
# Razorpay Credentials (from https://dashboard.razorpay.com/app/keys)
RAZORPAY_KEY_ID="rzp_test_your_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_secret"
RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"

# Gemini API Key (for server-side LoopAI chat assistant)
GEMINI_API_KEY="your_gemini_api_key"

# Runtime
PORT=8080
NODE_ENV=production
```

### Firebase Authentication Setup
1. Open the [Firebase Console](https://console.firebase.google.com/) for project `applied-landing-qct7q`.
2. Under **Authentication > Sign-in method**, ensure **Google** is enabled.
3. Under **Authentication > Settings > Authorized Domains**, ensure your Google Cloud Run domain (e.g. `*.run.app`) is listed.
4. Deploy the zero-trust security rules with `deploy_firebase` or Firebase CLI:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start development server (serves frontend and backend simultaneously on port 3000)
npm run dev

# Run automated end-to-end payment and QR test suite
node tests/e2e_test.js

# Compile and check TypeScript types
npm run lint
npm run build
```

---

## 🚢 Deploying to Google Cloud Run from GitHub

### Option A: Automated GitHub Actions
1. Push this repository to GitHub.
2. In your GitHub repository settings, go to **Settings > Secrets and variables > Actions** and add:
   - `GCP_PROJECT_ID`: Your Google Cloud project ID.
   - `GCP_SA_KEY`: Service account JSON key with Cloud Run Admin & Storage Admin roles.
   - `RAZORPAY_KEY_ID`: Your Razorpay test key.
   - `RAZORPAY_KEY_SECRET`: Your Razorpay test secret.
   - `RAZORPAY_WEBHOOK_SECRET`: Your Razorpay webhook secret.
   - `GEMINI_API_KEY`: Your Google AI Studio Gemini API key.
3. Every push to the `main` branch will automatically build and deploy via `.github/workflows/deploy.yml`.

### Option B: Direct Google Cloud Run CLI Deployment
```bash
# Build container using Cloud Build and deploy to Cloud Run
gcloud run deploy mealloop \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --set-secrets RAZORPAY_KEY_ID=RAZORPAY_KEY_ID:latest,RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest
```

---

## 🔒 Security Assertions
- No client-side price trust: all amounts calculated in integer paise on the server.
- No payment secret exposure: Razorpay Secret and Webhook Secret are never bundled into client assets.
- Single-use QR token invalidation: prevents reuse across food pickup counters.
- Firebase Auth token verification: tokens cryptographically validated on the backend before user profiles are registered or orders saved.
