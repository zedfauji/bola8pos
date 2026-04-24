---
title: Data Model — All Schema Changes
status: locked
---

# Data Model

Complete list of schema changes across the 8 sprints. Each change names the sprint that owns its migration. Run `npx supabase gen types typescript --local > src/shared/lib/supabase.types.ts` after every migration and update Zod schemas in `src/shared/lib/domain.ts`.

## Legend

- ➕ new column
- 🆕 new table
- 🔄 altered column / constraint
- 🗑️ dropped
- 🔍 view
- ⚡ trigger / function
- 🔐 RLS policy

---

## S1 — Foundation

### categories
- ➕ `parent_id uuid null references categories(id)` (hierarchical tree)
- ⚡ trigger `categories_depth_check` — recursive CTE enforces **max depth 3**
- 🔐 RLS unchanged (read all, write admin)

### products
- ➕ `combo_eligible boolean not null default true` — if false, cannot be added as combo slot option
- ➕ `is_combo boolean not null default false`

### modifier_groups 🆕
```
id uuid pk
name text not null
min_select int not null default 0
max_select int not null default 1
is_required boolean not null default false
sort_order int not null default 0
```

### modifier_group_items 🆕
```
group_id uuid fk modifier_groups(id) on delete cascade
modifier_id uuid fk modifiers(id) on delete cascade
sort_order int not null default 0
primary key (group_id, modifier_id)
```

### product_modifier_groups 🆕
```
product_id uuid fk products(id)
group_id uuid fk modifier_groups(id)
sort_order int
primary key (product_id, group_id)
```

### inventory_log → stock_movements (rename + extend)
- 🔄 rename table `inventory_log` → `stock_movements`
- 🔄 `reason` enum extended: add `prep_production | prep_consumption | combo_component | refund`
- ➕ `ref_type text` — `order_item | refund | prep_production | manual | physical_count`
- ➕ `ref_id uuid` — polymorphic reference
- ➕ `ingredient_id uuid null` — null for product-level rows (existing), set for recipe depletion
- 🔐 Keep existing RLS; append-only enforced at RPC layer (no UPDATE/DELETE grants)

### payments
- 🗑️ drop constraint `payments.tab_id isOneToOne` — one tab may have multiple payments (sub-tabs / split evenly)

---

## S2 — Combos

### combo_slots 🆕
```
id uuid pk
combo_product_id uuid fk products(id) on delete cascade
slot_type text not null check (slot_type in ('product','pool_time'))
label text not null                        -- e.g. "Pick beer type"
min_qty int not null default 1
max_qty int not null default 1
default_child_product_id uuid null fk products(id)
pool_minutes int null                      -- set when slot_type='pool_time'
sort_order int not null
```

### combo_slot_options 🆕
```
slot_id uuid fk combo_slots(id) on delete cascade
child_product_id uuid fk products(id)
sort_order int
primary key (slot_id, child_product_id)
```
- ⚡ trigger `combo_slot_options_no_nesting` — reject insert if `child.is_combo = true` (enforces N2)
- ⚡ trigger `combo_slot_options_require_eligible` — reject if `child.combo_eligible = false`

### combo_availability 🆕
```
id uuid pk
combo_product_id uuid fk products(id) on delete cascade
days_of_week smallint[] not null           -- ISO 1=Mon..7=Sun
start_time time null                       -- null = all day
end_time time null
valid_from date null
valid_to date null
```
- Multiple rows = union (any match = available)
- No rows = always available
- ⚡ function `is_combo_available(combo_id, ts timestamptz) returns boolean` — used by add-to-tab RPC

### products
- ➕ `combo_price_override numeric(10,2) null` — set on parent combo product for bundle discount pricing

### order_items
- ➕ `parent_order_item_id uuid null references order_items(id) on delete cascade`
- ➕ `combo_slot_id uuid null references combo_slots(id)` — which slot this child satisfies

### pool_sessions
- ➕ `prepaid_minutes int not null default 0` — set when created from a combo pool_time slot
- ➕ `source_order_item_id uuid null fk order_items(id)` — traces back to the combo purchase

