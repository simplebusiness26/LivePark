# LivePark: Comprehensive Technical Specification

**Author:** Staff Software Engineer & Principal Solutions Architect (Manus AI)  
**Date:** August 7, 2026  
**Status:** Approved for Engineering Execution  
**Target Platform:** iOS & Android (Mobile-First Marketplace) & Administrative Web Panel  

---

## 1. Overall Architecture

### High-Level Architecture
LivePark is engineered as a highly scalable, real-time, two-sided marketplace connecting urban drivers with property hosts who possess temporarily vacant parking spaces. The system architecture adheres to a modern client-server model supported by event-driven microservices, real-time WebSocket communication channels, and geospatial indexing. 

```
┌────────────────────────────────────────────────────────┐
│                   Client Applications                  │
│  ┌──────────────────────┐   ┌──────────────────────┐   │
│  │ Driver App (iOS/And) │   │  Host App (iOS/And)  │   │
│  └──────────┬───────────┘   └──────────┬───────────┘   │
└─────────────┼──────────────────────────┼───────────────┘
              │ HTTPS / WSS              │ HTTPS / WSS
              ▼                          ▼
┌────────────────────────────────────────────────────────┐
│               API Gateway & Load Balancer              │
│                     (AWS ALB / Nginx)                  │
└─────────────┬──────────────────────────┬───────────────┘
              │                          │
              ▼                          ▼
┌──────────────────────────┐ ┌──────────────────────────┐
│   REST API Microservice  │ │ Real-Time WebSocket Svc  │
│      (Node.js / Express) │ │       (Node.js / WS)     │
└─────────────┬────────────┘ └──────────┬───────────────┘
              │                         │
              └───────────┬─────────────┘
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐
│ PostgreSQL 16 +  │             │   Redis Cluster  │
│     PostGIS      │             │  (Pub/Sub Cache) │
└──────────────────┘             └──────────────────┘
```

The system separates concerns across client mobile applications, an edge load balancer, stateless API nodes, real-time coordination workers, and persistent data stores. Geographically distributed clients communicate via encrypted HTTPS for RESTful CRUD operations and persistent WebSocket connections (WSS) for real-time map updates, booking locks, and chat notifications.

### Frontend Architecture
Both the Driver and Host mobile applications are built upon **React Native** with TypeScript, utilizing Expo managed workflows for rapid, cross-platform deployment. 
* **State Management:** Zustand is utilized for lightweight, high-performance global state management (user sessions, active bookings, real-time map filters), minimizing unnecessary re-renders during high-frequency GPS coordinate changes.
* **Geospatial Rendering:** The mapping layer integrates Mapbox GL native rendering engines, optimized for clustering thousands of active parking pins at 60 frames per second.
* **Offline Resilience:** TanStack Query (React Query) manages server-state caching, optimistic UI updates for booking actions, and offline request queuing for poor network connectivity zones.

### Backend Architecture
The backend is structured around modular Node.js microservices running TypeScript on containerized Docker runtimes orchestrated via AWS ECS (Fargate). 
* **API Service:** Handles authentication, user profile management, booking lifecycles, and payment orchestration.
* **Geospatial & Matching Engine:** Evaluates spatial queries, manages radius searches using PostGIS indexing, and coordinates the "Live Intent" broadcast state machine.
* **Worker Service:** Executes asynchronous background tasks, including automated payout generation, Stripe webhook processing, notification dispatches, and expired booking lock releases.

### API Architecture
LivePark exposes a versioned RESTful API (`/api/v1/...`) complemented by real-time WebSocket event streams. All REST endpoints enforce strict input validation via Zod schemas, JWT bearer token authorization, rate limiting, and structured JSON error responses.

### Authentication Flow
Authentication is managed via JSON Web Tokens (JWT). Users authenticate via email/password or OAuth (Apple/Google Sign-In). Upon successful authentication, the server issues a short-lived access token (15-minute expiration) and a secure, HttpOnly refresh token (7-day expiration) stored securely in device secure storage (Keychain/EncryptedSharedPreferences).

