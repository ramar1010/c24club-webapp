-- Purge all remaining messages from transactional_emails queue
DO $$
DECLARE
  msg RECORD;
BEGIN
  FOR msg IN
    SELECT msg_id FROM pgmq.read('transactional_emails', 0, 1000)
  LOOP
    PERFORM pgmq.delete('transactional_emails', msg.msg_id);
  END LOOP;
END $$;

-- Reset any rate limit cooldown
UPDATE email_send_state SET retry_after_until = NULL, updated_at = now() WHERE id = 1;