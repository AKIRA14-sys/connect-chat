CREATE OR REPLACE FUNCTION public.push_targets_for_conversation(_conv uuid, _pref text)
RETURNS TABLE (user_id uuid, endpoint text, p256dh text, auth_key text, fcm_token text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_member(_conv, _me) THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF _pref NOT IN ('notify_messages','notify_groups','notify_voice_calls','notify_video_calls','notify_xups') THEN
    RAISE EXCEPTION 'Invalid preference';
  END IF;

  RETURN QUERY
  WITH recipients AS (
    SELECT p.id
    FROM public.conversation_members m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.conversation_id = _conv
      AND m.user_id <> _me
      AND p.status = 'active'
      AND CASE _pref
            WHEN 'notify_messages' THEN p.notify_messages
            WHEN 'notify_groups' THEN p.notify_groups
            WHEN 'notify_voice_calls' THEN p.notify_voice_calls
            WHEN 'notify_video_calls' THEN p.notify_video_calls
            ELSE p.notify_xups
          END
      AND NOT public.is_blocked_between(p.id, _me)
  )
  SELECT r.id, s.endpoint, s.p256dh, s.auth, NULL::text
    FROM recipients r JOIN public.push_subscriptions s ON s.user_id = r.id
  UNION ALL
  SELECT r.id, NULL::text, NULL::text, NULL::text, f.token
    FROM recipients r JOIN public.fcm_tokens f ON f.user_id = r.id;
END $$;

CREATE OR REPLACE FUNCTION public.push_targets_for_user(_target uuid, _pref text)
RETURNS TABLE (user_id uuid, endpoint text, p256dh text, auth_key text, fcm_token text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _target = _me THEN RETURN; END IF;
  IF public.is_blocked_between(_me, _target) THEN RETURN; END IF;
  IF _pref NOT IN ('notify_messages','notify_groups','notify_voice_calls','notify_video_calls','notify_xups') THEN
    RAISE EXCEPTION 'Invalid preference';
  END IF;

  RETURN QUERY
  WITH recipients AS (
    SELECT p.id FROM public.profiles p
    WHERE p.id = _target AND p.status = 'active'
      AND CASE _pref
            WHEN 'notify_messages' THEN p.notify_messages
            WHEN 'notify_groups' THEN p.notify_groups
            WHEN 'notify_voice_calls' THEN p.notify_voice_calls
            WHEN 'notify_video_calls' THEN p.notify_video_calls
            ELSE p.notify_xups
          END
  )
  SELECT r.id, s.endpoint, s.p256dh, s.auth, NULL::text
    FROM recipients r JOIN public.push_subscriptions s ON s.user_id = r.id
  UNION ALL
  SELECT r.id, NULL::text, NULL::text, NULL::text, f.token
    FROM recipients r JOIN public.fcm_tokens f ON f.user_id = r.id;
END $$;

CREATE OR REPLACE FUNCTION public.prune_push_target(_endpoint text DEFAULT NULL, _fcm_token text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _endpoint IS NOT NULL THEN DELETE FROM public.push_subscriptions WHERE endpoint = _endpoint; END IF;
  IF _fcm_token IS NOT NULL THEN DELETE FROM public.fcm_tokens WHERE token = _fcm_token; END IF;
END $$;

REVOKE ALL ON FUNCTION public.push_targets_for_conversation(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.push_targets_for_user(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.prune_push_target(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.push_targets_for_conversation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_targets_for_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prune_push_target(text, text) TO authenticated;
