# LivePark: Comprehensive Mobile Application Design Specification

**Author:** Senior Product Designer & UX Architect (Manus AI)  
**Date:** August 7, 2026  
**Status:** Approved for Production UI/UX Implementation  
**Target Platform:** iOS & Android (React Native / Expo Cross-Platform)  
**Single Source of Truth:** LivePark Vision Document [1], Product Requirements Document (PRD) [2], and Technical Specification [3].

---

## 1. Executive Summary & Design Philosophy

LivePark is a revolutionary real-time, on-demand parking marketplace that connects urban drivers with homeowners and organizations possessing temporarily vacant parking spaces [1] [2]. Unlike legacy parking platforms that rely on rigid advance reservations and static directories, LivePark operates on ride-hailing principles, utilizing the proprietary **Live Intent** architecture to transform dormant real estate into liquid urban inventory [1] [3].

As the Senior Product Designer and UX Architect, this specification establishes the definitive design system, user flows, information architecture, navigation paradigms, and screen-by-screen wireframe layouts for the LivePark mobile application. Every component, micro-interaction, and architectural decision is engineered to achieve extreme speed, absolute simplicity, and emotional resonance—targeting a total booking latency of under 60 seconds [2] and an interface feel as polished as Uber, Airbnb, and Apple Maps.

> "LivePark becomes the operating system for unused parking, optimizing spatial utilization on a global scale through instantaneous, frictionless human intent." — Founder Vision [1]

---

## 2. Complete User Flows

The LivePark mobile application supports two distinct user personas—**Drivers** seeking immediate parking and **Hosts** monetizing idle driveways. Below is the end-to-end mapping of all user journeys, including decision points, error branches, and alternative paths.

### 2.1 Driver User Flow

```
[App Launch / Splash] 
       │
       ├─► [Authenticated?] ──(No)──► [Onboarding (3 Slides)] ──► [Sign Up / Login]
       │         │ (Yes)
       ▼         ▼
[Main Map Discovery (GPS Centered)]
       │
       ├─► [Filter Applied: Size / Price / Distance]
       │         │
       │         ▼
       ├─► [Tap Parking Pin] ──► [Bottom Sheet: Space Detail (Peek State)]
       │                                │
       │         ┌──────────────────────┴──────────────────────┐
       │         ▼ (Dismiss)                                   ▼ (Tap "Book Now")
       │   [Return to Map]                             [Booking Confirmation Modal]
       │                                                              │
       │                                              ┌───────────────┴───────────────┐
       │                                              ▼ (Confirm & Pay)               ▼ (Cancel / Timeout)
       │                                      [Stripe Payment Processing]     [Return to Map]
       │                                              │
       │                             ┌────────────────┴────────────────┐
       │                             ▼ (Success)                       ▼ (Declined / Error)
       │                    [Navigation Mode Active]            [Payment Error Modal]
       │                             │
       │                             ▼
       │                    [Arrived at Destination] ──► [Active Parking Session]
       │                                                              │
       │                                                              ▼
       │                                                    [End Session & Review]
       │                                                              │
       │                                                              ▼
       │                                                      [Return to Map]
```

#### Detailed Driver Flow Branches & Edge Cases:
* **Geolocation Failure Branch:** If GPS permissions are denied or unavailable during app launch, the map defaults to the center of the target launch city (e.g., London SW1) with a banner prompting location enablement. Users can also manually search locations via the top search bar.
* **Space Unavailable / Race Condition:** If another driver completes a booking for the selected pin during the 5-minute checkout hold, the system triggers an inline alert ("Space Just Claimed") and automatically highlights alternative pins within a 100-meter radius.
* **Overstay Branch:** If a driver exceeds the scheduled end time without extending, the system sends an automated push notification warning of overstay penalty tariffs and bills the stored payment method dynamically upon session closure.

### 2.2 Host User Flow

