# Real-Time Update Testing Procedure

## Overview

This document provides a manual testing procedure to verify that the Product Catalog UI components (ProductGrid and CategoryTabs) correctly reflect real-time updates when data changes in Supabase. This validates **Requirements 10.3 and 10.4**.

## Prerequisites

Before starting the test, ensure:

1. ✅ The application is running locally (`npm run dev`)
2. ✅ You have access to the Supabase admin dashboard
3. ✅ You are logged into the application with valid credentials
4. ✅ The Product Catalog UI is visible on screen (POS page)
5. ✅ TanStack Query is configured with real-time refetch enabled

## Test Environment Setup

### 1. Open Required Windows

- **Window 1**: Application running in browser (e.g., `http://localhost:5173`)
- **Window 2**: Supabase admin dashboard (Table Editor)
- **Window 3**: Browser DevTools Console (optional, for monitoring network requests)

### 2. Navigate to Product Catalog

1. Open the application in your browser
2. Navigate to the POS page where ProductGrid is displayed
3. Ensure products and categories are visible

## Test Case 1: Product Updates

**Objective**: Verify ProductGrid reflects updated product data within 5 seconds

### Test Steps

1. **Identify a Test Product**
   - Note the name and price of a visible product in the ProductGrid
   - Example: "Bud Light Draft" - $6.50

2. **Update Product in Supabase**
   - Open Supabase dashboard → Table Editor → `products` table
   - Find the test product by name
   - Update one of the following fields:
     - `name`: Change to "Bud Light Draft (Updated)"
     - `base_price`: Change from 6.50 to 7.00
     - `happy_hour_price`: Change from 4.50 to 5.00
   - Click "Save" in Supabase

3. **Verify UI Update**
   - Switch back to the application window
   - **Expected Result**: Within 5 seconds, the ProductCard should display the updated information
   - ✅ Updated product name appears
   - ✅ Updated price appears
   - ✅ No page refresh required

4. **Verify Data Integrity**
   - Click on the updated product
   - Verify the onSelect callback receives the updated product data
   - Check browser console for the product object (if logging is enabled)

### Expected Behavior

- **Update Latency**: ≤ 5 seconds
- **UI Consistency**: All instances of the product reflect the change
- **No Errors**: No console errors or warnings
- **Smooth Transition**: No flickering or layout shift

### Troubleshooting

If the UI does not update:

- Check TanStack Query refetch interval configuration
- Verify Supabase connection is active (check network tab)
- Check browser console for errors
- Manually refresh the page to confirm data was saved in Supabase

## Test Case 2: Product Activation/Deactivation

**Objective**: Verify ProductGrid filters out inactive products in real-time

### Test Steps

1. **Identify an Active Product**
   - Note a visible product in the ProductGrid
   - Example: "Corona Extra" - currently visible

2. **Deactivate Product in Supabase**
   - Open Supabase dashboard → Table Editor → `products` table
   - Find the test product
   - Set `is_active` field to `false`
   - Click "Save"

3. **Verify UI Update**
   - Switch back to the application window
   - **Expected Result**: Within 5 seconds, the product should disappear from the grid
   - ✅ Product is no longer visible
   - ✅ Grid layout adjusts smoothly
   - ✅ No empty space left behind

4. **Reactivate Product**
   - Return to Supabase dashboard
   - Set `is_active` field back to `true`
   - Click "Save"

5. **Verify Product Reappears**
   - **Expected Result**: Within 5 seconds, the product reappears in the grid
   - ✅ Product is visible again
   - ✅ Product appears in correct category

### Expected Behavior

- **Update Latency**: ≤ 5 seconds
- **Filtering Accuracy**: Only active products are shown
- **Layout Stability**: Grid adjusts without jarring shifts

## Test Case 3: Category Updates

**Objective**: Verify CategoryTabs reflects updated category data within 5 seconds

### Test Steps

1. **Identify a Test Category**
   - Note a visible category tab in the CategoryTabs component
   - Example: "Beer" tab with orange color dot

2. **Update Category in Supabase**
   - Open Supabase dashboard → Table Editor → `categories` table
   - Find the test category by name
   - Update one of the following fields:
     - `name`: Change to "Beers (Updated)"
     - `color`: Change from "#FFA500" to "#FF0000" (red)
   - Click "Save"

3. **Verify UI Update**
   - Switch back to the application window
   - **Expected Result**: Within 5 seconds, the CategoryTabs should display the updated information
   - ✅ Updated category name appears in tab
   - ✅ Updated color dot appears (if color was changed)
   - ✅ No page refresh required

4. **Verify Filtering Still Works**
   - Click on the updated category tab
   - Verify products in that category are still displayed correctly
   - Verify category color dot appears on ProductCards

