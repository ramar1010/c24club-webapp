CREATE OR REPLACE FUNCTION public.delete_user_account_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM public.members WHERE id = target_user_id;

  -- Messaging / social graph
  DELETE FROM public.dm_messages
  WHERE sender_id = target_user_id
     OR conversation_id IN (
       SELECT id FROM public.conversations
       WHERE participant_1 = target_user_id OR participant_2 = target_user_id
     );
  DELETE FROM public.conversations WHERE participant_1 = target_user_id OR participant_2 = target_user_id;
  DELETE FROM public.blocked_users WHERE blocker_id = target_user_id OR blocked_id = target_user_id;
  DELETE FROM public.member_interests WHERE user_id = target_user_id OR interested_in_user_id = target_user_id;
  DELETE FROM public.direct_call_invites WHERE inviter_id = target_user_id OR invitee_id = target_user_id;
  DELETE FROM public.discover_profile_views WHERE viewer_id = target_user_id OR viewed_member_id = target_user_id;

  -- Calls, queues, presence, prompts
  DELETE FROM public.call_minutes_log WHERE user_id = target_user_id;
  DELETE FROM public.waiting_queue WHERE member_id = target_user_id;
  DELETE FROM public.waiting_spin_earnings WHERE user_id = target_user_id;
  DELETE FROM public.male_search_batch_log WHERE female_user_id = target_user_id;
  DELETE FROM public.app_download_clicks WHERE user_id = target_user_id;
  DELETE FROM public.sms_reminder_optins WHERE user_id = target_user_id;

  -- Rewards, payments, balances, payouts
  DELETE FROM public.gift_transactions WHERE sender_id = target_user_id OR recipient_id = target_user_id;
  DELETE FROM public.camera_unlock_requests WHERE requester_id = target_user_id OR recipient_id = target_user_id;
  DELETE FROM public.cashout_requests WHERE user_id = target_user_id;
  UPDATE public.cashout_requests SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
  DELETE FROM public.member_redemptions WHERE user_id = target_user_id;
  DELETE FROM public.member_minutes WHERE user_id = target_user_id;
  DELETE FROM public.vip_settings WHERE user_id = target_user_id;
  DELETE FROM public.iap_purchases WHERE user_id = target_user_id OR recipient_id = target_user_id;
  DELETE FROM public.jackpot_payouts WHERE user_id = target_user_id;
  UPDATE public.jackpot_payouts SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
  DELETE FROM public.minute_wagers WHERE user_id = target_user_id;
  DELETE FROM public.spin_results WHERE user_id = target_user_id;
  UPDATE public.gift_cards SET claimed_by = NULL WHERE claimed_by = target_user_id;

  -- Challenges / earnings / wishlist
  DELETE FROM public.anchor_challenge_progress WHERE user_id = target_user_id;
  DELETE FROM public.anchor_earnings WHERE user_id = target_user_id;
  DELETE FROM public.anchor_payouts WHERE user_id = target_user_id;
  DELETE FROM public.anchor_queue WHERE user_id = target_user_id;
  DELETE FROM public.anchor_sessions WHERE user_id = target_user_id;
  DELETE FROM public.bestie_daily_logs
  WHERE pair_id IN (
    SELECT id FROM public.bestie_pairs
    WHERE inviter_id = target_user_id OR invitee_id = target_user_id
  );
  DELETE FROM public.bestie_pairs WHERE inviter_id = target_user_id OR invitee_id = target_user_id;
  DELETE FROM public.challenge_issues WHERE user_id = target_user_id;
  DELETE FROM public.challenge_submissions WHERE user_id = target_user_id;
  UPDATE public.challenge_submissions SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
  DELETE FROM public.challenge_suggestions WHERE user_id = target_user_id;
  DELETE FROM public.female_retention_progress WHERE user_id = target_user_id;
  DELETE FROM public.wishlist_items WHERE user_id = target_user_id;

  -- Reports, moderation, notifications, promos, referrals
  DELETE FROM public.fast_skip_reports WHERE reporter_id = target_user_id OR reported_user_id = target_user_id;
  DELETE FROM public.user_bans WHERE user_id = target_user_id;
  UPDATE public.user_bans SET banned_by = NULL WHERE banned_by = target_user_id;
  DELETE FROM public.user_reports WHERE reporter_id = target_user_id OR reported_user_id = target_user_id;
  DELETE FROM public.push_notification_log WHERE user_id = target_user_id;
  DELETE FROM public.push_open_events WHERE user_id = target_user_id;
  DELETE FROM public.pinned_topics WHERE user_id = target_user_id;
  DELETE FROM public.promo_analytics WHERE viewer_id = target_user_id;
  DELETE FROM public.promo_templates WHERE user_id = target_user_id;
  UPDATE public.promos SET member_id = NULL WHERE member_id = target_user_id;
  DELETE FROM public.referral_tracking WHERE referred_user_id = target_user_id;
  DELETE FROM public.referral_codes WHERE user_id = target_user_id;
  DELETE FROM public.slot_signups WHERE user_id = target_user_id;
  DELETE FROM public.tap_me_events WHERE user_id = target_user_id;
  DELETE FROM public.member_welcome_dm_log WHERE user_id = target_user_id;
  DELETE FROM public.moderator_permissions WHERE user_id = target_user_id;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  IF user_email IS NOT NULL THEN
    DELETE FROM public.email_send_log WHERE recipient_email = user_email;
  END IF;

  DELETE FROM public.members WHERE id = target_user_id;
END;
$function$;