```
[App Launch / Splash]
       │
       ├─► [Authenticated?] ──(No)──► [Host Onboarding] ──► [Sign Up / Stripe Connect]
       │         │ (Yes)
       ▼         ▼
[Host Home Dashboard]
       │
       ├─► [No Spaces Registered?] ──► [Add Space Multi-Step Wizard] ──► [Admin Review Pending]
       │         │ (Spaces Active)
       ▼         ▼
[Prominent "Leaving Now" Action Button]
       │
       ├─► [Tap "Leaving Now"] ──► [Instant Broadcast State: "Available Now"]
       │                                    │
       │                                    ▼
       │                          [Monitor Active Booking View]
       │                                    │
       │                                    ▼
       │                          [Autonomous Return Detection / Manual Stop]
       │                                    │
       │                                    ▼
       │                          [Session Complete & Earnings Logged]
       │                                    │
       │                                    ▼
       │                          [View Earnings Dashboard & Payout History]
```

#### Detailed Host Flow Branches & Edge Cases:
* **Unverified Address Branch:** If an inputted driveway address cannot be verified via PostGIS geospatial boundary checks, the space creation wizard flags the entry for manual admin moderation, notifying Sarah (Admin) to review satellite imagery.
* **Premature Return Branch:** If a host returns home before the driver's booking window concludes, the host app displays an override prompt ("Returning Early?"), allowing the host to notify the active driver or request parking guidance without conflict.

---

## 3. Information Architecture (IA)

The information architecture is strictly partitioned into two independent application binaries or modular shells within the same codebase, ensuring zero cognitive overload for users operating in distinct roles.

### 3.1 Driver App Sitemap & Hierarchy
* **Level 1: Core Navigation (Bottom Tab Bar)**
  * **Map (Tab 1 - Default):** Live spatial discovery, search bar, filter chips, active session banner.
  * **Bookings (Tab 2):** Active session management, upcoming reservations, past booking history & receipts.
  * **Wallet & Payments (Tab 3):** Stored payment methods (Apple Pay, Google Pay, Cards), transaction ledger, promo codes.
  * **Profile & Settings (Tab 4):** Driver profile, vehicle management (size class, license plate), security, notification preferences, support.
* **Level 2: Overlays, Modals & Detail Views**
  * **Space Detail Bottom Sheet:** Host profile, rating, hourly rate, vehicle fit, house rules, photos, "Book Now" CTA.
  * **Checkout Modal:** Booking summary, duration selector, payment authorization.
  * **Navigation Overlay:** Turn-by-turn routing banner, destination ETA, "Arrived" action button.
  * **Review Modal:** 1–5 star interactive rating, tag selector, qualitative text input.

### 3.2 Host App Sitemap & Hierarchy
* **Level 1: Core Navigation (Bottom Tab Bar)**
  * **Home / Dashboard (Tab 1 - Default):** Primary "Leaving Now" control, active space status, quick metrics.
  * **Spaces (Tab 2):** List of registered driveways, add space wizard, schedule management, photo gallery.
  * **Earnings (Tab 3):** Financial ledger, gross vs. net revenue, weekly payout status, Stripe Connect integration.
  * **Profile & Settings (Tab 4):** Host identity verification, bank account details, safety settings, notifications.
* **Level 2: Overlays, Modals & Detail Views**
  * **Add Space Wizard (Multi-Step Modal):** Address input, map pin placement, photo upload (up to 4), vehicle size constraints, hourly pricing.
  * **Active Booking Monitor:** Real-time countdown timer of current vehicle occupying driveway, driver profile, emergency contact.
  * **Payout History View:** Itemized transfer records, bank deposit confirmation receipts.

---

## 4. Navigation Structure & Paradigms

LivePark enforces rigid navigation rules to maintain iOS-native and Android-adaptive fluency:

