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
      lesson_progress: {
        Row: {
          completed_at: string
          lesson_id: string
          times_practiced: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          lesson_id: string
          times_practiced?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          lesson_id?: string
          times_practiced?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          bpm: number
          category: string
          created_at: string
          duration_target_sec: number | null
          id: string
          instructions: string
          level: string
          loop_count: number
          order_index: number
          pattern: string | null
          slug: string
          tala: string | null
          target_sa: string
          title: string
          tradition: string
        }
        Insert: {
          bpm?: number
          category: string
          created_at?: string
          duration_target_sec?: number | null
          id?: string
          instructions: string
          level: string
          loop_count?: number
          order_index?: number
          pattern?: string | null
          slug: string
          tala?: string | null
          target_sa?: string
          title: string
          tradition: string
        }
        Update: {
          bpm?: number
          category?: string
          created_at?: string
          duration_target_sec?: number | null
          id?: string
          instructions?: string
          level?: string
          loop_count?: number
          order_index?: number
          pattern?: string | null
          slug?: string
          tala?: string | null
          target_sa?: string
          title?: string
          tradition?: string
        }
        Relationships: []
      }
      practice_sessions: {
        Row: {
          created_at: string
          duration_sec: number
          ended_at: string | null
          id: string
          lesson_id: string | null
          notes: string | null
          pitch_stats: Json | null
          started_at: string
          tools: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_sec?: number
          ended_at?: string | null
          id?: string
          lesson_id?: string | null
          notes?: string | null
          pitch_stats?: Json | null
          started_at?: string
          tools?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          duration_sec?: number
          ended_at?: string | null
          id?: string
          lesson_id?: string | null
          notes?: string | null
          pitch_stats?: Json | null
          started_at?: string
          tools?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_sa: string
          display_name: string | null
          id: string
          tradition: string
          updated_at: string
          voice_type: string | null
        }
        Insert: {
          created_at?: string
          default_sa?: string
          display_name?: string | null
          id: string
          tradition?: string
          updated_at?: string
          voice_type?: string | null
        }
        Update: {
          created_at?: string
          default_sa?: string
          display_name?: string | null
          id?: string
          tradition?: string
          updated_at?: string
          voice_type?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          default_bpm: number
          default_sa: string
          default_tala: string
          updated_at: string
          user_id: string
        }
        Insert: {
          default_bpm?: number
          default_sa?: string
          default_tala?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          default_bpm?: number
          default_sa?: string
          default_tala?: string
          updated_at?: string
          user_id?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