### Payment Flow
Payment processing is fully integrated with **Stripe**. The flow utilizes `PaymentIntent` with manual capture (`capture_method: manual`) during driver booking to secure a financial hold without immediate transfer. Funds are captured upon session start ("Arrived"), and host payouts are automated weekly via **Stripe Connect** split-destination transfers.

### Real-Time Update Flow
Real-time updates leverage Redis Pub/Sub combined with WebSocket namespaces. When a host triggers "Leaving Now", the event is published to a geospatial Redis channel. Connected drivers within the target geofenced bounding box instantly receive the payload, updating the local map view without manual page refreshes.

### Notification Flow
Multi-channel notifications (Push, SMS, Email) are orchestrated via an event-driven notification broker. Firebase Cloud Messaging (FCM) and Apple Push Notification service (APNs) deliver rich push notifications with interactive action buttons directly to user devices.

---

## Database

The MVP database is hosted on **PostgreSQL 16** with the **PostGIS** spatial extension enabled for high-performance geospatial indexing and radius searches.

### 1. Table: `users`
* **Purpose:** Stores core account credentials, roles, verification statuses, and metadata for drivers, hosts, and administrators.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `email` (VARCHAR(255), Unique, Not Null)
  * `password_hash` (VARCHAR(255), Nullable for OAuth users)
  * `role` (ENUM('driver', 'host', 'admin'), Not Null)
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
* **Constraints:** `chk_email_format` (email LIKE '%@%_%'), `chk_phone` (phone_number IS NOT NULL).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: Users can read their own profile; admins can read all profiles.
  * `UPDATE`: Users can update their own non-role fields; admins can update all fields.
* **Example Records:**
  ```json
  {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "eleanor.rigby@example.com",
    "password_hash": "$2b$10$e8...encrypted_hash...",
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
* **Purpose:** Stores physical driveway and parking bay details, geolocation coordinates, pricing, and availability states.
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
  * `live_intent_status` (ENUM('offline', 'leaving_soon', 'available_now'), Default: `offline`)
  * `live_intent_expires_at` (TIMESTAMPTZ, Nullable)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
  * `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `users(host_id)`. One-to-Many with `bookings`.
* **Indexes:** `idx_parking_location` USING GIST (location), `idx_host_spaces` (host_id), `idx_active_live` (is_active, live_intent_status).
* **Constraints:** `chk_hourly_rate` (hourly_rate_gbp >= 0.00).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: Publicly readable when `is_active = true` and `live_intent_status != 'offline'`; hosts can read their own spaces; admins read all.
  * `INSERT`/`UPDATE`: Hosts can manage their own spaces.
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
  * `status` (ENUM('pending_hold', 'confirmed', 'active', 'completed', 'cancelled', 'disputed'), Default: `pending_hold`)
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
  * `SELECT`: Drivers can view their own bookings; hosts can view bookings for their spaces; admins view all.
  * `INSERT`/`UPDATE`: Authenticated drivers can create bookings; system worker / hosts / admins can update status.
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
* **Purpose:** Records Stripe transaction intents, authorized holds, captured funds, refunds, and payout associations.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `booking_id` (UUID, Foreign Key referencing `bookings(id)`, Unique, Not Null)
  * `stripe_payment_intent_id` (VARCHAR(255), Unique, Not Null)
  * `amount_gbp` (DECIMAL(8, 2), Not Null)
  * `currency` (VARCHAR(3), Default: `'gbp'`)
  * `status` (ENUM('requires_capture', 'succeeded', 'refunded', 'failed'), Default: `requires_capture`)
  * `refund_amount_gbp` (DECIMAL(8, 2), Default: `0.00`)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
  * `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** One-to-One with `bookings`.
* **Indexes:** `idx_payments_intent` (stripe_payment_intent_id), `idx_payments_booking` (booking_id).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: Users can view payments for their own bookings; admins view all.
  * `INSERT`/`UPDATE`: Managed exclusively by backend worker via service role key.
* **Example Records:**
  ```json
  {
    "id": "e4ffbc99-9c0b-4ef8-bb6d-6bb9bd380e55",
    "booking_id": "c2ffbc99-9c0b-4ef8-bb6d-6bb9bd380c33",
    "stripe_payment_intent_id": "pi_3Mow42FP2V8HJ2eW1ABCdef",
    "amount_gbp": 7.00,
    "currency": "gbp",
    "status": "requires_capture",
    "refund_amount_gbp": 0.00,
    "created_at": "2026-08-07T13:55:01Z",
    "updated_at": "2026-08-07T13:55:01Z"
  }
  ```

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
  * `SELECT`: Publicly readable; users can read reviews about themselves.
  * `INSERT`: Drivers and hosts can insert reviews for completed bookings where they participated.
* **Example Records:**
  ```json
  {
    "id": "f5ffbc99-9c0b-4ef8-bb6d-6bb9bd380f66",
    "booking_id": "c2ffbc99-9c0b-4ef8-bb6d-6bb9bd380c33",
    "reviewer_id": "d3eebe99-9c0b-4ef8-bb6d-6bb9bd380d44",
    "reviewee_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "rating": 5,
    "comment": "Extremely smooth parking experience, very close to station!",
    "created_at": "2026-08-07T16:15:00Z"
  }
  ```

### 6. Table: `notifications`
* **Purpose:** Tracks in-app and push notification delivery logs and read states.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `user_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `title` (VARCHAR(200), Not Null)
  * `body` (TEXT, Not Null)
  * `deep_link` (VARCHAR(255), Nullable)
  * `is_read` (BOOLEAN, Default: `false`)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `users`.