* **Tab Bar Persistence:** Bottom navigation bars remain persistent across primary Level 1 tabs, but automatically hide during active navigation mode, checkout flows, and full-screen modal presentations.
* **Navigation Patterns:**
  * **Stack Navigation:** Used for sequential drill-downs (e.g., Profile → Edit Details → Security Settings).
  * **Modal Presentation:** Used for transactional or interruptive flows (e.g., Booking Checkout, Add Space Wizard, Review Submission).
  * **Bottom Sheet Parallax:** Used for secondary contextual content over maps (e.g., Space Detail Sheet, Filter Sheet), allowing users to peek, half-expand, or full-expand without losing spatial context.
* **Deep Linking Destinations:** Supported via universal links (`livepark://map?space_id=...` and `livepark://booking/...`), enabling external SMS notifications or push alerts to route users directly to specific screens.
* **Back Navigation Rules:** Hardware back buttons on Android and edge-swipe gestures on iOS strictly follow navigation stack lifo (Last-In, First-Out) principles, except during active payment processing and booking holds where back navigation is disabled to prevent race conditions.

---

## 5. Comprehensive Screen Specifications

Below is the exhaustive inventory of every screen across both the Driver and Host applications, detailing purpose, user actions, UI components, navigation, edge cases, and error handling.

### 5.1 Driver App Screens

#### 1. Splash / Loading Screen (`ScreenID: D-01`)
* **Purpose:** Initialize app state, authenticate token session, and acquire initial GPS coordinates.
* **User Actions:** None (automatic transition).
* **UI Components:** Centered LivePark wordmark logo, subtle pulsing background gradient, indeterminate circular progress loader.
* **Navigation:** From App Cold Start ──► To Main Map (`D-04`) if authenticated, or Onboarding (`D-02`) if unauthenticated.
* **Edge Cases:** Slow network initialization or GPS timeout.
* **Error Handling:** If network fails after 5 seconds, display a full-screen retry card with offline caching fallback.

#### 2. Onboarding Carousel (`ScreenID: D-02`)
* **Purpose:** Educate new drivers on LivePark's real-time marketplace value proposition.
* **User Actions:** Swipe horizontally through 3 slides, tap "Skip" or "Get Started".
* **UI Components:** Full-bleed illustration/animation container, pagination dots indicator, bold headline typography, primary CTA button.
* **Navigation:** From Splash ──► To Sign Up (`D-03`) or Login.
* **Edge Cases:** Rapid swiping; carousel state must debounce touch events.
* **Error Handling:** N/A (local UI state).

#### 3. Sign Up & Login Screens (`ScreenID: D-03`)
* **Purpose:** Authenticate or register driver accounts securely.
* **User Actions:** Input email/password, tap OAuth buttons (Apple / Google), toggle password visibility, submit form.
* **UI Components:** Top back chevron, form header, floating-label text inputs, social auth pill buttons, primary action button, terms of service footer link.
* **Navigation:** From Onboarding ──► To Main Map (`D-04`) upon successful authentication.
* **Edge Cases:** Malformed email formatting, weak password input.
* **Error Handling:** Inline red helper text for validation errors; toast banner for server-side authentication failures ("Invalid credentials").

#### 4. Main Map Discovery (`ScreenID: D-04`) — *Core Driver Screen*
* **Purpose:** Display real-time available parking pins across an interactive vector map.
* **User Actions:** Pan/zoom map, tap filter chips, tap parking pins, tap search bar, trigger geolocation re-centering.
* **UI Components:** Full-screen Mapbox GL canvas, floating search bar at top, horizontal filter scroll chips below header, floating GPS re-centering FAB, bottom persistent status bar or peek sheet.
* **Navigation:** Leads to Space Detail Bottom Sheet (`D-05`), Search Modal, or Profile (`D-15`).
* **Edge Cases:** Zero spaces available in current bounding box; GPS signal loss.
* **Error Handling:** Toast alert ("GPS signal weak. Showing last known location."). Empty state overlay with expanded radius suggestion.