### product_combo_usage 🔍
```sql
create view product_combo_usage as
select distinct
  cso.child_product_id as product_id,
  p.id as combo_product_id,
  p.name as combo_name
from combo_slot_options cso
join combo_slots cs on cs.id = cso.slot_id
join products p on p.id = cs.combo_product_id
where p.is_combo = true;
```

### audit_log 🆕 (if not already present)
```
id uuid pk
actor_id uuid fk profiles(id)
action text not null                       -- 'combo_availability_override', 'refund_approved', etc.
ref_type text, ref_id uuid
reason text
ts timestamptz default now()
```

---

## S3a — Ingredients

### ingredients 🆕
```
id uuid pk
name text not null
uom text not null                          -- base unit: 'g','ml','unit','portion'
purchase_uom text null                     -- unit bought in (e.g. 'kg','bottle')
purchase_to_base_factor numeric not null default 1   -- 1 kg = 1000 g → factor 1000
cost_per_base_unit numeric(10,4) not null default 0
quantity_on_hand numeric not null default 0
reorder_point numeric null
is_prep boolean not null default false     -- see S3c
is_active boolean not null default true
category text null
created_at timestamptz default now()
updated_at timestamptz default now()
```

### stock_movements (extend again)
- ➕ ensure `ingredient_id` column (added in S1) is used; backfill old rows as product-level movements with `ingredient_id=null`

### RPC `record_stock_movement`
Signature:
```
record_stock_movement(
  p_ingredient_id uuid,
  p_delta numeric,
  p_reason text,
  p_ref_type text,
  p_ref_id uuid
) returns uuid
```
- atomic: inserts row + updates `ingredients.quantity_on_hand`
- refuses negative result unless `p_reason = 'correction'`

---

## S3b — Recipes

### recipes 🆕
```
product_id uuid pk fk products(id) on delete cascade
yield_qty numeric not null default 1       -- how many servings this recipe produces
notes text null
updated_at timestamptz
```

### recipe_items 🆕
```
id uuid pk
recipe_product_id uuid fk recipes(product_id) on delete cascade
ingredient_id uuid fk ingredients(id)
qty numeric not null                       -- in ingredient's base UOM, per 1 yield_qty
optional boolean not null default false
sort_order int
```

### RPC `deplete_for_order_item`
- Looks up recipe for `product_id`, for each `recipe_item` calls `record_stock_movement(ingredient_id, -qty * order_qty / yield_qty, 'sale', 'order_item', order_item_id)`
- Called from existing order-item insertion edge function (add to pipeline, do NOT create new edge function)
- Idempotent by `(ref_type, ref_id, ingredient_id)` unique index on `stock_movements` **for reason in ('sale','refund','void')**

---

## S3c — Prep & Cocktails

### prep_productions 🆕
```
id uuid pk
prep_ingredient_id uuid fk ingredients(id)  -- must have is_prep = true (CHECK via trigger)
qty_produced numeric not null
produced_by uuid fk profiles(id)
batch_cost numeric null                     -- optional snapshot
notes text null
ts timestamptz default now()
```
- ⚡ on insert: calls `record_stock_movement(prep_ingredient_id, +qty_produced, 'prep_production', 'prep_production', id)`
- ⚡ on insert: if prep itself has a recipe, consumes its ingredients via `record_stock_movement(..., -qty * recipe_qty, 'prep_consumption', 'prep_production', id)`

### ingredients
- Add CHECK: `is_prep = true` requires `uom = 'portion'` OR matching prep recipe exists

Cocktails = product + recipe with `is_prep=false` ingredients (and optionally `is_prep=true` sub-recipes like Michelada mix). **No separate table.**

---

## S4 — Split & Refund

### tabs
- ➕ `parent_tab_id uuid null references tabs(id) on delete cascade`
- ➕ `split_mode text null check (split_mode in ('item','evenly','by_person','by_amount'))`
- ➕ `split_label text null` — e.g. "Person 1", "Sub-check A"
- 🔄 index `(parent_tab_id)` for sub-tab lookup

### order_items
- Reassignable `tab_id` — already mutable; ensure RLS permits move between parent ↔ child tabs owned by same venue/user

