-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Table: users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id), -- Linked to Supabase Auth
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('driver', 'host', 'admin')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(30) UNIQUE NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  stripe_customer_id VARCHAR(255),
  stripe_connect_account_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_email_format CHECK (email LIKE '%@%_%'),
  CONSTRAINT chk_phone CHECK (phone_number IS NOT NULL)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- 2. Table: parking_spaces
CREATE TABLE parking_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  address_line1 VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  postcode VARCHAR(20) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  hourly_rate_gbp DECIMAL(6, 2) NOT NULL,
  max_vehicle_size VARCHAR(50) NOT NULL CHECK (max_vehicle_size IN ('small', 'medium', 'large')),
  is_active BOOLEAN DEFAULT false,
  live_intent_status VARCHAR(50) DEFAULT 'offline' CHECK (live_intent_status IN ('offline', 'leaving_soon', 'available_now')),
  live_intent_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_hourly_rate CHECK (hourly_rate_gbp >= 0.00)
);

CREATE INDEX idx_parking_location ON parking_spaces USING GIST (location);
CREATE INDEX idx_host_spaces ON parking_spaces(host_id);
CREATE INDEX idx_active_live ON parking_spaces(is_active, live_intent_status);

-- Enable RLS
ALTER TABLE parking_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active spaces"
ON parking_spaces FOR SELECT
USING (is_active = true OR auth.uid() = host_id);

CREATE POLICY "Hosts can insert their own spaces"
ON parking_spaces FOR INSERT
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their own spaces"
ON parking_spaces FOR UPDATE
USING (auth.uid() = host_id);


-- 3. Table: bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parking_space_id UUID NOT NULL REFERENCES parking_spaces(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending_hold' CHECK (status IN ('pending_hold', 'confirmed', 'active', 'completed', 'cancelled', 'disputed')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  total_amount_gbp DECIMAL(8, 2) NOT NULL,
  platform_fee_gbp DECIMAL(8, 2) NOT NULL,
  host_payout_gbp DECIMAL(8, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_booking_times CHECK (end_time > start_time),
  CONSTRAINT chk_amounts CHECK (total_amount_gbp >= 0)
);

CREATE INDEX idx_bookings_driver ON bookings(driver_id);
CREATE INDEX idx_bookings_space ON bookings(parking_space_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookings"
ON bookings FOR SELECT
USING (auth.uid() = driver_id OR auth.uid() IN (SELECT host_id FROM parking_spaces WHERE id = parking_space_id));

CREATE POLICY "Drivers can create bookings"
ON bookings FOR INSERT
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Involved parties can update bookings"
ON bookings FOR UPDATE
USING (auth.uid() = driver_id OR auth.uid() IN (SELECT host_id FROM parking_spaces WHERE id = parking_space_id));


-- 4. Table: payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  amount_gbp DECIMAL(8, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'gbp',
  status VARCHAR(50) DEFAULT 'requires_capture' CHECK (status IN ('requires_capture', 'succeeded', 'refunded', 'failed')),
  refund_amount_gbp DECIMAL(8, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_intent ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
ON payments FOR SELECT
USING (auth.uid() IN (SELECT driver_id FROM bookings WHERE id = booking_id) OR auth.uid() IN (SELECT host_id FROM parking_spaces WHERE id IN (SELECT parking_space_id FROM bookings WHERE id = booking_id)));


-- 5. Table: reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewee_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_reviews_booking ON reviews(booking_id);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are public"
ON reviews FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create reviews"
ON reviews FOR INSERT
WITH CHECK (auth.uid() = reviewer_id);


-- 6. Table: notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  deep_link VARCHAR(255),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);


-- 7. Table: disputes
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  raised_by_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved_refund', 'resolved_charge', 'dismissed')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_booking ON disputes(booking_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- Enable RLS
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties can view disputes"
ON disputes FOR SELECT
USING (auth.uid() = raised_by_id OR auth.uid() IN (SELECT driver_id FROM bookings WHERE id = booking_id) OR auth.uid() IN (SELECT host_id FROM parking_spaces WHERE id IN (SELECT parking_space_id FROM bookings WHERE id = booking_id)));

CREATE POLICY "Involved parties can raise disputes"
ON disputes FOR INSERT
WITH CHECK (auth.uid() = raised_by_id);