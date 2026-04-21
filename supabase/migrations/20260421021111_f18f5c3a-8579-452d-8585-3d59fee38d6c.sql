-- Purge ALL messages from transactional_emails queue with read_ct >= 3
DO $$
DECLARE
  msg RECORD;
BEGIN
  FOR msg IN
    SELECT msg_id FROM pgmq.read('transactional_emails', 0, 1000)
    WHERE read_ct >= 3
  LOOP
    PERFORM pgmq.delete('transactional_emails', msg.msg_id);
  END LOOP;
END $$;

-- Increase send delay to 500ms to reduce rate limit hits
UPDATE email_send_state 
SET send_delay_ms = 500, retry_after_until = NULL, updated_at = now() 
WHERE id = 1;