# QuickFit4u Backend

## Folder structure (so far)

```
quickfit4u-backend/
├── server.js
├── package.json
├── .env.example
├── lib/
│   ├── db.js        SQLite connection + full schema
│   ├── otp.js         OTP generation, expiry, rate limiting
│   └── mailer.js        sends the OTP email via SMTP
├── middleware/
│   └── auth.js           JWT verification
└── routes/
    ├── auth.js             signup / login / verify-otp / me
    └── gyms.js              gym owner: profile, slots, today's bookings, customers
```

## Setup

```
npm install
copy .env.example .env
```
Then edit `.env` with your Gmail address + an App Password (see comments in
that file), and set `JWT_SECRET` to any random long string.

```
npm start
```

You should see: `QuickFit4u backend running at http://localhost:3000`

---

## Phase 1 — Auth (email OTP, no passwords)

Covered in the earlier README version. Quick recap:
- `POST /api/auth/signup` — { email, name, role: 'member'|'owner', referredBy? }
- `POST /api/auth/login` — { email }
- `POST /api/auth/verify-otp` — { email, code } → returns { token, user }
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`

## Phase 2 — Gym Owner Dashboard (new)

All of these require the logged-in user to be an **owner** (send the token
from signup/login as `Authorization: Bearer <token>`).

### Gym profile
- `GET /api/gyms/mine` — returns your gym, or `{ gym: null }` if you haven't created one yet
- `POST /api/gyms/mine` — create your gym profile (one per owner account)
  ```
  { "name": "Iron Peak Fitness", "area": "Hauz Khas", "city": "Delhi",
    "description": "...", "tags": ["Free Weights","AC"], "photos": [],
    "hourlyRate": 149 }
  ```
- `PUT /api/gyms/mine` — edit any of the same fields (send only what changed)

### Slots
- `POST /api/gyms/mine/slots` — open an hourly slot
  ```
  { "date": "2026-07-25", "hourLabel": "6 PM", "capacity": 3 }
  ```
- `GET /api/gyms/mine/slots?date=2026-07-25` — list slots for that date, with
  `booked` and `spotsLeft` for each

### Today's bookings
- `GET /api/gyms/mine/bookings/today` — bookings for today (or `?date=` for
  another day). If the array is empty, show "No bookings for today yet" in
  the app — the backend intentionally just returns `bookings: []` rather
  than a special "empty" flag, so the frontend decides how to display it.

### Previous customers
- `GET /api/gyms/mine/customers` — everyone who has ever booked at your gym,
  with their visit count and last visit date, most recent first.

## Test sequence (curl)

```
# 1. Sign up as an owner (use a real email you can check)
curl -X POST http://localhost:3000/api/auth/signup ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"owner@example.com\",\"name\":\"Iron Peak Fitness\",\"role\":\"owner\",\"referredBy\":\"AGENT007\"}"

# 2. Verify the code from your inbox — save the returned token
curl -X POST http://localhost:3000/api/auth/verify-otp ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"owner@example.com\",\"code\":\"123456\"}"

# 3. Create your gym profile (replace TOKEN)
curl -X POST http://localhost:3000/api/gyms/mine ^
  -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" ^
  -d "{\"name\":\"Iron Peak Fitness\",\"area\":\"Hauz Khas\",\"city\":\"Delhi\",\"hourlyRate\":149,\"tags\":[\"Free Weights\",\"AC\"]}"

# 4. Open a slot for today
curl -X POST http://localhost:3000/api/gyms/mine/slots ^
  -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" ^
  -d "{\"date\":\"2026-07-24\",\"hourLabel\":\"6 PM\",\"capacity\":3}"