* **Indexes:** `idx_notifications_user` (user_id, is_read).
* **Row Level Security (RLS) Policies:**
  * `SELECT`/`UPDATE`: Users can read and update their own notifications.
* **Example Records:**
  ```json
  {
    "id": "76ffbc99-9c0b-4ef8-bb6d-6bb9bd380777",
    "user_id": "d3eebe99-9c0b-4ef8-bb6d-6bb9bd380d44",
    "title": "Booking Confirmed",
    "body": "Your space at 42 Station Road is secured. Tap for navigation.",
    "deep_link": "livepark://booking/c2ffbc99-9c0b-4ef8-bb6d-6bb9bd380c33",
    "is_read": false,
    "created_at": "2026-08-07T13:55:02Z"
  }
  ```

### 7. Table: `disputes`
* **Purpose:** Manages overstay reports, cancellation disputes, and administrative resolution records.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `booking_id` (UUID, Foreign Key referencing `bookings(id)`, Not Null)
  * `raised_by_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `reason` (VARCHAR(100), Not Null)
  * `status` (ENUM('open', 'investigating', 'resolved_refund', 'resolved_charge', 'dismissed'), Default: `open`)
  * `admin_notes` (TEXT, Nullable)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
  * `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `bookings` and `users`.
* **Indexes:** `idx_disputes_status` (status), `idx_disputes_booking` (booking_id).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: Users can view disputes they raised; admins view and manage all disputes.
* **Example Records:**
  ```json
  {
    "id": "87ffbc99-9c0b-4ef8-bb6d-6bb9bd380888",
    "booking_id": "c2ffbc99-9c0b-4ef8-bb6d-6bb9bd380c33",
    "raised_by_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "reason": "Driver overstayed by 45 minutes blocking next reservation",
    "status": "open",
    "admin_notes": null,
    "created_at": "2026-08-07T16:50:00Z",
    "updated_at": "2026-08-07T16:50:00Z"
  }
  ```

