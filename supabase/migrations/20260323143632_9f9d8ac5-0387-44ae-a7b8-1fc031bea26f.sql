UPDATE email_templates 
SET body = REPLACE(body, 'c24club.lovable.app', 'c24club.com')
WHERE template_key IN ('female_online_notify', 'male_online_notify')
AND body LIKE '%lovable.app%';