### Expected Behavior

- **Update Latency**: ≤ 5 seconds
- **UI Consistency**: Category name and color update everywhere
- **Functionality Preserved**: Category filtering still works correctly

## Test Case 4: Happy Hour Configuration Updates

**Objective**: Verify happy hour badges update when category happy hour times change

### Test Steps

1. **Identify a Category with Happy Hour**
   - Note a category with happy hour configuration
   - Example: "Beer" - Happy Hour 16:00-19:00

2. **Update Happy Hour Times in Supabase**
   - Open Supabase dashboard → Table Editor → `categories` table
   - Find the test category
   - Update `happy_hour_start` and `happy_hour_end` fields
   - Example: Change to current time ± 1 hour to trigger badge visibility
   - Click "Save"

3. **Verify Badge Visibility Updates**
   - Switch back to the application window
   - **Expected Result**: Within 5 seconds (or up to 60 seconds due to time update interval)
   - ✅ Products in the category show/hide "HAPPY HOUR" badge based on new times
   - ✅ Prices update to reflect happy hour pricing (if applicable)

4. **Verify Price Display**
   - Check that products display happy hour price when badge is visible
   - Check that products display base price when badge is not visible

### Expected Behavior

- **Update Latency**: ≤ 60 seconds (due to currentTime update interval)
- **Badge Accuracy**: Badge visibility matches happy hour time range
- **Price Accuracy**: Correct price displayed based on happy hour status

## Test Case 5: New Product Addition

**Objective**: Verify new products appear in ProductGrid in real-time

### Test Steps

1. **Note Current Product Count**
   - Count the number of visible products in the grid
   - Example: 12 products visible

2. **Add New Product in Supabase**
   - Open Supabase dashboard → Table Editor → `products` table
   - Click "Insert row"
   - Fill in required fields:
     - `name`: "Test New Product"
     - `category_id`: Select an existing category
     - `base_price`: 10.00
     - `is_active`: true
   - Click "Save"

3. **Verify New Product Appears**
   - Switch back to the application window
   - **Expected Result**: Within 5 seconds, the new product appears in the grid
   - ✅ New product is visible
   - ✅ Product appears in correct category
   - ✅ Product displays correct price
   - ✅ Product is clickable

4. **Verify Category Filtering**
   - Click on the category tab for the new product's category
   - Verify the new product is visible when filtered
   - Click "All" tab to verify product appears in full list

### Expected Behavior

- **Update Latency**: ≤ 5 seconds
- **Data Completeness**: All product fields are correctly displayed
- **Functionality**: New product is fully interactive

## Test Case 6: Product Deletion

**Objective**: Verify deleted products disappear from ProductGrid in real-time

### Test Steps

1. **Identify a Test Product**
   - Note a visible product in the ProductGrid
   - Example: "Test New Product" (from Test Case 5)

2. **Delete Product in Supabase**
   - Open Supabase dashboard → Table Editor → `products` table
   - Find the test product
   - Click the delete icon (trash can)
   - Confirm deletion

3. **Verify Product Disappears**
   - Switch back to the application window
   - **Expected Result**: Within 5 seconds, the product disappears from the grid
   - ✅ Product is no longer visible
   - ✅ Grid layout adjusts smoothly
   - ✅ No errors in console

### Expected Behavior

- **Update Latency**: ≤ 5 seconds
- **UI Stability**: Grid adjusts without errors
- **Data Consistency**: Product is removed from all views

## Test Case 7: Category Addition

**Objective**: Verify new categories appear in CategoryTabs in real-time

### Test Steps

1. **Note Current Category Count**
   - Count the number of visible category tabs
   - Example: 5 categories visible

2. **Add New Category in Supabase**
   - Open Supabase dashboard → Table Editor → `categories` table
   - Click "Insert row"
   - Fill in required fields:
     - `name`: "Test New Category"
     - `color`: "#00FF00" (green)
     - `sort_order`: 99
   - Click "Save"

3. **Verify New Category Appears**
   - Switch back to the application window
   - **Expected Result**: Within 5 seconds, the new category tab appears
   - ✅ New category tab is visible
   - ✅ Category color dot is correct (green)
   - ✅ Category tab is clickable

4. **Verify Category Functionality**
   - Click on the new category tab
   - Verify empty state is shown (no products in new category)
   - Add a product to this category in Supabase
   - Verify product appears when category is selected

### Expected Behavior

- **Update Latency**: ≤ 5 seconds
- **UI Integration**: New category integrates seamlessly
- **Functionality**: Category filtering works correctly

## Performance Benchmarks

### Expected Update Latencies