#### 5. Space Detail Bottom Sheet (`ScreenID: D-05`)
* **Purpose:** Present comprehensive details of a selected parking bay.
* **User Actions:** Drag sheet to half or full expansion, scroll photo gallery, read host reviews, tap "Book Now".
* **UI Components:** Drag handle, image carousel indicator, host avatar & star rating, pricing badge (£/hr), vehicle size compatibility badge, walk-time estimator, primary sticky "Book Now" button.
* **Navigation:** From Map Pin Tap ──► To Checkout Modal (`D-06`).
* **Edge Cases:** Space status changes to offline while sheet is open.
* **Error Handling:** Inline banner alert ("This space was just booked by another driver") with automatic dismissal and map refresh.

#### 6. Booking Confirmation & Checkout Modal (`ScreenID: D-06`)
* **Purpose:** Secure temporary hold and execute payment for the selected parking bay.
* **User Actions:** Select parking duration, review itemized total (hourly rate + platform fee), tap Apple Pay / Google Pay / Credit Card.
* **UI Components:** Modal sheet container, itemized fee breakdown table, payment method selector pill, biometric authorization prompt button ("Pay £7.00").
* **Navigation:** From Space Detail ──► To Navigation Mode (`D-08`) upon successful payment.
* **Edge Cases:** Payment card declined; 5-minute reservation timer expiration.
* **Error Handling:** Modal alert for payment failure with prompt to retry or switch payment method; automatic release of spatial hold upon timer expiry.

#### 7. Payment Processing Screen (`ScreenID: D-07`)
* **Purpose:** Execute Stripe `PaymentIntent` capture in the background.
* **User Actions:** None (system automated).
* **UI Components:** Lottie animation of secure lock / credit card processing, status text ("Securing your space...").
* **Navigation:** From Checkout ──► To Navigation Mode (`D-08`).
* **Edge Cases:** Network timeout during Stripe webhook callback.
* **Error Handling:** Automatic retry up to 3 times; fallback error modal with refund guarantee if charge succeeded but routing failed.

#### 8. Navigation Mode (`ScreenID: D-08`)
* **Purpose:** Guide driver directly to the host's precise coordinate via integrated routing.
* **User Actions:** View turn-by-turn directions, mute voice guidance, tap "Arrived" when reaching destination.
* **UI Components:** Simplified top instruction banner, estimated time of arrival (ETA) badge, prominent green "I Have Arrived" action button, native map overlay.
* **Navigation:** From Checkout Success ──► To Active Session (`D-09`) upon tapping "Arrived".
* **Edge Cases:** Driver rerouting due to missed turn.
* **Error Handling:** Dynamic route recalculation banner.

#### 9. Active Parking Session (`ScreenID: D-09`)
* **Purpose:** Monitor ongoing parking duration and provide session controls.
* **User Actions:** View elapsed time and cost accumulator, tap "Extend Session", tap "End Parking".
* **UI Components:** Full-screen or prominent banner view, live countdown timer, cost counter, secondary extension button, primary destructive/completion button ("End Parking").
* **Navigation:** From Arrival ──► To End Session (`D-10`).
* **Edge Cases:** Session exceeds initial booking window without extension.
* **Error Handling:** Automated warning push notification at T-5 minutes before expiration.

#### 10. End Session & Review Screen (`ScreenID: D-10`)
* **Purpose:** Finalize billing, release spatial lock, and capture feedback.
* **User Actions:** Review final itemized receipt, tap 1–5 star rating, select review tags (e.g., "Easy access", "Clean"), submit review, return to map.
* **UI Components:** Success checkmark animation, receipt card summary, interactive star rating component, tag chips, comment text input, "Done" primary button.
* **Navigation:** From Active Session ──► To Main Map (`D-04`).
* **Edge Cases:** User closes app before submitting review.
* **Error Handling:** Save review state locally; prompt on next app launch if unsubmitted.