### 8. Table: `payouts`
* **Purpose:** Records automated weekly host payout disbursements executed via Stripe Connect.
* **Fields & Data Types:**
  * `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
  * `host_id` (UUID, Foreign Key referencing `users(id)`, Not Null)
  * `stripe_transfer_id` (VARCHAR(255), Unique, Not Null)
  * `amount_gbp` (DECIMAL(8, 2), Not Null)
  * `status` (ENUM('pending', 'paid', 'failed'), Default: `pending`)
  * `payout_date` (TIMESTAMPTZ, Not Null)
  * `created_at` (TIMESTAMPTZ, Default: `NOW()`)
* **Relationships:** Many-to-One with `users(host_id)`.
* **Indexes:** `idx_payouts_host` (host_id), `idx_payouts_status` (status).
* **Row Level Security (RLS) Policies:**
  * `SELECT`: Hosts can view their own payouts; admins view all.
  * Managed by backend worker via service role key.
* **Example Records:**
  ```json
  {
    "id": "98ffbc99-9c0b-4ef8-bb6d-6bb9bd380999",
    "host_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "stripe_transfer_id": "tr_3Mow42FP2V8HJ2eW9XYZabc",
    "amount_gbp": 142.50,
    "status": "paid",
    "payout_date": "2026-08-03T01:00:00Z",
    "created_at": "2026-08-03T00:30:00Z"
  }
  ```

---

## APIs

### 1. Authentication Endpoints

#### `POST /api/v1/auth/signup`
* **Purpose:** Register a new user (driver or host).
* **Auth Requirement:** Public.
* **Request Body (JSON):**
  ```json
  {
    "email": "driver@example.com",
    "password": "SecurePassword123!",
    "role": "driver",
    "first_name": "Marcus",
    "last_name": "Vance",
    "phone_number": "+447700900123"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "status": "success",
    "data": {
      "user_id": "d3eebe99-9c0b-4ef8-bb6d-6bb9bd380d44",
      "email": "driver@example.com",
      "role": "driver",
      "access_token": "eyJhbGciOiJIUzI1Ni...",
      "refresh_token": "refresh_token_string..."
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Validation error (invalid email format or weak password).
  * `409 Conflict`: Email or phone number already registered.

#### `POST /api/v1/auth/login`
* **Purpose:** Authenticate user and issue tokens.
* **Auth Requirement:** Public.
* **Request Body (JSON):**
  ```json
  {
    "email": "driver@example.com",
    "password": "SecurePassword123!"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "user_id": "d3eebe99-9c0b-4ef8-bb6d-6bb9bd380d44",
      "access_token": "eyJhbGciOiJIUzI1Ni...",
      "refresh_token": "refresh_token_string..."
    }
  }
  ```
* **Error Responses:**
  * `401 Unauthorized`: Invalid credentials.

#### `POST /api/v1/auth/oauth`
* **Purpose:** Authenticate via Apple or Google Sign-In.
* **Auth Requirement:** Public.
* **Request Body (JSON):**
  ```json
  {
    "provider": "google",
    "id_token": "eyJhbGciOiJSUzI1Ni..."
  }
  ```
* **Success Response (200 OK):** Token bundle as above.
* **Error Responses:** `401 Unauthorized` (Token validation failed).

---

### 2. Parking Space CRUD & Live Intent Endpoints

#### `POST /api/v1/spaces`
* **Purpose:** Host creates a new parking space listing.
* **Auth Requirement:** Bearer Token (Host Role).
* **Request Body (JSON):**
  ```json
  {
    "title": "Driveway near stadium",
    "description": "Secure paved driveway.",
    "address_line1": "10 High Street",
    "city": "London",
    "postcode": "SW1 1AA",
    "latitude": 51.500000,
    "longitude": -0.120000,
    "hourly_rate_gbp": 4.00,
    "max_vehicle_size": "medium"
  }
  ```
* **Success Response (201 Created):** Returns created space object with `id` and `is_active: false`.
* **Error Responses:** `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`.

#### `GET /api/v1/spaces/nearby`
* **Purpose:** Drivers query available live parking spaces within a geographic bounding box or radius.
* **Auth Requirement:** Bearer Token (Driver Role).
* **Query Parameters:** `lat` (float), `lng` (float), `radius_meters` (integer, default 1000).
* **Success Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22",
        "title": "Secure Victorian Driveway",
        "latitude": 51.470020,
        "longitude": -0.165430,
        "hourly_rate_gbp": 3.50,
        "max_vehicle_size": "medium",
        "live_intent_status": "available_now",
        "distance_meters": 180
      }
    ]
  }
  ```
* **Error Responses:** `400 Bad Request`, `401 Unauthorized`.

#### `PATCH /api/v1/spaces/:id/live-intent`
* **Purpose:** Host triggers Live Intent status update ("Leaving Now", "Available Now", "Offline").
* **Auth Requirement:** Bearer Token (Host Role, Owner).
* **Request Body (JSON):**
  ```json
  {
    "live_intent_status": "available_now",
    "duration_hours": 3
  }
  ```
* **Success Response (200 OK):** Updated space object.
* **Error Responses:** `400 Bad Request`, `403 Forbidden`, `404 Not Found`.

---

### 3. Booking & Payment Endpoints

#### `POST /api/v1/bookings`
* **Purpose:** Driver initiates a booking and places a payment hold.
* **Auth Requirement:** Bearer Token (Driver Role).
* **Request Body (JSON):**
  ```json
  {
    "parking_space_id": "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380b22",
    "start_time": "2026-08-07T14:00:00Z",
    "end_time": "2026-08-07T16:00:00Z"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "status": "success",
    "data": {
      "booking_id": "c2ffbc99-9c0b-4ef8-bb6d-6bb9bd380c33",
      "status": "pending_hold",
      "total_amount_gbp": 7.00,
      "stripe_client_secret": "pi_3Mow..._secret_..."
    }
  }
  ```
* **Error Responses:** `400 Bad Request` (space already booked/unavailable), `402 Payment Required`.

#### `POST /api/v1/bookings/:id/arrive`
* **Purpose:** Driver confirms arrival, capturing the Stripe payment hold.
* **Auth Requirement:** Bearer Token (Driver Role).
* **Success Response (200 OK):** Booking status updated to `active`, payment captured.
* **Error Responses:** `400 Bad Request`, `404 Not Found`.

#### `POST /api/v1/bookings/:id/end`
* **Purpose:** Driver ends parking session, finalizing billing and releasing the bay.
* **Auth Requirement:** Bearer Token (Driver or Host Role).
* **Success Response (200 OK):** Booking status updated to `completed`.
* **Error Responses:** `400 Bad Request`, `404 Not Found`.

---

### 4. Review, Notification & Admin Endpoints

#### `POST /api/v1/reviews`
* **Purpose:** Submit a review for a completed booking.
* **Auth Requirement:** Bearer Token.
* **Request Body (JSON):**
  ```json
  {
    "booking_id": "c2ffbc99-9c0b-4ef8-bb6d-6bb9bd380c33",
    "rating": 5,
    "comment": "Great spot!"
  }
  ```
* **Success Response (201 Created):** Created review object.

#### `GET /api/v1/notifications`
* **Purpose:** Retrieve user notifications.
* **Auth Requirement:** Bearer Token.
* **Success Response (200 OK):** List of notification items.

#### `GET /api/v1/admin/metrics`
* **Purpose:** Retrieve platform liquidity and financial KPIs.
* **Auth Requirement:** Bearer Token (Admin Role).
* **Success Response (200 OK):**
  ```json
  {
    "status": "success",
    "data": {
      "total_active_hosts": 142,
      "daily_active_drivers": 1250,
      "gross_booking_value_gbp": 14250.00,
      "platform_revenue_gbp": 1710.00
    }
  }
  ```
* **Error Responses:** `403 Forbidden`.

---

## Real-Time System

### Live Intent Technical Workflow
1. **Host Action:** The host taps "Leaving Now" on the mobile application.
2. **API Execution:** The client dispatches a `PATCH /api/v1/spaces/:id/live-intent` request.
3. **Database & Cache Update:** The backend updates `parking_spaces` (`live_intent_status = 'available_now'`) in PostgreSQL and publishes a JSON event payload to the Redis geospatial channel (`spatial:updates`).
4. **WebSocket Broadcast:** The real-time microservice receives the Redis pub/sub message and broadcasts a `SPACE_AVAILABLE` WebSocket message to all connected driver clients within a 2-kilometer radius.
5. **UI Render:** Driver client apps receive the WebSocket event, adding the glowing pin to the Mapbox vector layer without requiring a manual refresh.

### Space Disappearance
When the host returns (detected via geofencing boundary re-entry or manual "End Session" tap), `live_intent_status` updates to `'offline'`, triggering a `SPACE_REMOVED` WebSocket broadcast that instantly removes the pin from driver maps.

### Booking Locks & Race Condition Prevention
To prevent double-booking when multiple drivers attempt to claim the same live space simultaneously:
* **Redis Distributed Lock:** When a driver taps "Book Now", the backend acquires a distributed lock (`SET lock:space:{id} {driver_id} NX PX 30000` with a 30-second TTL).
* **Database Transaction Isolation:** The booking creation runs inside a PostgreSQL serializable transaction checking for temporal overlap. If a lock or overlap conflict occurs, the transaction aborts instantly, returning a `409 Conflict` response to competing drivers.

---

## Payments

LivePark integrates **Stripe Connect** (Custom/Express accounts for hosts) and **Stripe PaymentIntents** for drivers.

* **Stripe Connect Onboarding:** Hosts complete an embedded Stripe Connect onboarding flow during registration to link their bank account for automated payouts.
* **Booking Hold:** When a driver books a space, a `PaymentIntent` is created with `capture_method: manual`. Funds are authorized and held on the driver's card.
* **Capture on Arrival:** When the driver taps "Arrived", the backend triggers `stripe.paymentIntents.capture(pi_id)`, transferring funds into the platform escrow account.
* **Weekly Automated Payouts:** Every Monday at 01:00 UTC, a background worker aggregates completed host earnings, calculates net payouts (deducting the 12% platform commission), and executes a Stripe Transfer to the host's connected bank account.
* **Refund Policy:** If a booking is cancelled within 2 minutes, or if the host cancels/space is unavailable, a full automated refund is issued via `stripe.refunds.create()`.
* **Overstay Billing:** If a driver overstays past their booking window by more than 15 minutes without extending, an automatic overstay fee (£10/hr prorated) is billed to the driver's stored payment method.

---

## Authentication

* **Sign-Up Flow:** Email/password registration triggers a verification email containing a secure cryptographic token. Accounts remain unverified until the confirmation link is clicked.
* **Login Flow:** Successful credentials verification issues a 15-minute JWT access token and a 7-day HttpOnly refresh token.
* **OAuth Integration:** Native Apple Sign-In and Google Sign-In exchange identity tokens for internal LivePark JWT sessions.
* **Password Reset:** Users request a reset via email; a timed (15-min expiry) secure reset token is dispatched.
* **Verification Protocols:** Hosts undergo identity checks (Stripe Identity) and address confirmation. Drivers require a verified email and valid payment method on file.
* **RBAC:** Strict Role-Based Access Control (Driver, Host, Admin) enforced via backend middleware.

---

## Maps

* **Live Pins:** Rendered via Mapbox GL markers containing custom SVG glowing indicators. Updated via WebSocket at 1-second intervals for active sessions.
* **Clustering:** Supercluster algorithm implemented on client and server sides to aggregate dense urban pins into cluster badges when zooming out below zoom level 14.
* **GPS Accuracy Handling:** Client-side Kalman filtering smooths erratic GPS coordinates, filtering out jitter when users are stationary.
* **Geofencing:** CoreLocation (iOS) and Geofencing API (Android) monitor host departure/arrival within a 100-meter residential perimeter.
* **Navigation Handoff:** Deep linking integration constructs universal URIs (`maps://apl?saddr=...&daddr=...` for Apple Maps, `google.navigation:q=...` for Google Maps).

