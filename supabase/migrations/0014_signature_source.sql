-- ---------------------------------------------------------------------------
-- Record, in the sealed event, whether the signature was drawn or uploaded.
--
-- Both are allowed. They are not equally good evidence: a signature drawn on
-- the device in front of you was made at that moment by whoever was holding
-- it, while an uploaded image could have come from anywhere and been made by
-- anyone. Somebody reading this record in two years should be told which it
-- was, not left to assume the stronger one.
--
-- It goes inside the fingerprint rather than beside it, so the answer can't be
-- quietly changed later — which would be the obvious thing to try, and the
-- whole reason the rest of this table is hashed.
--
-- Rewriting the seal is safe here because no event has been signed yet; doing
-- this once there were rows would break the chain for every one of them.
-- ---------------------------------------------------------------------------

alter table public.signature_events
  add column if not exists signature_source text not null default 'drawn'
    check (signature_source in ('drawn', 'uploaded'));

create or replace function public.seal_signature_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_hash text;
begin
  select record_hash into last_hash
    from public.signature_events
   order by signed_at desc, id desc
   limit 1;

  new.signed_at := now();
  new.prev_hash := last_hash;
  new.document_hash := encode(digest(new.document_text, 'sha256'), 'hex');
  new.record_hash := encode(
    digest(
      coalesce(last_hash, '')
        || new.document_hash
        || new.signed_by::text
        || new.signer_email
        || new.signature_source
        || new.signed_at::text,
      'sha256'
    ),
    'hex'
  );
  new.verify_code := upper(substring(new.record_hash from 1 for 6));

  return new;
end $$;
