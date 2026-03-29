
UPDATE email_templates SET body = '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,hsl(205,65%,45%),hsl(190,70%,42%));padding:32px 24px;text-align:center">
    <img src="https://ncpbiymnafxdfsvpxirb.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="C24 Club" width="120" style="margin-bottom:16px" />
    <h1 style="color:#ffffff;font-size:24px;margin:0">Earn CASH Now! 💰</h1>
  </div>
  <div style="padding:32px 24px">
    <p style="font-size:16px;color:#1a1a2e;margin:0 0 16px">Hey {{user_name}},</p>
    <p style="font-size:16px;color:#1a1a2e;margin:0 0 24px">A male user just joined C24Club and is looking to video chat. You can <strong>earn cash</strong> just by connecting!</p>
    <a href="https://c24club.lovable.app/videocall" style="display:inline-block;background:hsl(205,65%,45%);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:0 0 24px">Join Video Chat →</a>
    <p style="font-size:14px;color:#64748b;margin:16px 0 0">You''re receiving this because you enabled notifications on C24Club.</p>
  </div>
  <div style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="font-size:12px;color:#94a3b8;margin:0">© C24 Club · All rights reserved</p>
  </div>
</div>', updated_at = now()
WHERE template_key = 'male_online_notify';

UPDATE email_templates SET body = '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,hsl(205,65%,45%),hsl(190,70%,42%));padding:32px 24px;text-align:center">
    <img src="https://ncpbiymnafxdfsvpxirb.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="C24 Club" width="120" style="margin-bottom:16px" />
    <h1 style="color:#ffffff;font-size:24px;margin:0">A Female User Is Waiting! 👋</h1>
  </div>
  <div style="padding:32px 24px">
    <p style="font-size:16px;color:#1a1a2e;margin:0 0 16px">Hey {{user_name}},</p>
    <p style="font-size:16px;color:#1a1a2e;margin:0 0 24px">A female user just came online on C24Club and is looking for someone to video chat with. Join now before she leaves!</p>
    <a href="https://c24club.lovable.app/videocall" style="display:inline-block;background:hsl(205,65%,45%);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:0 0 24px">Join Video Chat →</a>
    <p style="font-size:14px;color:#64748b;margin:16px 0 0">You''re receiving this because you enabled notifications on C24Club.</p>
  </div>
  <div style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0">
    <p style="font-size:12px;color:#94a3b8;margin:0">© C24 Club · All rights reserved</p>
  </div>
</div>', updated_at = now()
WHERE template_key = 'female_online_notify';