---

## Notifications

| Notification Name | Recipient | Trigger Event | Message Content | Deep Link Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Booking Confirmed** | Driver | Successful payment hold | "Your space at {address} is secured. Tap for navigation." | `livepark://booking/{id}` |
| **Space Claimed** | Host | Driver books host driveway | "A driver has booked your driveway for {start_time}." | `livepark://host/bookings` |
| **Driver Arriving** | Host | Driver approaches geofence | "Your driver is arriving in 2 minutes." | `livepark://host/active` |
| **Overstay Warning** | Driver | Booking window expired + 10m | "Your parking session has ended. Please depart or extend." | `livepark://booking/{id}/extend` |
| **Weekly Payout** | Host | Monday payout execution | "Your weekly payout of £{amount} has been transferred." | `livepark://host/earnings` |

---

## Security

* **Fraud Prevention:** Device fingerprinting, velocity checks on bookings, and Stripe Radar integration block fraudulent accounts and payment abuse.
* **Input Validation:** All incoming REST payloads are rigorously validated using strict Zod server-side schemas.
* **Rate Limiting:** Redis-backed sliding window rate limiters restrict authentication endpoints (5 attempts/min) and search APIs (60 requests/min).
* **Encryption:** TLS 1.3 enforced for all data in transit; AES-256 for data at rest in PostgreSQL and encrypted Redis nodes.
* **GDPR Compliance:** Implements automated data minimization, a one-click right-to-erasure endpoint (`DELETE /api/v1/user`), and explicit consent management.
* **PCI Compliance:** Zero card data touches LivePark servers; all payment capture is handled via Stripe Elements tokenization.

