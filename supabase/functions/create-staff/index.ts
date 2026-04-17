// Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { name, role, pin } = await req.json()

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Generate a stable UUID from name (or use crypto)
  const staffId = crypto.randomUUID()
  const email = `${staffId}@barpos.local`

  // Create auth user
  const { error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
    user_metadata: { name, role },
  })

  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create profile (auth user creation does not auto-create it)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ id: staffId, name, role, pin, is_active: true })

  if (profileError) {
    // Rollback: delete the auth user we just created
    await supabaseAdmin.auth.admin.deleteUser(staffId)
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ id: staffId, name, role }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
