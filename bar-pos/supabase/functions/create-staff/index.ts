// Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { recordAudit } from '../_shared/audit.ts'

Deno.serve(async (req) => {
  const { name, role, pin } = await req.json()

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const staffId = crypto.randomUUID()
  const email = `${staffId}@barpos.local`

  const { error: authError } = await supabaseAdmin.auth.admin.createUser({
    id: staffId,
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

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ id: staffId, name, role, pin, email, is_active: true })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(staffId)
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await recordAudit(supabaseAdmin, {
    action: 'staff.create',
    entityType: 'staff',
    entityId: staffId,
    before: null,
    after: { name, role, email },
    source: 'edge',
    actorId: null,
  })

  return new Response(JSON.stringify({ id: staffId, email, name, role }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