---

## Error Handling

* **Network Loss During Booking:** Client queues offline mutation via React Query; prompts user to reconnect before finalizing state.
* **Payment Timeout:** If Stripe Gateway times out (>5s), transaction rolls back, releasing the spatial Redis lock and returning `504 Gateway Timeout`.
* **Host Cancels En Route:** Immediate push notification dispatched to driver, full automated refund issued, and alternative nearby spaces presented on map.
* **GPS Failure:** App falls back to last known valid coordinate and prompts user to manually input or confirm address.
* **Server Downtime / DB Failure:** Load balancer routes traffic to secondary read-replica; returns graceful `503 Service Unavailable` with retry-after header for write mutations.

---

## Scalability

LivePark is architected to scale smoothly across user milestones:
* **Database:** Scales from a single PostgreSQL primary instance to read-replicas with connection pooling (PgBouncer) and spatial partitioning by geographic region.
* **API:** Stateless Express containers scale horizontally behind AWS Application Load Balancers via Auto Scaling Groups.
* **Real-Time:** Redis Pub/Sub clusters scale horizontally across multi-node ElastiCache clusters.
* **Geospatial:** PostGIS spatial indexing (`GIST`) ensures $O(\log n)$ search performance even with 10M+ active listings.
* **Payments & Notifications:** Asynchronous worker queues (BullMQ on Redis) decouple payment capture and notification delivery from request-response cycles.