### refunds 🆕
```
id uuid pk
original_payment_id uuid fk payments(id)
tab_id uuid fk tabs(id)
amount numeric(10,2) not null                -- always POSITIVE; sign implied by is_refund
reason text not null
actor_id uuid fk profiles(id)
manager_pin_approved_by uuid fk profiles(id)
ts timestamptz default now()
```

### refund_items 🆕
```
id uuid pk
refund_id uuid fk refunds(id) on delete cascade
order_item_id uuid fk order_items(id)
qty numeric not null
amount numeric(10,2) not null
restock boolean not null default false       -- reverse inventory?
```

### payments
- ➕ `is_refund boolean not null default false`
- ➕ `refund_id uuid null fk refunds(id)` — when is_refund=true

### RPC `process_refund`
- creates `refunds` + `refund_items` rows
- inserts a negative `payments` row linked to `refund_id`
- if any `refund_item.restock = true`: calls `deplete_for_order_item` with negative qty (reason='refund') to reverse ledger

---

## S5 — Waitlist

### waitlist_entries 🆕
```
id uuid pk
name text not null
phone_e164 text null                        -- validated via libphonenumber-js client-side
party_size smallint not null
status text not null check (status in ('waiting','notified','seated','no_show','left'))
quoted_wait_minutes int null
notified_at timestamptz null
notify_channel text null check (notify_channel in ('whatsapp','manager'))
seated_at timestamptz null
table_id uuid null fk pool_tables(id)
created_by uuid fk profiles(id)
created_at timestamptz default now()
updated_at timestamptz default now()
```

### waitlist_notifications 🆕 (audit of delivery attempts)
```
id uuid pk
waitlist_entry_id uuid fk waitlist_entries(id) on delete cascade
channel text                                 -- 'whatsapp','manager','tauri_native'
status text                                  -- 'sent','failed','delivered'
provider_message_id text null
error text null
ts timestamptz default now()
```

### Edge function `send-waitlist-notification`
- reads entry, selects channel based on `phone_e164` presence + feature flag
- calls WasenderAPI via HTTPS using secret from Supabase Vault
- writes `waitlist_notifications` row on every attempt

### ⚡ trigger `waitlist_status_notify`
- on `waitlist_entries.status` → `'notified'`, calls edge function asynchronously (via `pg_net` or Supabase realtime → client)

---

## S6 — Polish & Reports

### Views 🔍 (reporting)
- `combo_mix_daily(date, combo_product_id, qty_sold, net_revenue)`
- `recipe_variance_daily(date, ingredient_id, theoretical_used, physical_delta, variance)`
- `waitlist_metrics_daily(date, parties_seated, avg_quoted_wait, avg_actual_wait, no_show_rate)`

### Indexes (performance audit)
- `stock_movements(ingredient_id, ts desc)`
- `order_items(parent_order_item_id)`
- `order_items(tab_id, created_at)`
- `tabs(parent_tab_id)`
- `waitlist_entries(status, created_at)`

---

## Zod domain.ts additions (summary)

New schemas to add progressively, sprint by sprint:

```
S1:  CategoryTreeSchema, ModifierGroupSchema, ProductSchema extensions
S2:  ComboSlotSchema, ComboSlotOptionSchema, ComboAvailabilitySchema, OrderItemSchema (+ parentOrderItemId)
S3a: IngredientSchema, StockMovementSchema, UomSchema
S3b: RecipeSchema, RecipeItemSchema
S3c: PrepProductionSchema
S4:  TabSchema (+ parentTabId, splitMode), RefundSchema, RefundItemSchema, PaymentSchema (+ isRefund)
S5:  WaitlistEntrySchema, WaitlistNotificationSchema, PhoneE164Schema
```

All types must be inferred: `type Ingredient = z.infer<typeof IngredientSchema>`. Never write manual interfaces.

## RLS checklist per sprint

Before any sprint ships, confirm RLS on every new table:
- `select` allowed for authenticated same-venue users
- `insert/update/delete` allowed only with role gate (bartender/manager/admin per action)
- Append-only tables (`stock_movements`, `audit_log`, `waitlist_notifications`, `refunds`): grant INSERT only; revoke UPDATE/DELETE from authenticated role
