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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          callee_id: string
          caller_id: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["call_kind"]
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
        }
        Insert: {
          callee_id: string
          caller_id: string
          ended_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["call_kind"]
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Update: {
          callee_id?: string
          caller_id?: string
          ended_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["call_kind"]
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          nickname: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          nickname?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          nickname?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_profile_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_owner_profile_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          chat_background: string | null
          chat_theme: string | null
          conversation_id: string
          id: string
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          joined_at: string
          last_read_at: string
          muted_until: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          chat_background?: string | null
          chat_theme?: string | null
          conversation_id: string
          id?: string
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string
          muted_until?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          chat_background?: string | null
          chat_theme?: string | null
          conversation_id?: string
          id?: string
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string
          muted_until?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_suspended: boolean
          last_message_at: string
          name: string | null
          only_admins_add_members: boolean
          only_admins_edit_info: boolean
          type: Database["public"]["Enums"]["conv_type"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_suspended?: boolean
          last_message_at?: string
          name?: string | null
          only_admins_add_members?: boolean
          only_admins_edit_info?: boolean
          type?: Database["public"]["Enums"]["conv_type"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_suspended?: boolean
          last_message_at?: string
          name?: string | null
          only_admins_add_members?: boolean
          only_admins_edit_info?: boolean
          type?: Database["public"]["Enums"]["conv_type"]
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          blocked_by: string | null
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          blocked_by?: string | null
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
          updated_at?: string
        }
        Relationships: []
      }
      message_deletions: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deletions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          media_duration: number | null
          media_url: string | null
          reply_to: string | null
          sender_id: string
          type: Database["public"]["Enums"]["msg_type"]
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          media_duration?: number | null
          media_url?: string | null
          reply_to?: string | null
          sender_id: string
          type?: Database["public"]["Enums"]["msg_type"]
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          media_duration?: number | null
          media_url?: string | null
          reply_to?: string | null
          sender_id?: string
          type?: Database["public"]["Enums"]["msg_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          discoverable: boolean
          display_name: string
          id: string
          is_online: boolean
          last_seen: string
          notify_groups: boolean
          notify_messages: boolean
          notify_video_calls: boolean
          notify_voice_calls: boolean
          notify_xups: boolean
          show_online_status: boolean
          show_read_receipts: boolean
          status: Database["public"]["Enums"]["account_status"]
          suspended_until: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          discoverable?: boolean
          display_name?: string
          id: string
          is_online?: boolean
          last_seen?: string
          notify_groups?: boolean
          notify_messages?: boolean
          notify_video_calls?: boolean
          notify_voice_calls?: boolean
          notify_xups?: boolean
          show_online_status?: boolean
          show_read_receipts?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          suspended_until?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          discoverable?: boolean
          display_name?: string
          id?: string
          is_online?: boolean
          last_seen?: string
          notify_groups?: boolean
          notify_messages?: boolean
          notify_video_calls?: boolean
          notify_voice_calls?: boolean
          notify_xups?: boolean
          show_online_status?: boolean
          show_read_receipts?: boolean
          status?: Database["public"]["Enums"]["account_status"]
          suspended_until?: string | null
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
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
      xup_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          user_id: string
          xup_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          user_id: string
          xup_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          user_id?: string
          xup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xup_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "xup_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xup_comments_xup_id_fkey"
            columns: ["xup_id"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
      xup_mutes: {
        Row: {
          created_at: string
          id: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      xup_reactions: {
        Row: {
          created_at: string
          id: string
          reaction: string
          user_id: string
          xup_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction: string
          user_id: string
          xup_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string
          user_id?: string
          xup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xup_reactions_xup_id_fkey"
            columns: ["xup_id"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
      xup_saves: {
        Row: {
          created_at: string
          id: string
          user_id: string
          xup_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          xup_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          xup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xup_saves_xup_id_fkey"
            columns: ["xup_id"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
      xup_views: {
        Row: {
          id: string
          viewed_at: string
          viewer_id: string
          xup_id: string
        }
        Insert: {
          id?: string
          viewed_at?: string
          viewer_id: string
          xup_id: string
        }
        Update: {
          id?: string
          viewed_at?: string
          viewer_id?: string
          xup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xup_views_xup_id_fkey"
            columns: ["xup_id"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
      xups: {
        Row: {
          audience: Database["public"]["Enums"]["xup_audience"]
          audience_ids: string[]
          background: string | null
          caption: string | null
          content: string | null
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          kind: Database["public"]["Enums"]["xup_kind"]
          media_url: string | null
          reshared_from: string | null
          user_id: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["xup_audience"]
          audience_ids?: string[]
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["xup_kind"]
          media_url?: string | null
          reshared_from?: string | null
          user_id: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["xup_audience"]
          audience_ids?: string[]
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["xup_kind"]
          media_url?: string | null
          reshared_from?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xups_reshared_from_fkey"
            columns: ["reshared_from"]
            isOneToOne: false
            referencedRelation: "xups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      can_view_xup: {
        Args: { _viewer: string; _xup_id: string }
        Returns: boolean
      }
      get_or_create_direct: { Args: { _other: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_blocked_between: { Args: { _a: string; _b: string }; Returns: boolean }
      is_conv_admin: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_member: { Args: { _conv: string; _user: string }; Returns: boolean }
    }
    Enums: {
      account_status: "active" | "suspended" | "banned"
      app_role: "master_admin" | "admin" | "user"
      call_kind: "voice" | "video"
      call_status:
        | "ringing"
        | "accepted"
        | "declined"
        | "missed"
        | "ended"
        | "failed"
      conv_type: "direct" | "group"
      friend_status: "pending" | "accepted" | "blocked"
      member_role: "owner" | "admin" | "member"
      msg_type: "text" | "image" | "video" | "audio" | "system" | "sticker"
      report_status: "open" | "resolved" | "rejected"
      report_target: "user" | "message" | "group" | "media"
      xup_audience: "contacts" | "contacts_except" | "only"
      xup_kind: "text" | "image" | "video"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_status: ["active", "suspended", "banned"],
      app_role: ["master_admin", "admin", "user"],
      call_kind: ["voice", "video"],
      call_status: [
        "ringing",
        "accepted",
        "declined",
        "missed",
        "ended",
        "failed",
      ],
      conv_type: ["direct", "group"],
      friend_status: ["pending", "accepted", "blocked"],
      member_role: ["owner", "admin", "member"],
      msg_type: ["text", "image", "video", "audio", "system", "sticker"],
      report_status: ["open", "resolved", "rejected"],
      report_target: ["user", "message", "group", "media"],
      xup_audience: ["contacts", "contacts_except", "only"],
      xup_kind: ["text", "image", "video"],
    },
  },
} as const
