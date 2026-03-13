
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  trigger_info text,
  subject text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_templates"
  ON public.email_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read active email_templates"
  ON public.email_templates FOR SELECT TO authenticated
  USING (is_active = true);

-- Seed default templates
INSERT INTO public.email_templates (template_key, name, description, trigger_info, subject, body) VALUES
(
  'welcome',
  'Welcome Email',
  'Sent to new users when they sign up for C24Club.',
  'Triggered automatically when a new user creates an account.',
  'Welcome to C24Club! Start Earning Rewards with Every Chat 🎉',
  E'Hi {{user_name}},\n\nWelcome to C24Club! 🎉 We''re excited to have you join our community where chatting is rewarding. With every minute you spend on C24Club, you''re earning & unlocking exclusive rewards plus cash!\n\nHere''s how to get started:\n\n🎯 Join a Chat – Each conversation earns you points and minutes for cash & rewards.\n\n🏆 Try Weekly Challenges – Participate in fun weekly challenges to earn even more rewards.\n\n✨ Bonus Tip: Check out our "Unlock Rewards Early" button in your profile to get rewards super fast!! Bonus Tip 2: Join 3 new events like Spin to win, Chat to win or Last to Leave Events to earn even FASTER!\n\nIf you have questions, our FAQ page is a great resource, or feel free to reply to this email.\n\nHappy chatting,\n\nThe C24Club Team'
),
(
  'order_placed',
  'Order Placed',
  'Sent when an admin marks a reward redemption as "Order placed".',
  'Triggered from Admin → Member Rewards → Update status to "Order placed".',
  'We just placed your order! 📦',
  E'Hi {{user_name}},\n\nGreat news! 🎉 Your reward has been placed — sit tight and expect another email that will provide the tracking link.\n\nOrder Details:\n• Reward: {{reward_title}}\n• Order Date: {{order_date}}\n\nOur team is awaiting the tracking link, and you''ll be the first to know once the order is being shipped. We''re excited for you to enjoy what you''ve earned on C24Club!\n\nNeed any assistance with your order? Feel free to reply to this email or visit our Help Center.\n\nThank you for being a valued member of C24Club,\n\nThe C24Club Team'
),
(
  'order_shipped',
  'Order Shipped',
  'Sent when an admin marks a reward redemption as "Order shipped" with a tracking URL.',
  'Triggered from Admin → Member Rewards → Update status to "Order shipped".',
  'Your Reward Is on Its Way! 🚚',
  E'Hi {{user_name}},\n\nYour reward is on its way to you! 🎉 We''ve shipped your order, and it should be arriving soon.\n\nShipping Details:\n• Reward: {{reward_title}}\n• Tracking: {{tracking_url}}\n\nYou can track your package with the above link or through the carrier''s website.\n\nThank you for being part of C24Club, and we hope you enjoy your reward!\n\nBest,\nThe C24Club Team'
),
(
  'item_out_of_stock',
  'Item Out of Stock',
  'Sent when a redeemed reward item is no longer available.',
  'Triggered from Admin → Member Rewards → Update status to "Item Out of stock".',
  'Oh No! Item Out Of Stock 🚚',
  E'Hi {{user_name}},\n\nWe searched our inventory and it seems we''re all out of your current item. Please log into C24 Club > Go To Profile > My Rewards. Choose a new item.\n\nReward That Is Out Of Stock:\n• Reward: {{reward_title}}\n\nOnce you choose a new item we can proceed with placing your order!\n\nThank you for being part of C24Club, and we hope you enjoy your reward!\n\nBest,\nThe C24Club Team'
),
(
  'address_not_exist',
  'Address Does Not Exist',
  'Sent when a shipping address cannot be verified.',
  'Triggered from Admin → Member Rewards → Update status to "Address not exist".',
  'Oh No! Your address does not exist! 🚚',
  E'Hi {{user_name}},\n\nWe''re trying to place your order but the address does not exist! 🥲 Please log into C24 Club > Go To Profile > My Rewards. Change Address.\n\nReward Details:\n• Reward: {{reward_title}}\n\nOnce your address is updated we can proceed with placing your order!\n\nThank you for being part of C24Club, and we hope you enjoy your reward!\n\nBest,\nThe C24Club Team'
);