#### 11. Booking History (`ScreenID: D-11`)
* **Purpose:** Provide historical log of past parking sessions and receipts.
* **User Actions:** Scroll past bookings, tap booking item to view full receipt, tap "Download PDF Receipt".
* **UI Components:** List view with date grouping, location title cards, total cost badges, receipt detail modal.
* **Navigation:** Accessible from Profile/Wallet tab ──► To Receipt Detail.
* **Edge Cases:** Empty history state.
* **Error Handling:** Empty state illustration ("No past parking sessions yet").

#### 12. Driver Profile & Settings (`ScreenID: D-12` to `D-14`)
* **Purpose:** Manage personal details, vehicle specifications, payment methods, and notification preferences.
* **User Actions:** Edit name, update vehicle size class (Small/Medium/Large), manage saved cards, toggle push notifications.
* **UI Components:** Grouped list settings table, avatar header, toggle switches, text input modals.
* **Navigation:** Accessible from Main Map top-left avatar icon.
* **Edge Cases:** Invalid vehicle license plate format.
* **Error Handling:** Inline validation errors.

---

### 5.2 Host App Screens

#### 1. Splash / Loading Screen (`ScreenID: H-01`)
* **Purpose:** Initialize host session and verify Stripe Connect payout linkage.
* **User Actions:** None.
* **UI Components:** Host-branded LivePark logo, loading indicator.
* **Navigation:** ──► To Dashboard (`H-04`) or Onboarding (`H-02`).
* **Edge Cases:** Expired authentication token.
* **Error Handling:** Redirect to Login screen.

#### 2. Host Onboarding (`ScreenID: H-02`)
* **Purpose:** Guide new property owners through value proposition and requirements.
* **User Actions:** Swipe introduction, tap "Register Property".
* **UI Components:** Carousel illustrations, primary CTA.
* **Navigation:** ──► To Sign Up / Stripe Connect (`H-03`).
* **Edge Cases:** N/A.
* **Error Handling:** N/A.

#### 3. Sign Up & Stripe Connect Integration (`ScreenID: H-03`)
* **Purpose:** Register host credentials and link bank payout account securely.
* **User Actions:** Enter account details, authorize Stripe Connect onboarding flow.
* **UI Components:** Secure input fields, Stripe OAuth redirect button.
* **Navigation:** ──► To Home Dashboard (`H-04`).
* **Edge Cases:** Stripe onboarding abandoned midway.
* **Error Handling:** Persistent banner prompting completion of financial linkage before space publication.

#### 4. Home Dashboard (`ScreenID: H-04`) — *Core Host Screen*
* **Purpose:** Provide immediate access to the primary "Leaving Now" action trigger and monitor live space status.
* **User Actions:** Tap **"Leaving Now"**, tap **"Leaving in X Minutes"**, view quick earnings summary, switch active spaces.
* **UI Components:** Top status bar, prominent glowing **"Leaving Now"** primary action button (occupying central focal point), secondary time dropdown selector, live status indicator pill, bottom summary cards for today's earnings.
* **Navigation:** Leads to Add Space Wizard (`H-05`), Active Booking View (`H-06`), or Earnings Dashboard (`H-07`).
* **Edge Cases:** Host attempts to trigger "Leaving Now" with zero verified spaces registered.
* **Error Handling:** Prompt modal directing host to complete Add Space Wizard first.

#### 5. Add Space Multi-Step Wizard (`ScreenID: H-05`)
* **Purpose:** Capture driveway address, spatial dimensions, photos, and pricing.
* **User Actions:** Input address, pin location on map, upload up to 4 photos, set max vehicle size (Small/Medium/Large), set hourly rate (£/hr), submit for review.
* **UI Components:** Step progress indicator bar, address autocomplete input, interactive map pin dropper, photo upload grid with camera shortcut, slider for hourly rate, primary "Submit Listing" button.
* **Navigation:** From Dashboard ──► To Dashboard (with Pending Moderation status).
* **Edge Cases:** Uploading oversized image files.
* **Error Handling:** Client-side image compression; inline error for missing mandatory fields or invalid address.

