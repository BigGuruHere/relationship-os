-- After normal signup, promote exactly the new account you have identified.
-- Select the correct Neon branch and obtain its User.id from your authenticated account.
-- The email is encrypted: do not replace email_Enc, email_Idx or Foundation enrollment.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $owner$
DECLARE
  target_user text := 'REPLACE_NEW_USER_ID';
BEGIN
  -- Existing owners use the normal owner-only management screen instead.
  LOCK TABLE public."User" IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM public."User" WHERE role = 'owner') THEN
    RAISE EXCEPTION 'An owner already exists; review before changing privileges';
  END IF;
  UPDATE public."User" u SET role = 'owner', "updatedAt" = now()
  WHERE u.id = target_user AND u.role = 'member' AND EXISTS (
    SELECT 1 FROM public."FoundationEnrollment" e WHERE e."userId" = u.id AND e.state = 'ACTIVE'
  );
  IF NOT FOUND THEN RAISE EXCEPTION 'Exact new ACTIVE member account not found'; END IF;
END
$owner$;
-- Rehearse first. Change the final ROLLBACK to COMMIT to save the owner role.
ROLLBACK;