| Update Type                | Expected Latency | Acceptable Range |
| -------------------------- | ---------------- | ---------------- |
| Product name/price update  | ≤ 5 seconds      | 2-10 seconds     |
| Product activation toggle  | ≤ 5 seconds      | 2-10 seconds     |
| Category name/color update | ≤ 5 seconds      | 2-10 seconds     |
| Happy hour time update     | ≤ 60 seconds     | 30-90 seconds    |
| New product addition       | ≤ 5 seconds      | 2-10 seconds     |
| Product deletion           | ≤ 5 seconds      | 2-10 seconds     |
| New category addition      | ≤ 5 seconds      | 2-10 seconds     |

### Network Conditions

These benchmarks assume:

- Stable internet connection
- Normal Supabase response times (<500ms)
- TanStack Query default refetch interval (staleTime configuration)

## Troubleshooting Guide

### Issue: UI Does Not Update

**Possible Causes:**

1. TanStack Query refetch is disabled or interval is too long
2. Supabase connection is lost
3. Browser tab is in background (some browsers throttle timers)
4. Network connectivity issues

**Solutions:**

1. Check TanStack Query configuration in `queries.ts`
2. Verify Supabase connection status in network tab
3. Bring browser tab to foreground
4. Check network connectivity
5. Manually refresh the page to confirm data was saved

### Issue: Updates Are Slow (>10 seconds)

**Possible Causes:**

1. Network latency
2. TanStack Query refetch interval is too long
3. Supabase server response time is slow

**Solutions:**

1. Check network latency in DevTools
2. Adjust TanStack Query `staleTime` and `refetchInterval` settings
3. Check Supabase dashboard for performance issues

### Issue: Partial Updates (Some Data Updates, Some Doesn't)

**Possible Causes:**

1. Multiple queries with different refetch intervals
2. Cache invalidation not working correctly
3. Component not re-rendering

**Solutions:**

1. Verify all queries have consistent refetch settings
2. Check TanStack Query cache invalidation logic
3. Add React DevTools to verify component re-renders

### Issue: Console Errors During Updates

**Possible Causes:**

1. Zod validation failing on updated data
2. Missing required fields in Supabase data
3. Type mismatches

**Solutions:**

1. Check console for specific error messages
2. Verify Supabase data matches expected schema
3. Review Zod schemas in `types.ts`

## Configuration Notes

### TanStack Query Settings

The real-time update behavior depends on TanStack Query configuration in `src/entities/product/model/queries.ts`:

```typescript
// Example configuration for real-time updates
export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    staleTime: 5000, // Data is fresh for 5 seconds
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
};
```

### Happy Hour Time Updates

Happy hour badge visibility updates are controlled by the `currentTime` state in ProductGrid, which updates every 60 seconds:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    setCurrentTime(getCurrentTime());
  }, 60000); // 60 seconds
  return () => clearInterval(interval);
}, []);
```

This means happy hour badge changes may take up to 60 seconds to reflect, even if category data updates immediately.

## Test Results Template

Use this template to document your test results:

```
## Test Execution: [Date]

### Test Case 1: Product Updates
- ✅ Product name updated within 5 seconds
- ✅ Product price updated within 5 seconds
- ✅ No console errors
- Notes: [Any observations]

### Test Case 2: Product Activation/Deactivation
- ✅ Product disappeared when deactivated
- ✅ Product reappeared when reactivated
- ✅ Grid layout adjusted smoothly
- Notes: [Any observations]

### Test Case 3: Category Updates
- ✅ Category name updated within 5 seconds
- ✅ Category color updated within 5 seconds
- ✅ Filtering still works correctly
- Notes: [Any observations]

### Test Case 4: Happy Hour Configuration Updates
- ✅ Badge visibility updated (within 60 seconds)
- ✅ Prices updated correctly
- Notes: [Any observations]

### Test Case 5: New Product Addition
- ✅ New product appeared within 5 seconds
- ✅ Product displays correctly
- ✅ Product is interactive
- Notes: [Any observations]

### Test Case 6: Product Deletion
- ✅ Product disappeared within 5 seconds
- ✅ No console errors
- Notes: [Any observations]

### Test Case 7: Category Addition
- ✅ New category appeared within 5 seconds
- ✅ Category is functional
- Notes: [Any observations]

### Overall Assessment
- Pass Rate: [X/7 test cases passed]
- Issues Found: [List any issues]
- Recommendations: [Any suggestions]
```

## Conclusion

This manual testing procedure validates that the Product Catalog UI correctly reflects real-time updates from Supabase, meeting **Requirements 10.3 and 10.4**. The expected update latency is ≤ 5 seconds for most operations, with happy hour badge updates taking up to 60 seconds due to the time update interval.

For automated testing of real-time updates, consider implementing E2E tests using Playwright or Cypress that can programmatically update Supabase data and verify UI changes.
