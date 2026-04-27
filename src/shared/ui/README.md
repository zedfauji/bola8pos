# shared/ui — Generic POS UI Primitives

## Rule

Only **generic, reusable UI primitives** belong here. These components have **zero business entity knowledge**.

## What belongs here

| Component                                              | Why                                                |
| ------------------------------------------------------ | -------------------------------------------------- |
| MoneyDisplay                                           | Formats a number as "$X.XX" — no entity types      |
| TimerDisplay                                           | Formats seconds — no entity types                  |
| StatusBadge                                            | Maps status enum to color — uses shared enums only |
| PINKeypad                                              | Generic keypad — no staff/auth logic               |
| POSButton                                              | Extended Button with touch sizes                   |
| ConfirmDialog, DataTable, SearchInput, FormField, etc. | Generic interaction patterns                       |

## What does NOT belong here

| Component                                                  | Where it lives instead                  |
| ---------------------------------------------------------- | --------------------------------------- |
| TabCard                                                    | `entities/tab/ui/`                      |
| ProductCard                                                | `entities/product/ui/`                  |
| PoolTableCard                                              | `entities/pool-table/ui/`               |
| CartItem                                                   | `entities/tab/ui/`                      |
| CartSummary                                                | `widgets/OrderPanel/` (widget-specific) |
| Any component that imports from `entities/` or `features/` | Move to widgets/                        |

## If an AI agent adds a domain component here

1. Move it to the correct `entities/<name>/ui/` folder
2. Update the import in `index.ts` — do NOT add it to the barrel
3. Update all callers to import from the entity path
