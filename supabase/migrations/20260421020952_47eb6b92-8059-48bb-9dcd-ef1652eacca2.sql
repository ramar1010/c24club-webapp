-- Purge all messages from the transactional_emails queue that have been read 10+ times
-- These are stuck messages (404 run_not_found, persistent 429s) that will never succeed
DO $$
DECLARE
  msg RECORD;
BEGIN
  -- Read all visible messages and delete them
  FOR msg IN
    SELECT msg_id FROM pgmq.read('transactional_emails', 0, 1000)
    WHERE read_ct >= 10
  LOOP
    PERFORM pgmq.delete('transactional_emails', msg.msg_id);
  END LOOP;
END $$;

-- Also purge from auth_emails queue if any stuck
DO $$
DECLARE
  msg RECORD;
BEGIN
  FOR msg IN
    SELECT msg_id FROM pgmq.read('auth_emails', 0, 1000)
    WHERE read_ct >= 10
  LOOP
    PERFORM pgmq.delete('auth_emails', msg.msg_id);
  END LOOP;
END $$;