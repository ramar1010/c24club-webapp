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
      member_minutes: {
        Row: {
          cap_popup_shown: boolean
          id: string
          is_vip: boolean
          total_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cap_popup_shown?: boolean
          id?: string
          is_vip?: boolean
          total_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cap_popup_shown?: boolean
          id?: string
          is_vip?: boolean
          total_minutes?: number
          updated_at?: string
          user_id?: string
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
          member_id: string | null
          promo_type: string | null
          sameuser: boolean | null
          status: string | null
          title: string
          updated_at: string
          url: string | null
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
          member_id?: string | null
          promo_type?: string | null
          sameuser?: boolean | null
          status?: string | null
          title: string
          updated_at?: string
          url?: string | null
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
          member_id?: string | null
          promo_type?: string | null
          sameuser?: boolean | null
          status?: string | null
          title?: string
          updated_at?: string
          url?: string | null
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
          category_id: string | null
          created_at: string
          delivery: string | null
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
          visible: boolean
        }
        Insert: {
          brief?: string | null
          category_id?: string | null
          created_at?: string
          delivery?: string | null
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
          visible?: boolean
        }
        Update: {
          brief?: string | null
          category_id?: string | null
          created_at?: string
          delivery?: string | null
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
          is_active?: boolean
          reason?: string
          unban_payment_session?: string | null
          unbanned_at?: string | null
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