#### 6. Space Detail & Management (`ScreenID: H-05b`)
* **Purpose:** Edit existing driveway details, toggle availability, or delete listing.
* **User Actions:** Edit pricing, toggle listing active/inactive state, update photos.
* **UI Components:** Form fields, active toggle switch, photo management grid.
* **Navigation:** Accessible from Spaces tab.
* **Edge Cases:** Deleting a space with an active ongoing booking.
* **Error Handling:** Blocking modal alert ("Cannot delete space while an active booking is in progress").

#### 7. Active Booking View (`ScreenID: H-06`)
* **Purpose:** Monitor vehicle currently parked in the host's driveway in real time.
* **User Actions:** View driver name, vehicle make/model/license plate, remaining booking duration, emergency contact button.
* **UI Components:** Live status card, driver avatar and rating badge, countdown timer, vehicle detail chips, secondary support/report button.
* **Navigation:** Accessible from Dashboard notification banner.
* **Edge Cases:** Driver overstays allocated window.
* **Error Handling:** Automated alert banner ("Driver overstayed by X minutes. Overstay fee applied.").

#### 8. Earnings Dashboard (`ScreenID: H-07`)
* **Purpose:** Display comprehensive financial ledger, gross earnings, platform commission deductions, and net payouts.
* **User Actions:** Toggle time range (This Week, This Month, All Time), view payout history.
* **UI Components:** Large balance summary header card, weekly earnings bar chart, itemized transaction ledger list, "View Payout History" button.
* **Navigation:** Accessible from bottom tab bar.
* **Edge Cases:** Zero earnings state.
* **Error Handling:** Empty state illustration ("No earnings recorded yet. List your space and tap Leaving Now to start earning!").

#### 9. Payout History & Bank Details (`ScreenID: H-08`)
* **Purpose:** Track automated weekly Stripe Connect bank transfers.
* **User Actions:** View transfer receipts, update linked bank account via Stripe portal.
* **UI Components:** Transfer history list with status badges (Paid, Processing), secure external link button to Stripe Express dashboard.
* **Navigation:** Accessible from Earnings Dashboard.
* **Edge Cases:** Payout failure due to bank account update.
* **Error Handling:** Stripe error banner with link to re-verify bank credentials.

#### 10. Host Profile & Settings (`ScreenID: H-09` to `H-11`)
* **Purpose:** Manage host personal details, notification preferences, and account security.
* **User Actions:** Update phone number, toggle push alerts, contact support.
* **UI Components:** Standard settings lists, toggle switches.
* **Navigation:** Accessible from tab bar.
* **Edge Cases:** Network failure during profile update.
* **Error Handling:** Toast alert with retry option.

---

## 6. Wireframe Layout Descriptions

To guide UI designers and developers in exact layout construction, the following structured descriptions define the major screens using spatial wireframe models.

### 6.1 Driver Map Discovery Screen (`D-04`)
```
┌────────────────────────────────────────────────────────┐
│ [≡ Menu]    [Search Destination...         ] [○ Profile]│  <- Header Area
├────────────────────────────────────────────────────────┤
│ ( All )  ( < 200m )  ( ££ Max )  ( Med/Large )         │  <- Filter Chips
│                                                        │
│                                                        │
│                    [📍 £3.50]                          │
│                                                        │
│           📍 £4.00                                     │
│                     👤 [You]                           │
│          📍 £3.00                                      │
│                                                        │
│                                              [◎ GPS]   │  <- Floating FAB
├────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ ≡ 42 Station Road (200m away)          £3.50/hr    │ │  <- Peek Sheet
│ │ ⭐ 4.9 (42) • Fits Medium Sedan • 2 min walk       │ │     (Bottom Sheet)
│ └────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│ [ Map ]          [ Bookings ]    [ Wallet ]   [ Profile]│  <- Tab Bar
└────────────────────────────────────────────────────────┘
```