# 5. Check today's bookings (should be empty right now — no member has booked yet)
curl http://localhost:3000/api/gyms/mine/bookings/today -H "Authorization: Bearer TOKEN"
```

(Windows PowerShell: keep the `^` line-continuations. Mac/Linux: use `\` instead.)

---

## What's real vs what's next

**✅ Done:**
- Email OTP auth for both members and gym owners, with optional referral code
- Gym owner: create/edit gym profile, open hourly slots, view today's
  bookings, view previous customers with visit counts

**⏳ Still needed:**
1. **Member-facing endpoints** (Phase 3) — search gyms by city, gym detail
   with reviews, and actually creating a booking (which is what will make
   `bookings/today` show real data instead of an empty list).
2. **Wiring the QuickFit4u app screens** to these endpoints instead of mock data.
3. Photo upload (right now `photos` is just a list of URLs you'd paste in —
   real image upload needs file storage like Cloudinary or S3).
4. Payments, hosting, and the other production items noted in the Phase 1 README.

---

## Phase 3 — Member-facing: search, detail, real booking

### Browse (public, no login needed)
- `GET /api/gyms?city=Bengaluru` — list gyms, optionally filtered by city
- `GET /api/gyms/:id?date=2026-07-25` — gym detail + that date's slots + reviews
- `POST /api/gyms/:id/reviews` — leave a review (members only) — `{ rating: 1-5, text }`

### Booking (members only)
- `POST /api/bookings` — `{ slotId }` → books it, returns a `bookingCode`.
  Capacity-safe: if the slot is full, you get a clear 409 error instead of
  overbooking.
- `GET /api/bookings/me` — your own booking history

## Full end-to-end test (owner creates a slot, member books it)

```
# --- As the owner (reuse the owner token from Phase 2) ---
curl http://localhost:3000/api/gyms/mine/slots?date=2026-07-25 -H "Authorization: Bearer OWNER_TOKEN"
# copy a slot's "id" from the response, or create one first (see Phase 2 test 4)

# --- As a member: sign up, verify, then search ---
curl -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" ^
  -d "{\"email\":\"member@example.com\",\"name\":\"Vish\",\"role\":\"member\"}"
curl -X POST http://localhost:3000/api/auth/verify-otp -H "Content-Type: application/json" ^
  -d "{\"email\":\"member@example.com\",\"code\":\"123456\"}"
# save the returned token as MEMBER_TOKEN

curl "http://localhost:3000/api/gyms?city=Delhi"
curl "http://localhost:3000/api/gyms/GYM_ID?date=2026-07-25"

# --- Book the slot ---
curl -X POST http://localhost:3000/api/bookings -H "Content-Type: application/json" ^
  -H "Authorization: Bearer MEMBER_TOKEN" -d "{\"slotId\":\"SLOT_ID\"}"

# --- Back as the owner: today's bookings should now show this member ---
curl "http://localhost:3000/api/gyms/mine/bookings/today?date=2026-07-25" -H "Authorization: Bearer OWNER_TOKEN"
```

If that last call shows the member's booking, the full loop — owner opens a
slot, member finds and books it, owner sees it on their dashboard — is
working end to end.

## What's real vs what's next (updated)

**✅ Done — the whole core loop works:**
- Email OTP auth (members + owners), referral code capture
- Gym owner: profile, slots, today's bookings, previous customers
- Member: search, gym detail with reviews, capacity-safe booking, booking history

**⏳ Still needed before this is genuinely production-ready:**
1. **Wire the QuickFit4u app screens** to these endpoints (Home, Find a Gym,
   Gym Detail, and a new Owner Dashboard set of screens — that's Phase 4).
2. **Payments** — bookings are currently free; add Razorpay before real money changes hands.
3. **Photo upload** — `photos` is just a list of URLs right now; real upload
   needs Cloudinary/S3.
4. **Gym verification** — anyone can currently sign up as an owner and list
   a gym with zero proof it's real. Needs a manual or automated KYC step.
5. **Hosting + secrets** — deploy on Render/Railway with `.env` values set
   as that platform's environment variables, not committed to git.
6. **Production email** — swap personal Gmail SMTP for a transactional
   service (Brevo/SendGrid/SES) once past testing.

---

## Phase 5 — Razorpay payments + gym location

### Setup
1. Sign up at https://dashboard.razorpay.com (free). Test mode works
   immediately, no business verification needed.
2. Settings → API Keys → Generate Test Key. Copy the Key ID and Key Secret
   into `.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. `npm install` again (adds the `razorpay` package).
4. Restart the server.

