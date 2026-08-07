# Coverage Declaration — Plan 20-12

No external API integration. This is a gap-closure plan fixing an internal bug
in an existing Supabase insert/update payload (the `promotions` table's draft
default and the promotion builder form's client-side validation); it adds no
new API surface, no new third-party SDK or service dependency, and calls no
network endpoint beyond the project's existing Supabase instance.