### 6.2 Host Home Dashboard (`H-04`)
```
┌────────────────────────────────────────────────────────┐
│ [🔔 Notifs]         LivePark Host            [⚙ Settings]│ <- Header Area
├────────────────────────────────────────────────────────┤
│                                                        │
│                   ACTIVE STATUS                        │
│                [ ● Offline / Ready ]                   │
│                                                        │
│                                                        │
│             ┌──────────────────────────────┐           │
│             │                              │           │
│             │         LEAVING NOW          │           │  <- Primary Action
│             │       [ Tap to Publish ]     │           │     Button (Pulsing)
│             │                              │           │
│             └──────────────────────────────┘           │
│                                                        │
│           Scheduling: [ Leaving in 15 mins ▼ ]         │
│                                                        │
├────────────────────────────────────────────────────────┤
│ TODAY'S SUMMARY                                        │
│ ┌──────────────────────┐  ┌──────────────────────────┐ │
│ │ Gross: £24.50        │  │ Active Spaces: 1 / 1     │ │  <- Summary Cards
│ └──────────────────────┘  └──────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│ [ Dashboard ]    [ Spaces ]      [ Earnings ] [ Profile]│ <- Tab Bar
└────────────────────────────────────────────────────────┘
```

---

## 7. Design System & Visual Tokens

The LivePark design system establishes an uncompromising aesthetic standard blending iOS-native ergonomics with clean, modern fintech and marketplace polish.

### 7.1 Colour Palette
* **Primary Brand Color:** **LivePark Emerald** (`#00C853`) — Symbolizes green transit, availability, success, and trust. Used for primary CTAs, active map pins, and success states.
* **Secondary Brand Color:** **Deep Obsidian** (`#111827`) — Used for primary text, headers, and dark mode base containers.
* **Accent Color:** **Electric Cyan** (`#00B0FF`) — Used for interactive map elements, user location pulse, and secondary navigational highlights.
* **Semantic Colors:**
  * Success: `#00C853` (Green)
  * Warning: `#FFAB00` (Amber)
  * Error / Destructive: `#FF3D00` (Coral Red)
  * Info: `#2979FF` (Blue)
* **Neutral Greys (8-Step Scale):**
  * `Grey 100` (Background Light): `#F9FAFB`
  * `Grey 200` (Surface / Card): `#F3F4F6`
  * `Grey 300` (Border / Divider): `#E5E7EB`
  * `Grey 400` (Disabled Elements): `#9CA3AF`
  * `Grey 500` (Secondary Text): `#6B7280`
  * `Grey 600` (Primary Text Muted): `#4B5563`
  * `Grey 800` (Dark Mode Surface): `#1F2937`
  * `Grey 900` (Dark Mode Background): `#111827`
* **Map Pin States:**
  * Available Now: `#00C853` (Solid Emerald with white parking icon)
  * Leaving Soon: `#FFAB00` (Amber with clock badge)
  * Booked / Occupied: `#9CA3AF` (Greyed out)
  * Selected Pin: `#111827` (Dark Obsidian with glowing cyan halo ring)

### 7.2 Typography Scale (Inter / SF Pro Display)
* **H1 (Large Title):** 32pt / Line Height 38pt / Bold (Weight 700) / Tracking -0.5px
* **H2 (Section Header):** 24pt / Line Height 30pt / SemiBold (Weight 600) / Tracking -0.3px
* **H3 (Card Title):** 18pt / Line Height 24pt / SemiBold (Weight 600)
* **Body Large:** 16pt / Line Height 22pt / Regular (Weight 400)
* **Body Medium (Default):** 14pt / Line Height 20pt / Regular (Weight 400)
* **Caption / Metadata:** 12pt / Line Height 16pt / Medium (Weight 500)
* **Overline / Badge:** 10pt / Line Height 14pt / Bold (Weight 700) / Uppercase tracking +1.0px

