export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      anchor_earnings: {
        Row: {
          amount: number
          created_at: string
          earning_type: string
          id: string
          reward_id: string | null
          reward_title: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          earning_type?: string
          id?: string
          reward_id?: string | null
          reward_title?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          earning_type?: string
          id?: string
          reward_id?: string | null
          reward_title?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anchor_earnings_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          paypal_email: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          paypal_email?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paypal_email?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      anchor_queue: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      anchor_sessions: {
        Row: {
          cash_balance: number
          created_at: string
          current_mode: string
          elapsed_seconds: number
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_balance?: number
          created_at?: string
          current_mode?: string
          elapsed_seconds?: number
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_balance?: number
          created_at?: string
          current_mode?: string
          elapsed_seconds?: number
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      anchor_settings: {
        Row: {
          chill_hour_start: string
          chill_reward_time: number
          id: string
          max_anchor_cap: number
          power_hour_end: string
          power_hour_start: string
          power_rate_cash: number
          power_rate_time: number
          updated_at: string
        }
        Insert: {
          chill_hour_start?: string
          chill_reward_time?: number
          id?: string
          max_anchor_cap?: number
          power_hour_end?: string
          power_hour_start?: string
          power_rate_cash?: number
          power_rate_time?: number
          updated_at?: string
        }
        Update: {
          chill_hour_start?: string
          chill_reward_time?: number
          id?: string
          max_anchor_cap?: number
          power_hour_end?: string
          power_hour_start?: string
          power_rate_cash?: number
          power_rate_time?: number
          updated_at?: string
        }
        Relationships: []
      }
      call_minutes_log: {
        Row: {
          created_at: string
          id: string
          minutes_earned: number
          partner_id: string
          session_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes_earned?: number
          partner_id: string
          session_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes_earned?: number
          partner_id?: string
          session_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_submissions: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          proof_image_url: string | null
          proof_text: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          proof_image_url?: string | null
          proof_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          proof_image_url?: string | null
          proof_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          subject: string
          template_key: string
          trigger_info: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject: string
          template_key: string
          trigger_info?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          template_key?: string
          trigger_info?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      freeze_settings: {
        Row: {
          frozen_earn_rate: number
          id: string
          minute_threshold: number
          one_time_unfreeze_price: number
          updated_at: string
          vip_unfreezes_per_month: number
        }
        Insert: {
          frozen_earn_rate?: number
          id?: string
          minute_threshold?: number
          one_time_unfreeze_price?: number
          updated_at?: string
          vip_unfreezes_per_month?: number
        }
        Update: {
          frozen_earn_rate?: number
          id?: string
          minute_threshold?: number
          one_time_unfreeze_price?: number
          updated_at?: string
          vip_unfreezes_per_month?: number
        }
        Relationships: []
      }
      gift_cards: {
        Row: {
          brand: string
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          id: string
          image_url: string | null
          minutes_cost: number
          status: string
          updated_at: string
          value_amount: number
        }
        Insert: {
          brand: string
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          id?: string
          image_url?: string | null
          minutes_cost?: number
          status?: string
          updated_at?: string
          value_amount?: number
        }
        Update: {
          brand?: string
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          id?: string
          image_url?: string | null
          minutes_cost?: number
          status?: string
          updated_at?: string
          value_amount?: number
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          created_at: string
          id: string
          minutes_amount: number
          price_cents: number
          recipient_id: string
          sender_id: string
          status: string
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes_amount: number
          price_cents: number
          recipient_id: string
          sender_id: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes_amount?: number
          price_cents?: number
          recipient_id?: string
          sender_id?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      member_minutes: {
        Row: {
          ad_points: number
          cap_popup_shown: boolean
          ce_minutes_checkpoint: number
          chance_enhancer: number
          freeze_free_until: string | null
          frozen_at: string | null
          frozen_cap_popup_shown: boolean
          id: string
          is_frozen: boolean
          is_vip: boolean
          last_login_at: string | null
          last_streak_login_at: string | null
          login_streak: number
          nsfw_strikes: number
          purchased_spins: number
          streak_rewards_claimed: Json
          stripe_customer_id: string | null
          subscription_end: string | null
          total_minutes: number
          updated_at: string
          user_id: string
          vip_tier: string | null
          vip_unfreezes_reset_at: string | null
          vip_unfreezes_used: number
        }
        Insert: {
          ad_points?: number
          cap_popup_shown?: boolean
          ce_minutes_checkpoint?: number
          chance_enhancer?: number
          freeze_free_until?: string | null
          frozen_at?: string | null
          frozen_cap_popup_shown?: boolean
          id?: string
          is_frozen?: boolean
          is_vip?: boolean
          last_login_at?: string | null
          last_streak_login_at?: string | null
          login_streak?: number
          nsfw_strikes?: number
          purchased_spins?: number
          streak_rewards_claimed?: Json
          stripe_customer_id?: string | null
          subscription_end?: string | null
          total_minutes?: number
          updated_at?: string
          user_id: string
          vip_tier?: string | null
          vip_unfreezes_reset_at?: string | null
          vip_unfreezes_used?: number
        }
        Update: {
          ad_points?: number
          cap_popup_shown?: boolean
          ce_minutes_checkpoint?: number
          chance_enhancer?: number
          freeze_free_until?: string | null
          frozen_at?: string | null
          frozen_cap_popup_shown?: boolean
          id?: string
          is_frozen?: boolean
          is_vip?: boolean
          last_login_at?: string | null
          last_streak_login_at?: string | null
          login_streak?: number
          nsfw_strikes?: number
          purchased_spins?: number
          streak_rewards_claimed?: Json
          stripe_customer_id?: string | null
          subscription_end?: string | null
          total_minutes?: number
          updated_at?: string
          user_id?: string
          vip_tier?: string | null
          vip_unfreezes_reset_at?: string | null
          vip_unfreezes_used?: number
        }
        Relationships: []
      }
      member_redemptions: {
        Row: {
          address_exists: string | null
          cashout_amount: number | null
          cashout_paypal: string | null
          cashout_status: string | null
          created_at: string
          id: string
          minutes_cost: number
          notes: string | null
          reward_id: string | null
          reward_image_url: string | null
          reward_rarity: string
          reward_title: string
          reward_type: string
          shipping_address: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_name: string | null
          shipping_state: string | null
          shipping_tracking_url: string | null
          shipping_zip: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_exists?: string | null
          cashout_amount?: number | null
          cashout_paypal?: string | null
          cashout_status?: string | null
          created_at?: string
          id?: string
          minutes_cost?: number
          notes?: string | null
          reward_id?: string | null
          reward_image_url?: string | null
          reward_rarity?: string
          reward_title: string
          reward_type?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_state?: string | null
          shipping_tracking_url?: string | null
          shipping_zip?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_exists?: string | null
          cashout_amount?: number | null
          cashout_paypal?: string | null
          cashout_status?: string | null
          created_at?: string
          id?: string
          minutes_cost?: number
          notes?: string | null
          reward_id?: string | null
          reward_image_url?: string | null
          reward_rarity?: string
          reward_title?: string
          reward_type?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_state?: string | null
          shipping_tracking_url?: string | null
          shipping_zip?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          birthdate: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          gender: string | null
          id: string
          image_thumb_url: string | null
          image_url: string | null
          membership: string | null
          name: string
          profession: string | null
          state: string | null
          stats: string | null
          title: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          birthdate?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          image_thumb_url?: string | null
          image_url?: string | null
          membership?: string | null
          name: string
          profession?: string | null
          state?: string | null
          stats?: string | null
          title?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          birthdate?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          image_thumb_url?: string | null
          image_url?: string | null
          membership?: string | null
          name?: string
          profession?: string | null
          state?: string | null
          stats?: string | null
          title?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      milestone_rewards: {
        Row: {
          created_at: string
          id: string
          milestone_id: string
          reward_id: string
          reward_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_id: string
          reward_id: string
          reward_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          milestone_id?: string
          reward_id?: string
          reward_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_rewards_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          brief: string | null
          created_at: string
          enable_shipping: boolean
          id: string
          title: string
          unlock_minutes: number
          updated_at: string
          vip_only: boolean
        }
        Insert: {
          brief?: string | null
          created_at?: string
          enable_shipping?: boolean
          id?: string
          title: string
          unlock_minutes?: number
          updated_at?: string
          vip_only?: boolean
        }
        Update: {
          brief?: string | null
          created_at?: string
          enable_shipping?: boolean
          id?: string
          title?: string
          unlock_minutes?: number
          updated_at?: string
          vip_only?: boolean
        }
        Relationships: []
      }
      pinned_topics: {
        Row: {
          created_at: string
          id: string
          topic_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          topic_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_analytics: {
        Row: {
          id: string
          link_clicked: boolean
          paused: boolean
          promo_id: string
          viewed_at: string
          viewer_id: string
          watch_time_seconds: number
        }
        Insert: {
          id?: string
          link_clicked?: boolean
          paused?: boolean
          promo_id: string
          viewed_at?: string
          viewer_id: string
          watch_time_seconds?: number
        }
        Update: {
          id?: string
          link_clicked?: boolean
          paused?: boolean
          promo_id?: string
          viewed_at?: string
          viewer_id?: string
          watch_time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_analytics_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promos"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_templates: {
        Row: {
          ad_points_balance: number | null
          country: string | null
          created_at: string
          description: string | null
          gender: string | null
          id: string
          image_url: string | null
          interest: string | null
          sameuser: boolean | null
          title: string | null
          url: string | null
          url_text: string | null
          user_id: string
        }
        Insert: {
          ad_points_balance?: number | null
          country?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          image_url?: string | null
          interest?: string | null
          sameuser?: boolean | null
          title?: string | null
          url?: string | null
          url_text?: string | null
          user_id: string
        }
        Update: {
          ad_points_balance?: number | null
          country?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          image_url?: string | null
          interest?: string | null
          sameuser?: boolean | null
          title?: string | null
          url?: string | null
          url_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      promos: {
        Row: {
          ad_points_balance: number | null
          country: string | null
          created_at: string
          description: string | null
          gender: string | null
          id: string
          image_thumb_url: string | null
          interest: string | null
          is_active: boolean | null
          member_id: string | null
          promo_type: string | null
          sameuser: boolean | null
          status: string | null
          title: string
          updated_at: string
          url: string | null
          url_text: string | null
        }
        Insert: {
          ad_points_balance?: number | null
          country?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          image_thumb_url?: string | null
          interest?: string | null
          is_active?: boolean | null
          member_id?: string | null
          promo_type?: string | null
          sameuser?: boolean | null
          status?: string | null
          title: string
          updated_at?: string
          url?: string | null
          url_text?: string | null
        }
        Update: {
          ad_points_balance?: number | null
          country?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          image_thumb_url?: string | null
          interest?: string | null
          is_active?: boolean | null
          member_id?: string | null
          promo_type?: string | null
          sameuser?: boolean | null
          status?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          url_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promos_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          show_as: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          show_as?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          show_as?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          brief: string | null
          cashout_value: number
          category_id: string | null
          color_options: Json | null
          created_at: string
          delivery: string | null
          feature_image_url: string | null
          grant_amount: number
          id: string
          image_url: string | null
          info: string | null
          minutes_cost: number
          product_name: string | null
          rarity: string
          shipping_fee: number
          ships_to: string[] | null
          sizes: string | null
          sub_type: string | null
          title: string
          type: string
          updated_at: string
          variation_images: string[] | null
          visible: boolean
        }
        Insert: {
          brief?: string | null
          cashout_value?: number
          category_id?: string | null
          color_options?: Json | null
          created_at?: string
          delivery?: string | null
          feature_image_url?: string | null
          grant_amount?: number
          id?: string
          image_url?: string | null
          info?: string | null
          minutes_cost?: number
          product_name?: string | null
          rarity?: string
          shipping_fee?: number
          ships_to?: string[] | null
          sizes?: string | null
          sub_type?: string | null
          title: string
          type: string
          updated_at?: string
          variation_images?: string[] | null
          visible?: boolean
        }
        Update: {
          brief?: string | null
          cashout_value?: number
          category_id?: string | null
          color_options?: Json | null
          created_at?: string
          delivery?: string | null
          feature_image_url?: string | null
          grant_amount?: number
          id?: string
          image_url?: string | null
          info?: string | null
          minutes_cost?: number
          product_name?: string | null
          rarity?: string
          shipping_fee?: number
          ships_to?: string[] | null
          sizes?: string | null
          sub_type?: string | null
          title?: string
          type?: string
          updated_at?: string
          variation_images?: string[] | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rewards_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "reward_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          channel1: string
          channel2: string | null
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          id: string
          member1: string
          member1_gender: string | null
          member2: string | null
          member2_gender: string | null
          status: string
        }
        Insert: {
          channel1: string
          channel2?: string | null
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          member1: string
          member1_gender?: string | null
          member2?: string | null
          member2_gender?: string | null
          status?: string
        }
        Update: {
          channel1?: string
          channel2?: string | null
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          member1?: string
          member1_gender?: string | null
          member2?: string | null
          member2_gender?: string | null
          status?: string
        }
        Relationships: []
      }
      spin_prizes: {
        Row: {
          amount: number
          chance_percent: number
          created_at: string
          id: string
          is_active: boolean
          label: string
          prize_type: string
          rarity: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          chance_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          prize_type: string
          rarity?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          chance_percent?: number
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          prize_type?: string
          rarity?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      spin_results: {
        Row: {
          awarded: boolean
          created_at: string
          id: string
          prize_amount: number
          prize_id: string | null
          prize_label: string
          prize_type: string
          user_id: string
        }
        Insert: {
          awarded?: boolean
          created_at?: string
          id?: string
          prize_amount?: number
          prize_id?: string | null
          prize_label: string
          prize_type: string
          user_id: string
        }
        Update: {
          awarded?: boolean
          created_at?: string
          id?: string
          prize_amount?: number
          prize_id?: string | null
          prize_label?: string
          prize_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spin_results_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "spin_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "topic_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          ban_type: string
          banned_by: string | null
          created_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          reason: string
          unban_payment_session: string | null
          unbanned_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ban_type?: string
          banned_by?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          reason?: string
          unban_payment_session?: string | null
          unbanned_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_by?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          reason?: string
          unban_payment_session?: string | null
          unbanned_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          room_id: string | null
          screenshot_url: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          room_id?: string | null
          screenshot_url?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          room_id?: string | null
          screenshot_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vip_settings: {
        Row: {
          created_at: string
          get_gifted: boolean
          id: string
          pinned_socials: string[] | null
          show_promo_ads: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          get_gifted?: boolean
          id?: string
          pinned_socials?: string[] | null
          show_promo_ads?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          get_gifted?: boolean
          id?: string
          pinned_socials?: string[] | null
          show_promo_ads?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waiting_queue: {
        Row: {
          channel_id: string
          created_at: string
          gender_preference: string | null
          id: string
          member_gender: string | null
          member_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          gender_preference?: string | null
          id?: string
          member_gender?: string | null
          member_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          gender_preference?: string | null
          id?: string
          member_gender?: string | null
          member_id?: string
        }
        Relationships: []
      }
      weekly_challenges: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atomic_increment_minutes: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
