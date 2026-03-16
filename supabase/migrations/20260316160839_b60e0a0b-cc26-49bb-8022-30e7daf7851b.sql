INSERT INTO email_templates (template_key, name, description, trigger_info, subject, body, is_active)
VALUES (
  'power_hour_reminder',
  'Power Hour Reminder',
  'Daily reminder sent to female users about Power Hour earnings opportunity starting at 7pm EST.',
  'Automated — sent daily at 7pm EST via cron job to female members only.',
  '💰 Power Hour starts NOW — Earn cash chatting with guys!',
  E'Hey {{user_name}}! 👋\n\nIt''s Power Hour time! 🔥\n\nFrom 7pm to midnight EST, you earn MORE for every minute you spend chatting with guys on C24Club.\n\nHere''s what you get during Power Hour:\n• 💵 Higher cash earnings per minute\n• ⏱️ Faster reward accumulation\n• 🎁 Bonus opportunities\n\nAll you have to do is hop on and start chatting — it''s that easy!\n\nThe more you chat, the more you earn. Don''t miss out!\n\n👉 Head to C24Club now and start earning.\n\nSee you there,\nThe C24Club Team',
  true
);