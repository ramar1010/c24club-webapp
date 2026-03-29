INSERT INTO email_templates (template_key, name, subject, body, description, trigger_info, is_active)
VALUES (
  'missed_video_call',
  'Missed Video Call',
  '📹 You missed a video call from {{caller_name}}!',
  '<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: #fff; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; color: #fff;">📹 Missed Video Call</h1>
    </div>
    <div style="padding: 24px;">
      <p style="text-align: center; font-size: 18px; margin: 0 0 16px;">Hey <strong>{{user_name}}</strong>,</p>
      <p style="text-align: center; font-size: 16px; color: #d1d5db; margin: 0 0 20px;"><strong>{{caller_name}}</strong> tried to video chat with you but you weren''t available.</p>
      <div style="background: #262626; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
        <p style="color: #93c5fd; font-size: 14px; margin: 0;">💡 Check their profile on Discover and connect when you''re ready!</p>
      </div>
      <a href="https://c24club.lovable.app/discover" style="display: block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px;">Open Discover →</a>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">C24Club — Don''t miss your next connection</p>
    </div>
  </div>',
  'Sent when a user misses an incoming direct video call',
  'Triggered when a direct call invite expires or is not answered',
  true
);