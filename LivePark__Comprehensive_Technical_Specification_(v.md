# LivePark: Comprehensive Technical Specification (v2 - Solo Founder & Mobile-First Edition)

**Author:** Staff Software Engineer & Principal Solutions Architect (Manus AI)  
**Date:** August 7, 2026  
**Status:** Approved for Solo Founder Engineering Execution  
**Target Platform:** iOS & Android (React Native / Expo) & Supabase Managed Backend  

---

## 1. Overall Architecture

### High-Level Architecture
LivePark is engineered as a lean, highly responsive, real-time two-sided marketplace connecting urban drivers with property hosts who possess temporarily vacant parking spaces [1] [2]. To accommodate the operational realities of a solo founder with no initial venture funding building primarily from mobile workflows, the architecture entirely eliminates self-managed infrastructure, container orchestrators, custom microservices, and message brokers in favor of a fully managed **Supabase-centric backend**. 

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Applications                        │
│          ┌──────────────────────────────────────────┐           │
│          │ Driver / Host Mobile App (React Native)  │           │
│          └──────────────┬──────────────────┬────────┘           │
└─────────────────────────┼──────────────────┼────────────────────┘
                          │                  │
           Supabase JS SDK│                  │ Supabase Edge Functions
           (PostgREST/WSS)│                  │ (TypeScript/Deno)
                          ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Supabase Cloud Platform                   │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Supabase Auth & RLS  │  │ PostgreSQL 16 + PostGIS         │  │
│  └──────────┬───────────┘  └───────────────┬─────────────────┘  │
│             │                              │                    │
│             └──────────────┬───────────────┘                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Supabase Realtime (WebSocket Broadcasts & Postgres Changes)│  │
│  └─────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTPS / Webhooks
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       External Services                         │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │     Stripe API       │  │ Firebase Cloud Messaging (FCM)  │  │
│  └──────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

The system architecture collapses traditional multi-tier server deployments into client-direct database interactions secured by PostgreSQL Row Level Security (RLS), auto-generated PostgREST APIs, Supabase Realtime WebSocket subscriptions, and serverless Deno Edge Functions for sensitive orchestration (Stripe webhooks, payment holds, push notifications).

### Frontend Architecture
Both the Driver and Host mobile applications are developed using **React Native with Expo** and TypeScript, enabling rapid cross-platform deployment via Expo Application Services (EAS) and Over-The-Air (OTA) updates.
* **State Management:** Zustand provides lightweight, high-performance global state management for user sessions, active booking lifecycles, and real-time map filter preferences, avoiding unnecessary re-renders during high-frequency GPS position updates.
* **Server State & Caching:** TanStack Query (React Query) manages server-state caching, optimistic UI updates for booking actions, and offline request queuing for transient network connectivity zones.
* **Geospatial Mapping:** React Native Mapbox GL renders vector maps optimized for clustering thousands of active parking pins at 60 frames per second.

### Backend Architecture
Supabase serves as the **entire backend**, replacing custom Node.js/Express servers, Docker containers, AWS ECS clusters, Redis nodes, and Nginx reverse proxies.
* **PostgreSQL & PostGIS:** Manages relational data and executes geospatial spatial queries (`ST_DWithin`, spatial indexing).
* **Supabase Auth:** Handles user registration, JWT issuance, and OAuth integrations.
* **Supabase Storage:** Stores high-resolution parking space photos and user verification documents.
* **Supabase Realtime:** Broadcasts live availability changes and spatial updates directly to connected driver clients via WebSockets.
* **Supabase Edge Functions:** Executes server-side TypeScript (Deno) logic for payment orchestration, Stripe webhooks, scheduled jobs, and push notification dispatch.

### API Architecture
LivePark utilizes two primary API interfaces:
1. **Direct Client-to-Database via PostgREST:** The mobile app queries and mutates tables directly using the `@supabase/supabase-js` client SDK. Security is strictly enforced at the database layer via PostgreSQL Row Level Security (RLS) policies.
2. **Serverless Edge Functions:** Complex, privileged operations (Stripe payment holds, webhook processing, push notifications, administrative actions) are routed to secure Deno Edge Functions deployed on Supabase infrastructure.

### Authentication Flow
Authentication is managed entirely through **Supabase Auth**. Users authenticate via email/password or OAuth (Apple and Google Sign-In). Supabase issues secure JSON Web Tokens (JWT) containing user UUIDs and role claims. The Supabase client SDK automatically manages token storage in device secure storage (Keychain / EncryptedSharedPreferences) and handles automatic token refreshing.

### Payment Flow
Payment processing is fully integrated with **Stripe Connect**. When a driver initiates a booking, a Supabase Edge Function creates a Stripe `PaymentIntent` with manual capture (`capture_method: manual`), securing a financial hold on the driver's card without immediate transfer. Upon arrival confirmation, the Edge Function captures the funds. Host payouts are automated weekly via Stripe Connect split transfers managed by scheduled Edge Functions.

### Real-Time Update Flow
Real-time updates leverage **Supabase Realtime**. When a host taps "Leaving Now", the mobile app updates the `live_intent_status` column in the `parking_spaces` table. Supabase Realtime detects the database mutation via PostgreSQL replication slots and instantly broadcasts a WebSocket message to all subscribed driver clients within the target geographic bounding box.

### Notification Flow
Multi-channel push notifications are orchestrated via Supabase Edge Functions interacting directly with the **Firebase Cloud Messaging (FCM) HTTP v1 API** for Android and **Apple Push Notification service (APNs)** for iOS devices, delivering rich interactive notifications directly to user devices.

---

## 2. Database

The database is hosted on **PostgreSQL 16** with the **PostGIS** spatial extension enabled for high-performance geospatial indexing and radius searches.

### 1. Table: `users`
* **Purpose:** Stores core account credentials, roles, verification statuses, and metadata for drivers, hosts, and administrators. Linked directly to Supabase Auth `auth.users`.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, References `auth.users(id)`)
  * `email` (VARCHAR(255), Unique, Not Null)
  * `role` (ENUM('driver', 'host', 'admin'), Not Null, Default: `'driver'`)
  * `first_name` (VARCHAR(100), Not Null)
  * `last_name` (VARCHAR(100), Not Null)
  * `phone_number` (VARCHAR(30), Unique, Not Null)
  * `is_verified` (BOOLEAN, Default: `false`)
  * `stripe_customer_id` (VARCHAR(255), Nullable)
  * `stripe_connect_account_id` (VARCHAR(255), Nullable)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
  * `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** One-to-Many with `parking_spaces`, `bookings`, `reviews`, `notifications`, `disputes`.
* **Indexes:** `idx_users_email` (email), `idx_users_role` (role).
* **Constraints:** `chk_email_format` (email LIKE '%@%_%').
* **Row Level Security (RLS) Policies:**
  * `SELECT`: `CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (auth.uid() = id OR (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'));`
  * `UPDATE`: `CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);`
  * `INSERT`: `CREATE POLICY "System inserts profile on signup" ON users FOR INSERT WITH CHECK (auth.uid() = id);`
* **Example Records:**
  ```json
  {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "eleanor.rigby@example.com",
    "role": "host",
    "first_name": "Eleanor",
    "last_name": "Rigby",
    "phone_number": "+447700900077",
    "is_verified": true,
    "stripe_customer_id": null,
    "stripe_connect_account_id": "acct_1Mow42FP2V8HJ2eW",
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-01T10:00:00Z"
  }
  ```

### 2. Table: `parking_spaces`
* **Purpose:** Stores physical driveway details, geolocation coordinates, pricing, and live availability states.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `host_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `title` (VARCHAR(150), Not Null)
  * `description` (TEXT, Nullable)
  * `address_line1` (VARCHAR(255), Not Null)
  * `city` (VARCHAR(100), Not Null)
  * `postcode` (VARCHAR(20), Not Null)
  * `latitude` (DECIMAL(10, 8), Not Null)
  * `longitude` (DECIMAL(11, 8), Not Null)
  * `location` (GEOGRAPHY(Point, 4326), Not Null)
  * `hourly_rate_gbp` (DECIMAL(6, 2), Not Null)
  * `max_vehicle_size` (ENUM('small', 'medium', 'large'), Not Null)
  * `is_active` (BOOLEAN, Default: `false`)
  * `live_intent_status` (ENUM('offline', 'leaving_soon', 'available_now'), Default: `'offline'`)
  * `live_intent_expires_at` (TIMESTAMPTZ, Nullable)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
  * `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `users(host_id)`. One-to-Many with `bookings`.
* **Indexes:** `idx_parking_location` USING GIST (location), `idx_host_spaces` (host_id), `idx_active_live` (is_active, live_intent_status).
* **Constraints:** `chk_hourly_rate` (hourly_rate_gbp >= 0.00).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: `CREATE POLICY "Public can view active live spaces" ON parking_spaces FOR SELECT USING (is_active = true AND live_intent_status != 'offline' OR auth.uid() = host_id);`
  * `INSERT`/`UPDATE`: `CREATE POLICY "Hosts manage own spaces" ON parking_spaces FOR ALL USING (auth.uid() = host_id);`
* **Example Records:**
  ```json
  {
    "id": "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22",
    "host_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "title": "Secure Victorian Driveway Near Station",
    "description": "Spacious off-street driveway, 2 min walk to commuter rail.",
    "address_line1": "42 Station Road",
    "city": "London",
    "postcode": "SW11 1AA",
    "latitude": 51.470020,
    "longitude": -0.165430,
    "location": "0101000020E61000003D0AD7A3705DC0BFC17C5B52BE534A40",
    "hourly_rate_gbp": 3.50,
    "max_vehicle_size": "medium",
    "is_active": true,
    "live_intent_status": "available_now",
    "live_intent_expires_at": "2026-08-07T18:00:00Z",
    "created_at": "2026-08-01T10:30:00Z",
    "updated_at": "2026-08-07T08:00:00Z"
  }
  ```

### 3. Table: `bookings`
* **Purpose:** Manages the lifecycle of parking reservations, spatial locks, temporal windows, and financial totals.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `parking_space_id` (UUID, Foreign Key referencing `parking_spaces(id)`, Not Null)
  * `driver_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `status` (ENUM('pending_hold', 'confirmed', 'active', 'completed', 'cancelled', 'disputed'), Default: `'pending_hold'`)
  * `start_time` (TIMESTAMPTZ, Not Null)
  * `end_time` (TIMESTAMPTZ, Not Null)
  * `total_amount_gbp` (DECIMAL(8, 2), Not Null)
  * `platform_fee_gbp` (DECIMAL(8, 2), Not Null)
  * `host_payout_gbp` (DECIMAL(8, 2), Not Null)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
  * `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `parking_spaces` and `users(driver_id)`. One-to-One with `payments`. One-to-Many with `reviews` and `disputes`.
* **Indexes:** `idx_bookings_driver` (driver_id), `idx_bookings_space` (parking_space_id), `idx_bookings_status` (status).
* **Constraints:** `chk_booking_times` (end_time > start_time), `chk_amounts` (total_amount_gbp >= 0).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: `CREATE POLICY "Users view own bookings" ON bookings FOR SELECT USING (auth.uid() = driver_id OR auth.uid() IN (SELECT host_id FROM parking_spaces WHERE id = parking_space_id));`
  * `INSERT`: `CREATE POLICY "Drivers create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = driver_id);`
  * `UPDATE`: `CREATE POLICY "Participants update bookings" ON bookings FOR UPDATE USING (auth.uid() = driver_id OR auth.uid() IN (SELECT host_id FROM parking_spaces WHERE id = parking_space_id));`
* **Example Records:**
  ```json
  {
    "id": "c2ffbc99-9c0b-4ef8-bb6d-6bb9bd380c33",
    "parking_space_id": "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22",
    "driver_id": "d3eebe99-9c0b-4ef8-bb6d-6bb9bd380d44",
    "status": "confirmed",
    "start_time": "2026-08-07T14:00:00Z",
    "end_time": "2026-08-07T16:00:00Z",
    "total_amount_gbp": 7.00,
    "platform_fee_gbp": 0.84,
    "host_payout_gbp": 6.16,
    "created_at": "2026-08-07T13:55:00Z",
    "updated_at": "2026-08-07T13:55:05Z"
  }
  ```

### 4. Table: `payments`
* **Purpose:** Records Stripe transaction intents, authorized holds, captured funds, and refunds.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `booking_id` (UUID, Foreign Key referencing `bookings(id)`, Unique, Not Null)
  * `stripe_payment_intent_id` (VARCHAR(255), Unique, Not Null)
  * `amount_gbp` (DECIMAL(8, 2), Not Null)
  * `currency` (VARCHAR(3), Default: `'gbp'`)
  * `status` (ENUM('requires_capture', 'succeeded', 'refunded', 'failed'), Default: `'requires_capture'`)
  * `refund_amount_gbp` (DECIMAL(8, 2), Default: `0.00`)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
  * `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** One-to-One with `bookings`.
* **Indexes:** `idx_payments_intent` (stripe_payment_intent_id), `idx_payments_booking` (booking_id).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: `CREATE POLICY "Users view own booking payments" ON payments FOR SELECT USING (auth.uid() IN (SELECT driver_id FROM bookings WHERE id = booking_id));`
  * `ALL`: Restricted to Supabase service role key (Edge Functions).

### 5. Table: `reviews`
* **Purpose:** Stores bidirectional ratings (1–5 stars) and qualitative feedback between drivers and hosts.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `booking_id` (UUID, Foreign Key referencing `bookings(id)`, Unique, Not Null)
  * `reviewer_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `reviewee_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `rating` (INTEGER, Not Null)
  * `comment` (TEXT, Nullable)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `bookings` and `users`.
* **Indexes:** `idx_reviews_reviewee` (reviewee_id), `idx_reviews_booking` (booking_id).
* **Constraints:** `chk_rating_range` (rating BETWEEN 1 AND 5).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: Publicly readable.
  * `INSERT`: `CREATE POLICY "Participants create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);`

### 6. Table: `notifications`
* **Purpose:** Logs in-app notification history and delivery statuses.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `user_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `title` (VARCHAR(255), Not Null)
  * `body` (TEXT, Not Null)
  * `deep_link` (VARCHAR(255), Nullable)
  * `is_read` (BOOLEAN, Default: `false`)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `users`.
* **Indexes:** `idx_notifications_user` (user_id, is_read).
* **Row Level Security (RLS) Policies:**
  * `SELECT`/`UPDATE`: `CREATE POLICY "Users manage own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);`

### 7. Table: `disputes`
* **Purpose:** Tracks overstay infractions, cancellations, and customer support disputes.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `booking_id` (UUID, Foreign Key referencing `bookings(id)`, Not Null)
  * `reporter_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `reason` (VARCHAR(100), Not Null)
  * `status` (ENUM('open', 'investigating', 'resolved_refunded', 'resolved_charged', 'closed'), Default: `'open'`)
  * `admin_notes` (TEXT, Nullable)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
  * `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `bookings` and `users`.
* **Indexes:** `idx_disputes_status` (status).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: Users view own disputes; admins view all.
  * `INSERT`: Users create disputes for own bookings.

### 8. Table: `payouts`
* **Purpose:** Records weekly Stripe Connect host payout disbursements.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `host_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `stripe_transfer_id` (VARCHAR(255), Unique, Not Null)
  * `amount_gbp` (DECIMAL(8, 2), Not Null)
  * `status` (ENUM('pending', 'paid', 'failed'), Default: `'pending'`)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `users(host_id)`.
* **Indexes:** `idx_payouts_host` (host_id).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: Hosts view own payouts; admins view all.

---

## 3. APIs

### Supabase Client SDK Calls (Direct Table Access via PostgREST)
The React Native app queries Supabase directly using `@supabase/supabase-js`, leveraging RLS for data isolation.

| Operation | SDK Query Example | Purpose |
| :--- | `supabase.from('parking_spaces').select('*').eq('is_active', true).neq('live_intent_status', 'offline')` | Fetch active live parking spaces |
| **Search (Spatial)** | `supabase.rpc('get_nearby_spaces', { lat: 51.47, lng: -0.16, radius_meters: 1500 })` | PostGIS radius search |
| **User Profile** | `supabase.from('users').select('*').eq('id', userId).single()` | Fetch user profile |
| **Booking History** | `supabase.from('bookings').select('*, parking_spaces(*)').eq('driver_id', userId)` | Retrieve driver booking logs |

### Supabase Edge Functions (Deno / TypeScript)
Server-side business logic and third-party integrations are executed via serverless Edge Functions.

#### 1. `create-booking`
* **Trigger:** Invoked via HTTP POST from client SDK when driver taps "Book Now".
* **Purpose:** Validates space availability, acquires database lock, creates Stripe PaymentIntent with manual capture, and inserts booking record.
* **Input (JSON):** `parking_space_id`, `start_time`, `end_time`
* **Output (JSON):** `booking_id`, `stripe_client_secret`, `total_amount_gbp`
* **Error Handling:** Returns `409 Conflict` if space is locked/booked; `400 Bad Request` on validation failure.

#### 2. `capture-payment`
* **Trigger:** Invoked when driver taps "Arrived".
* **Purpose:** Calls Stripe API to capture authorized payment and updates booking status to `active`.
* **Input (JSON):** `booking_id`
* **Output (JSON):** `status: "success"`, `captured_at`

#### 3. `stripe-webhook`
* **Trigger:** Webhook HTTP POST from Stripe servers.
* **Purpose:** Listens to `payment_intent.succeeded`, `account.updated`, and transfer events, updating database records accordingly.

#### 4. `process-weekly-payouts`
* **Trigger:** Scheduled cron job (Supabase `pg_cron` calling Edge Function every Monday at 01:00 UTC).
* **Purpose:** Aggregates completed host earnings, deducts 12% commission, and executes Stripe Connect transfers.

#### 5. `send-push-notification`
* **Trigger:** Internal database webhook or function call.
* **Purpose:** Dispatches push notifications to iOS and Android devices via FCM HTTP v1 API.

---

## 4. Real-Time System

### Live Intent Technical Workflow
1. **Host Action:** The host taps "Leaving Now" on the mobile application.
2. **Client Mutation:** The app executes `supabase.from('parking_spaces').update({ live_intent_status: 'available_now' }).eq('id', spaceId)`.
3. **PostgreSQL Replication & Realtime:** Supabase Realtime detects the PostgreSQL WAL (Write-Ahead Log) update and broadcasts a `UPDATE` event over active WebSocket connections.
4. **Driver Client Broadcast:** Driver apps subscribed to the geographic bounding box receive the WebSocket payload instantly, rendering the glowing pin on the Mapbox vector layer without requiring a manual refresh.

### Geographic Subscriptions & Spatial Filtering
Driver clients subscribe to Supabase Realtime channels filtered by PostGIS bounding boxes or radius queries. When the map viewport changes, the client unsubscribes from the previous channel and subscribes to the new coordinate bounding box.

### Space Disappearance
When the host returns (detected via geofencing boundary re-entry or manual "End Session" tap), `live_intent_status` updates to `'offline'`, triggering an immediate WebSocket broadcast that removes the pin from driver maps.

### Database-Level Booking Locks & Race Condition Prevention
To prevent double-booking when competing drivers attempt to claim the same live space simultaneously without relying on Redis:
* **PostgreSQL Row-Level Locking (`SELECT ... FOR UPDATE`):** Within the `create-booking` Edge Function, the database transaction executes:
  ```sql
  SELECT * FROM parking_spaces WHERE id = $1 FOR UPDATE NOWAIT;
  ```
* If another transaction holds the lock, the query throws an immediate serialization error, preventing race conditions.
* **Temporal Overlap Exclusion:** PostgreSQL exclusion constraints ensure no two overlapping confirmed bookings can exist for the same `parking_space_id`.

---

## 5. Payments

LivePark integrates **Stripe Connect Express** for hosts and **Stripe PaymentIntents** for drivers, managed entirely via Supabase Edge Functions.

* **Stripe Connect Onboarding:** Hosts complete hosted onboarding via Stripe Connect Express links generated by an Edge Function (`/create-connect-account`).
* **Booking Hold:** When a driver books a space, an Edge Function creates a `PaymentIntent` with `capture_method: manual`. Funds are authorized and held on the card.
* **Capture on Arrival:** When the driver taps "Arrived", an Edge Function triggers `stripe.paymentIntents.capture()`, transferring funds into the platform holding account.
* **Weekly Payouts:** Every Monday at 01:00 UTC, a scheduled Edge Function aggregates completed host earnings, deducts the 12% platform fee, and executes a Stripe Transfer.
* **Refunds & Overstays:** Cancellations within 2 minutes trigger automated refunds via `stripe.refunds.create()`. Overstays exceeding 15 minutes trigger automated prorated charges (£10/hr) against the driver's stored payment method.

---

## 6. Authentication

* **Supabase Auth Setup:** Configured with email/password authentication, Apple Sign-In, and Google Sign-In.
* **JWT Management:** Handled automatically by `@supabase/supabase-js`, storing tokens securely in device secure storage.
* **Password Reset:** Managed via Supabase built-in auth reset emails (`supabase.auth.resetPasswordForEmail()`).
* **Verification & RBAC:** Host verification status is stored in the `users` table. Administrative privileges are enforced via custom JWT claims (`app_metadata: { role: 'admin' }`) verified in RLS policies.

---

## 7. Maps

* **Mapbox GL Rendering:** React Native Mapbox GL renders vector maps with custom SVG glowing pins.
* **Real-Time Pins:** Updated dynamically via Supabase Realtime WebSocket subscriptions.
* **Clustering:** Client-side `Supercluster` algorithm aggregates dense urban pins into cluster badges when zooming out below zoom level 14.
* **PostGIS Radius Search:** Spatial queries use PostGIS `ST_DWithin` functions to query spaces within user radius:
  ```sql
  SELECT * FROM parking_spaces 
  WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_meters)
    AND is_active = true AND live_intent_status != 'offline';
  ```
* **Navigation Handoff:** Deep linking constructs universal URIs (`maps://?q=lat,lng` for Apple Maps, `google.navigation:q=lat,lng` for Google Maps, `waze://?ll=lat,lng&navigate=yes` for Waze).

---

## 8. Notifications

| Notification Name | Recipient | Trigger Event | Message Content | Deep Link Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Booking Confirmed** | Driver | Successful payment hold | "Your space at {address} is secured. Tap for navigation." | `livepark://booking/{id}` |
| **Space Claimed** | Host | Driver books host driveway | "A driver has booked your driveway for {start_time}." | `livepark://host/bookings` |
| **Driver Arriving** | Host | Driver approaches geofence | "Your driver is arriving in 2 minutes." | `livepark://host/active` |
| **Overstay Warning** | Driver | Booking window expired + 10m | "Your parking session has ended. Please depart or extend." | `livepark://booking/{id}/extend` |
| **Weekly Payout** | Host | Monday payout execution | "Your weekly payout of £{amount} has been transferred." | `livepark://host/earnings` |

*Delivery Mechanism:* Supabase Edge Function calls Firebase Cloud Messaging (FCM) HTTP v1 API.

---

## 9. Security

* **Supabase RLS:** Primary security layer enforcing tenant isolation and role permissions at the PostgreSQL level.
* **Input Validation:** Zod schema validation enforced in Supabase Edge Functions and client forms.
* **Rate Limiting:** Supabase built-in API rate limiting combined with Edge Function IP rate limiting.
* **Encryption:** TLS 1.3 enforced for data in transit; AES-256 for data at rest managed by Supabase.
* **GDPR Compliance:** Automated data deletion RPC functions for right-to-erasure compliance (`DELETE /api/v1/user` equivalent).
* **PCI Compliance:** Zero card data touches LivePark servers; all payment capture is handled via Stripe Mobile SDKs and Stripe Elements tokenization.

---

## 10. Error Handling

* **Network Loss During Booking:** React Native client queues offline mutations; prompts user to reconnect before finalizing state.
* **Payment Timeout:** If Stripe Gateway times out (>5s), transaction rolls back, releasing database locks and returning `504 Gateway Timeout`.
* **Host Cancels En Route:** Immediate push notification dispatched to driver, full automated refund issued via Edge Function, and alternative nearby spaces presented on map.
* **GPS Failure:** App falls back to last known valid coordinate and prompts user to manually confirm address.
* **Server Downtime:** Supabase managed infrastructure automatically handles failover and scaling with built-in redundancy.

---

## 11. Scalability (MVP Tier)

Supabase handles growth across user milestones efficiently:
* **Supabase Pro Plan:** Supports up to 100,000 monthly active users, dedicated database resources, and daily automated backups.
* **Connection Pooling:** Supavisor connection pooler handles concurrent client connections without exhausting PostgreSQL backend limits.
* **Realtime Limits:** Supabase Realtime scales to handle concurrent WebSocket connections and broadcasts across active urban clusters.
* **PostGIS Indexing:** GIST spatial indexes (`idx_parking_location`) ensure $O(\log n)$ query performance even with 100,000+ active listings.

---

## 12. Future Enterprise Architecture

When LivePark transitions out of the solo founder MVP phase, specific technological migrations will occur as scaling thresholds are crossed.

| Evolution Area | Trigger Point | Target Enterprise Technology | Migration Strategy | Cost / Benefit Trade-off |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API Layer** | Custom SQL complexity exceeds Edge Function limits (>10k requests/min) | Node.js (NestJS) / Go microservices on AWS ECS (Fargate) | Extract Edge Functions incrementally into microservices | Eliminates serverless execution timeouts; increases operational overhead. |
| **Caching & Pub/Sub** | Real-time WebSocket subscriptions exceed Supabase Realtime limits (>15k concurrent) | Dedicated Redis Cluster (AWS ElastiCache) | Introduce Redis layer between PostgreSQL and custom WebSocket servers | Sub-10ms pub/sub broadcast speed; higher infrastructure cost. |
| **Database Scaling** | Write throughput exceeds single primary PostgreSQL capacity | Distributed PostgreSQL (Citus) or AWS RDS Multi-AZ with Read Replicas | Read-replica offloading for search queries; sharding by geographic region | Infinite horizontal read scalability; increased database architecture complexity. |
| **Queue Management** | Background job processing exceeds `pg_cron` capacity | BullMQ on Redis / AWS SQS with worker nodes | Migrate scheduled tasks and payment workers to dedicated worker containers | Robust job retries and concurrency control; dedicated server management required. |

---

## 13. Engineering Decisions

| Decision Area | Chosen Technology | Alternative Options | Rationale & Trade-offs Accepted |
| :--- | :--- | :--- | :--- |
| **Backend Architecture** | Supabase (Baas) | Custom Node.js/Express, AWS ECS | Eliminates infrastructure management entirely, allowing a solo founder to ship a production-ready backend in days instead of months. Trade-off: vendor lock-in accepted. |
| **Mobile Framework** | React Native (Expo) | Native Swift/Kotlin | Enables single-codebase cross-platform velocity for a solo founder building from mobile/laptop. Trade-off: marginal performance loss compared to native code. |
| **Database & GIS** | PostgreSQL + PostGIS | MongoDB, MySQL | Unmatched geospatial indexing performance (`ST_DWithin`, `GIST`) combined with ACID transactional integrity for booking locks. |
| **Payment Gateway** | Stripe Connect | Adyen, Braintree | Industry-standard developer tooling, robust split-destination transfers, and seamless mobile SDK integration. |
| **Real-Time Protocol** | Supabase Realtime | Custom WebSocket Server (Socket.io) | Zero server maintenance; real-time database replication out of the box without managing WebSocket connection pools. |
| **Server-Side Logic** | Supabase Edge Functions | AWS Lambda, Express Server | Serverless Deno functions eliminate server provisioning while executing secure Stripe webhooks and notifications. |
| **Task Scheduling** | Supabase `pg_cron` | Celery, BullMQ + Redis | Database-native cron execution avoids managing separate worker infrastructure for weekly payouts. |

---

## References

1. INRIX Research. *The Cost of Parking in the UK*. Economic Impact Report, 2024.
2. LivePark Vision Document. *Transforming Urban Mobility Through Real-Time Spatial Liquidity*. August 2026.
3. LivePark Market Validation Report. *Commercial Viability and Market Sizing for On-Demand Parking*. August 2026.
4. LivePark Product Requirements Document (PRD). *MVP Functional and Non-Functional Specifications*. August 2026.