### What changed
- `POST /api/bookings` (direct, free booking) is replaced by a two-step flow:
  - `POST /api/bookings/create-order` — `{ slotId }` → creates a Razorpay
    order for `gym.hourlyRate` rupees, returns everything the app needs to
    open Razorpay Checkout.
  - `POST /api/bookings/verify-payment` — `{ razorpay_order_id,
    razorpay_payment_id, razorpay_signature, slotId }` → verifies the
    payment signature (so a fake/tampered success can't be forged), *then*
    creates the booking. If the slot filled up while payment was in
    progress, the payment still succeeded but the booking will fail — the
    response tells the app to advise the user to contact support for a
    refund. This is a known edge case worth improving later (e.g. holding
    the slot for a couple of minutes once checkout opens).
- Gyms now have `latitude`/`longitude` columns (existing databases are
  migrated automatically on server start — no need to delete `data/quickfit4u.db`).
  Owners set this from their phone via "Use my current location" when
  creating/editing their gym profile.

### Test payments
Razorpay test mode gives you fake cards — use:
- Card number: `4111 1111 1111 1111`, any future expiry, any CVV, any OTP (test mode
  accepts any OTP value). See https://razorpay.com/docs/payments/payments/test-card-upi-details/
  for the full list of test cards/UPI IDs.

## What's real vs what's next (updated)

**✅ Done:**
- Email OTP auth (members + owners) with referral codes
- Full gym owner dashboard (profile, slots, today's bookings, customers)
- Member search, gym detail with reviews and location map data, capacity-safe booking
- **Real Razorpay payment** before a booking is created (test mode)
- Gym latitude/longitude captured from the owner's phone

**⏳ Still needed:**
1. Refund handling for the "slot filled up mid-payment" edge case above.
2. Photo upload (still just a list of URLs).
3. Gym KYC/verification before a gym goes live publicly.
4. Switch Razorpay from test keys to live keys + go through Razorpay's KYC
   for real payouts, once you're ready to accept real money.
5. Hosting with secrets as environment variables, not a committed `.env`.
6. Production email service instead of personal Gmail SMTP.

---

## Phase 6 — Partnership agreement (owner e-signature)

A gym is now **hidden from public search and gym detail** until its owner
signs a partnership agreement with a typed name + drawn signature.

### What changed
- `gyms` table has three new columns: `agreement_signed_at`,
  `agreement_signed_name`, `agreement_signature_url` (migrated automatically).
- `GET /api/gyms` and `GET /api/gyms/:id` now only return gyms where
  `agreement_signed_at IS NOT NULL`. Unsigned gyms are invisible to members
  even if you have their exact gym ID.
- `GET /api/gyms/mine` (the owner's own view) is unaffected — an owner can
  always see and edit their own unsigned gym.
- New: `POST /api/gyms/mine/agreement` — body `{ signedName, signatureUrl }`
  — stamps the current timestamp and makes the gym publicly visible.

The signature image itself is uploaded straight from the app to Cloudinary
(same as gym photos) — the backend only stores the resulting URL, not the
raw image data.

### Test it
```
curl -X POST http://localhost:3000/api/gyms/mine/agreement ^
  -H "Content-Type: application/json" -H "Authorization: Bearer OWNER_TOKEN" ^
  -d "{\"signedName\":\"Rohan Sharma\",\"signatureUrl\":\"https://example.com/fake-sig.png\"}"

# Now this gym should appear in public search:
curl "http://localhost:3000/api/gyms?city=Delhi"
```

## What's real vs what's next (updated)

**✅ Done:**
- Full OTP auth, gym owner dashboard, member search/booking with Razorpay payment
- Gym photos (owner uploads via the app, Cloudinary-hosted)
- Gym location map data (lat/lng captured from owner's device)
- Partnership agreement gating — gyms are invisible to members until signed

**⏳ Still needed:**
1. Refund handling for the payment/capacity race condition (noted in Phase 5).
2. Gym KYC/verification beyond just a signature (e.g. a manual review step
   before a signed gym goes live, for real launch).
3. Downloadable PDF copy of the signed agreement for the owner's records.
4. Hosting + secrets, production email service (as before).
