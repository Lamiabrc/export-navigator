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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      watch_digest_log: {
        Row: {
          error: string | null
          id: string
          items_count: number
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          error?: string | null
          id?: string
          items_count?: number
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          error?: string | null
          id?: string
          items_count?: number
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_items: {
        Row: {
          category: Database["public"]["Enums"]["watch_category"] | null
          country: string | null
          created_at: string
          guid: string
          id: string
          impact: string | null
          published_at: string | null
          raw: Json | null
          source_id: string
          summary: string | null
          tags: string[] | null
          title: string | null
          type: string
          url: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["watch_category"] | null
          country?: string | null
          created_at?: string
          guid: string
          id?: string
          impact?: string | null
          published_at?: string | null
          raw?: Json | null
          source_id: string
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          type?: string
          url?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["watch_category"] | null
          country?: string | null
          created_at?: string
          guid?: string
          id?: string
          impact?: string | null
          published_at?: string | null
          raw?: Json | null
          source_id?: string
          summary?: string | null
          tags?: string[] | null
          title?: string | null
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "watch_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_prefs: {
        Row: {
          categories: Database["public"]["Enums"]["watch_category"][] | null
          countries: string[] | null
          created_at: string
          digest_frequency: string | null
          enabled_digest: boolean
          id: string
          keywords: string[] | null
          last_digest_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Database["public"]["Enums"]["watch_category"][] | null
          countries?: string[] | null
          created_at?: string
          digest_frequency?: string | null
          enabled_digest?: boolean
          id?: string
          keywords?: string[] | null
          last_digest_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Database["public"]["Enums"]["watch_category"][] | null
          countries?: string[] | null
          created_at?: string
          digest_frequency?: string | null
          enabled_digest?: boolean
          id?: string
          keywords?: string[] | null
          last_digest_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_sources: {
        Row: {
          category: Database["public"]["Enums"]["watch_category"]
          country: string | null
          created_at: string
          format: string
          id: string
          is_enabled: boolean
          last_checked_at: string | null
          last_error: string | null
          name: string
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["watch_category"]
          country?: string | null
          created_at?: string
          format?: string
          id?: string
          is_enabled?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          name: string
          type?: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: Database["public"]["Enums"]["watch_category"]
          country?: string | null
          created_at?: string
          format?: string
          id?: string
          is_enabled?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          name?: string
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      watch_category:
        | "customs"
        | "trade"
        | "sanctions"
        | "tax_vat"
        | "standards"
        | "logistics"
        | "general"
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
      watch_category: [
        "customs",
        "trade",
        "sanctions",
        "tax_vat",
        "standards",
        "logistics",
        "general",
      ],
    },
  },
} as const
