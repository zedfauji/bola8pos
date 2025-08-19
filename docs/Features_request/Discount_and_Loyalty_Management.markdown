# Discount and Loyalty Management — Billiard POS System

## Overview
Implement this entity as a complete subsystem with its own dedicated dashboard, routes, backend services, and modular components. This subsystem oversees discounts, customer loyalty programs, point systems, redemptions, promotions, and customer profiling to enhance retention and personalize experiences.

## Features
- **Discount CRUD**:
  - **Create Discount**: Form with code generation, type (percent/fixed), value, scope, expiry, min_spend, and usage limits (e.g., once per customer). Explicit: Audience targeting (e.g., new customers only); stackable toggle.
  - **List Discounts**: Table with status indicators (active/expired), usage stats (redeemed count), and filters (type, scope). Explicit: Bulk activation/deactivation; export usage logs.
  - **Update Discount**: Edit with version history; notify affected customers on changes.
  - **Delete Discount**: Revoke from open bills; archive for reports.
- **Customer Profiles**:
  - **CRUD Profiles**: Detailed form for name, contact, preferences (e.g., favorite table), and tags (e.g., "VIP"). Explicit: Import from CSV with deduplication; merge duplicates by phone/email.
  - **Tier Management**: Auto-calculate tiers based on points/spending; manual overrides with notes. Explicit: Benefits preview per tier (e.g., gold: 10% off time).
  - **History Tracking**: Timeline of visits, purchases, redemptions; search within profile.
- **Loyalty Program**:
  - **Points System**: Award rules (e.g., 1 point/$1, bonus for referrals); manual adjustments with reason. Explicit: Point multipliers for events (e.g., double on birthdays); decay rules (lose 10% after inactivity).
  - **Redemptions**: Browseable catalog with search; redeem workflow with confirmation. Edge case: Partial point use; refund points on cancellations.
  - **Promotions**: Campaign builder for targeted offers (e.g., "Free hour for 5 visits"); scheduling and A/B testing.
- **Additional Functionalities**:
  - **Customer Segmentation**: Groups by tier, visit frequency; bulk promotions.
  - **Feedback Integration**: Link to post-redemption surveys; adjust points based on NPS.
  - **Analytics**: Redemption rates, ROI on discounts, customer lifetime value.
- **Edge Cases**:
  - Expiry Handling: Auto-deactivate discounts/expire points; grace periods.
  - Fraud Prevention: Limit redemptions per day; flag suspicious patterns.
  - Bulk Operations: Mass point awards; import loyalty history.
  - Internationalization: Spanish prompts; MXN for values.
  - Security: PIN for manual adjustments; anonymize data in exports.

## Main Page
Clicking on the Discount and Loyalty Management entity in the main POS navigation opens a whole new subsystem dashboard. This dashboard features customer stats (total members, average points), discount usage chart, and redemption leaderboard. It includes a sidebar for sub-modules (Customers, Discounts, Rewards, Promotions, Analytics), quick customer search with profile preview, and customizable widgets (e.g., top tiers pie). The dashboard is responsive, with dark mode, and customer-centric views (e.g., loyalty card simulator).

## Endpoints
- `GET /api/discounts?active={1}&scope={scope}` (list with stats).
- `POST /api/discounts` (create with targeting).
- `POST /api/customers/:id/points` (award with multipliers).
- `POST /api/customers/:id/redeem` (process with catalog).
- `GET /api/customers/stats?segment={tier}` (advanced summaries).
- `POST /api/promotions` (campaign creation).

## Integrations
- **Payment Subsystem**: Apply discounts/redemptions in bills.
- **Reporting Subsystem**: Track usage and ROI.
- **Order Subsystem**: Award points on completions.
- **Customer Integrations**: Sync with external CRM.

## Acceptance Criteria
- Discounts apply with rules; redemptions deduct points.
- Tiers update on awards; promotions schedule correctly.
- Dashboard stats real-time; searches fast.

## Artifacts
- `pos/frontend/src/subsystems/loyalty/Dashboard.jsx` (stats and widgets).
- `pos/frontend/src/subsystems/loyalty/CustomerProfiles.jsx` (CRUD and history).
- `pos/frontend/src/subsystems/loyalty/Discounts.jsx` (CRUD and usage).
- `pos/frontend/src/subsystems/loyalty/Rewards.jsx` (catalog and redemptions).
- `pos/backend/src/subsystems/loyalty/routes.js` (dedicated routes).
- `pos/backend/src/subsystems/loyalty/controller.js` (extended logic).