### 7.3 Icon System
* **Style:** Outlined icons (2px stroke) for navigation and secondary actions; Filled icons for active tabs and status indicators.
* **Sizes:** 16pt (Caption), 20pt (Inline), 24pt (Standard UI), 32pt (Featured Action), 48pt (Empty State Hero).
* **Key Icons:** `parking-square`, `navigation-arrow`, `clock-timer`, `banknote-money`, `star-rating`, `car-sedan`, `shield-check`, `user-avatar`.

### 7.4 Buttons & Interactive Elements
* **Primary Button:** Height 56pt (Large) / 48pt (Medium), Border Radius 16pt (Squircle iOS style), Background `#00C853` (Default) transitioning to `#00B020` (Pressed), Text color `#FFFFFF` (Semibold 16pt).
* **Secondary Button:** Background `#F3F4F6`, Text color `#111827`, Border 1pt solid `#E5E7EB`.
* **Destructive Button:** Background `#FF3D00`, Text color `#FFFFFF`.
* **States:** Default, Hover (Web/Simulated), Pressed (95% scale spring animation), Disabled (Opacity 40%), Loading (Spinner replaces label text).

### 7.5 Cards & Bottom Sheets
* **Cards:** Border Radius 16pt, Background `#FFFFFF` (Light) / `#1F2937` (Dark), Elevation Shadow `0px 4px 12px rgba(0, 0, 0, 0.08)`.
* **Bottom Sheets:** Top Corners Border Radius 24pt, Spring physics damping ratio 0.85, 3 discrete snap points: Peek (15% screen height), Half (50%), Full (90%).

---

## 8. Animations, Micro-interactions & Accessibility

* **Micro-interactions:**
  * **Pin Pulsing:** Available map pins feature a subtle 1.5-second CSS/React Native Reanimated scale pulse (scale 1.0 to 1.15) with an opacity glow ring to convey real-time liveliness.
  * **"Leaving Now" Button:** Tapping the host's primary button triggers an immediate haptic feedback pulse (`Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`) followed by a satisfying checkmark morph animation.
  * **Star Rating Fill:** Tapping rating stars triggers a scale spring bounce effect with sequential color fills.
* **Accessibility (WCAG 2.1 AA Compliance):**
  * **Color Contrast:** All text-to-background contrast ratios exceed 4.5:1 (normal text) and 3:1 (large text).
  * **Touch Targets:** Minimum touch target dimensions strictly enforced at $48 \times 48\text{pt}$ across all buttons, chips, and map pins.
  * **Screen Readers:** Complete ARIA / AccessibilityLabel attributes mapped for VoiceOver (iOS) and TalkBack (Android), announcing spatial distance, pricing, and live intent status.
  * **Dynamic Type:** Full support for iOS Dynamic Type scaling without layout breaking.

---

## 9. Design Tokens (JSON Schema)

```json
{
  "spacing": {
    "xs": 4,
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
    "5xl": 48,
    "6xl": 64
  },
  "borderRadius": {
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 24,
    "full": 9999
  },
  "animationDuration": {
    "fast": 150,
    "normal": 300,
    "slow": 500
  },
  "animationEasing": {
    "spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    "easeInOut": "cubic-bezier(0.4, 0, 0.2, 1)"
  }
}
```

---

## 10. References

1. LivePark Startup Vision Document. (2026). *LivePark: Urban Mobility & Real-Time Parking Marketplace Vision*.
2. Product Requirements Document (PRD): LivePark MVP. (2026). *LivePark MVP Functional & Non-Functional Requirements*.
3. Comprehensive Technical Specification. (2026). *LivePark System Architecture, PostGIS Database Schema, and API Specifications*.
