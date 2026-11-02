-- ---------------------------------------------------------------------------
-- Profile pictures, and where a signature came from.
--
-- The picture is for the message threads that come later: a name on its own
-- reads as paperwork, a face reads as a person. It lives in its own private
-- bucket and is served through short-lived signed links, the same as every
-- other image of somebody's private life in here.
--
-- The signature column is smaller but matters more. A signature drawn on the
-- device in front of you and a signature uploaded from a file are not equally
-- good evidence — an uploaded image could have come from anywhere, including
-- from somebody else's hand. Both are allowed, because asking a tenant to
-- draw with a mouse is how you end up with no signature at all. But which one
-- it was is recorded, and shown wherever the signature is shown, so nobody
-- has to guess later.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_path text;

alter table public.signatures
  add column if not exists source text not null default 'drawn'
    check (source in ('drawn', 'uploaded'));

-- --- The bucket -------------------------------------------------------------

-- Private, like the others. No policies are created for it, so no client key
-- can read or write it; everything goes through the server, which has already
-- worked out who is asking.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The signature bucket takes uploaded files too now, which arrive as JPEG or
-- WebP as often as PNG. They are converted to PNG before they are stored, but
-- widening this costs nothing and removes a confusing failure if that ever
-- changes.
update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'signatures';