---

## Engineering Decisions

| Decision Area | Chosen Technology | Alternative Options | Rationale & Trade-offs Accepted |
| :--- | :--- | :--- | :--- |
| **Mobile Framework** | React Native (Expo) | Native iOS/Android (Swift/Kotlin) | Enables single-codebase velocity for solo founder execution while maintaining near-native 60fps mapping performance. |
| **Backend Runtime** | Node.js (TypeScript) | Python (FastAPI), Go | Unified language stack (TypeScript across frontend and backend) accelerates feature delivery; trade-off in raw CPU throughput accepted (mitigated via microservice scaling). |
| **Database & GIS** | PostgreSQL + PostGIS | MongoDB, MySQL | Unmatched geospatial indexing performance (`ST_DWithin`, `GIST`) combined with ACID transactional integrity for booking locks. |
| **Payment Gateway** | Stripe Connect | Adyen, Braintree | Industry-standard developer tooling, robust split-destination transfers, and seamless mobile SDK integration. |
| **Real-Time Protocol** | WebSockets (WSS) | SSE, Long Polling | Bidirectional real-time communication required for sub-500ms Live Intent updates and instant driver-host coordination. |
| **Infrastructure** | Containerized ECS (Fargate) | Serverless (Lambda), K8s | Avoids cold-start latency issues inherent in serverless while bypassing complex Kubernetes operational overhead. |
| **Mapping Engine** | Mapbox GL | Google Maps SDK | Superior vector styling customization, smooth 60fps clustering, and cost-effective pricing at scale. |
| **Push Notifications**| Firebase Cloud Messaging (FCM) | OneSignal | Direct native integration with APNs and FCM without third-party middleware overhead. |

---

## References

1. INRIX Research. *The Cost of Parking in the UK*. Economic Impact Report, 2024.
2. LivePark Vision Document. *Transforming Urban Mobility Through Real-Time Spatial Liquidity*. August 2026.
3. LivePark Market Validation Report. *Commercial Viability and Market Sizing for On-Demand Parking*. August 2026.
4. LivePark Product Requirements Document (PRD). *MVP Functional and Non-Functional Specifications*. August 2026.
