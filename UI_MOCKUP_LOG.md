# UI Mockup Log

This document tracks UI mockups and design decisions for the Billiard POS system.

## Current Implementation (As of 2025-08-11)

### Table View
- Grid layout of tables with status indicators
- Color-coded table status (available, occupied, needs cleaning)
- Quick action buttons for each table

### Order Screen
- Left panel: Table selection and menu categories
- Center: Menu items with images and prices
- Right: Order summary and actions

### Kitchen Display System (KDS)
- Real-time order queue
- Order status tracking
- Preparation time indicators

## Suggested Improvements

### 1. Enhanced Table View
```
┌─────────────────────────────────────┐
│  📊 BILLIARD POS - TABLE VIEW       │
├─────────────────┬───────────────────┤
│  🎱 Table 1     │  🎱 Table 2 (30m) │
│  Available      │  ⏱ 30 mins left   │
│                 │  💰 $45.00        │
├─────────────────┼───────────────────┤
│  🧹 Table 3     │  ⏸️ Table 4      │
│  Cleaning       │  Paused           │
│  (2 min left)   │  (45m elapsed)    │
└─────────────────┴───────────────────┘
```

### 2. Modern Order Screen
```
┌─────────────────────────────────────────────────────────┐
│  🛍️ NEW ORDER - TABLE 2                      [❌] [✓]  │
├───────────────┬───────────────────────┬─────────────────┤
│               │                       │ ORDER SUMMARY   │
│  CATEGORIES   │                       ├─────────────────┤
│  ──────────   │      MENU ITEMS       │ 1x Beer        │
│  • Drinks     │  ┌───────┐ ┌────────┐│ 2x Burger      │
│  • Food       │  │  🍺   │ │  🍔    ││ 1x Fries      │
│  • Billiards  │  │ $5.00 │ │ $12.00 ││                │
│  • Desserts   │  └───────┘ └────────┘│ Subtotal: $34.00│
│               │                       │ Tax:     $2.72  │
│               │                       │ Total:   $36.72 │
│               │                       │                 │
│               │                       │ [🖨️ Print]      │
│               │                       │ [💳 Pay Now]    │
└───────────────┴───────────────────────┴─────────────────┘
```

### 3. Enhanced KDS View
```
┌─────────────────────────────────────────────────────────┐
│  🍽️ KITCHEN DISPLAY SYSTEM                  🔄 15:45  │
├─────────────────┬─────────────────┬─────────────────────┤
│  🚨 URGENT (2)  │  ⏳ PREPARING (3)│  ✅ READY (4)      │
├─────────────────┼─────────────────┼─────────────────────┤
│  🕒 2m ago     │  🕒 5m ago      │  🕒 12m ago       │
│  Table 5       │  Table 2        │  Table 3          │
│  2x Burger     │  1x Pizza       │  3x Fries         │
│  (No onion)    │  1x Salad       │  2x Soda          │
│  ⏱ 2/8 min     │  ⏱ 5/12 min    │  ⏱ 12/15 min     │
│  [✅] [⏸️] [❌] │  [✅] [⏸️] [❌]│  [✅] [✅] [❌]   │
└─────────────────┴─────────────────┴─────────────────────┘
```

## Design Principles
1. **Clarity**: Clear visual hierarchy and status indicators
2. **Efficiency**: Minimize taps/clicks for common actions
3. **Responsive**: Works on both touch and desktop interfaces
4. **Real-time**: Clear indicators for order status and timing
5. **Accessibility**: Sufficient contrast and touch target sizes

## Next Steps
- [ ] Review current UI screenshots
- [ ] Identify specific areas for improvement
- [ ] Implement responsive design updates
- [ ] Test with users for feedback

## Change Log
- 2025-08-11: Initial mockup log created
