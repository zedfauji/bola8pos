/**
 * seed-recipes.ts — S3b-14
 * Seeds Michelada, Alitas, and Hotdog recipes with ingredient mappings.
 *
 * Usage: cd bar-pos && npx tsx scripts/seed-recipes.ts
 * Requires: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * IMPORTANT: Uses service role key (bypasses RLS). Only run in dev/staging.
 * Never commit .env.local or hardcode keys.
 */

/* eslint-disable */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local from bar-pos/ directory
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env['VITE_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL (or SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

async function findProduct(name: string): Promise<string | null> {
  const { data, error } = await db
    .from('products')
    .select('id')
    .ilike('name', name)
    .maybeSingle();
  if (error) {
    console.error(`findProduct("${name}"): ${error.message}`);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

async function findIngredient(name: string): Promise<string | null> {
  const { data, error } = await db
    .from('ingredients')
    .select('id')
    .ilike('name', name)
    .maybeSingle();
  if (error) {
    console.error(`findIngredient("${name}"): ${error.message}`);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

async function seedRecipe(
  productName: string,
  yieldQty: number,
  ingredientMap: Record<string, number>,
): Promise<void> {
  const productId = await findProduct(productName);
  if (productId == null) {
    console.warn(`  Product "${productName}" not found — skipping`);
    return;
  }

  const { data: recipeData, error: recipeError } = await db
    .from('recipes')
    .upsert(
      { product_id: productId, yield_qty: yieldQty },
      { onConflict: 'product_id' },
    )
    .select('id')
    .single();

  if (recipeError) {
    console.error(`Recipe upsert for "${productName}": ${recipeError.message}`);
    return;
  }
  const recipeId = (recipeData as { id: string }).id;

  // Replace all items (delete + insert)
  await db.from('recipe_items').delete().eq('recipe_id', recipeId);

  const items: { recipe_id: string; ingredient_id: string; qty: number }[] = [];
  for (const [ingName, qty] of Object.entries(ingredientMap)) {
    const ingId = await findIngredient(ingName);
    if (ingId == null) {
      console.warn(`    Ingredient "${ingName}" not found — skipping`);
      continue;
    }
    items.push({ recipe_id: recipeId, ingredient_id: ingId, qty });
  }

  if (items.length > 0) {
    const { error: insertError } = await db.from('recipe_items').insert(items);
    if (insertError) {
      console.error(`  Items insert for "${productName}": ${insertError.message}`);
      return;
    }
  }

  console.log(`  "${productName}": ${items.length}/${Object.keys(ingredientMap).length} ingredient(s) seeded`);
}

async function main(): Promise<void> {
  console.log('Seeding recipes...\n');

  // Michelada: beer + lime juice + clamato + salt
  await seedRecipe('Michelada', 1, {
    Beer: 0.355,
    'Lime juice': 0.5,
    Clamato: 2,
    Salt: 0.5,
  });

  // Alitas: chicken wings + buffalo sauce
  await seedRecipe('Alitas', 1, {
    'Chicken wings': 6,
    'Buffalo sauce': 2,
  });

  // Hotdog: bun + sausage
  await seedRecipe('Hotdog', 1, {
    'Hot dog bun': 1,
    'Hot dog sausage': 1,
  });

  console.log('\nDone.');
}

void main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
