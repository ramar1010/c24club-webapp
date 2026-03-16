INSERT INTO public.email_templates (template_key, name, description, trigger_info, subject, body, is_active)
VALUES (
  'unread_dm_digest',
  'Unread Messages Digest',
  'Sent to users who have unread direct messages. Variables: {{name}}, {{count}}, {{senders}}.',
  'Automated — runs every 30 minutes via scheduled job',
  'You have {{count}} unread message(s) on C24CLUB',
  'Hey {{name}}! 💬

You have {{count}} unread message(s) from {{senders}}.

Don''t leave them hanging — check your messages now!

— C24CLUB Team',
  true
)
ON CONFLICT DO NOTHING;