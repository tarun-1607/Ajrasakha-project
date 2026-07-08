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
      answer_reports: {
        Row: {
          answer: string
          created_at: string
          details: string
          id: string
          message_id: string
          question: string
          reason: string
          status: string
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string
          created_at?: string
          details?: string
          id?: string
          message_id: string
          question?: string
          reason: string
          status?: string
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          details?: string
          id?: string
          message_id?: string
          question?: string
          reason?: string
          status?: string
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diagnosis_history: {
        Row: {
          confidence: number | null
          created_at: string
          crop: string | null
          description: string | null
          disease: string | null
          id: string
          image_path: string
          model: string | null
          organic_treatment: string | null
          prevention: string | null
          provider: string
          region: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          reviewer_status: string
          severity: string | null
          treatment: string | null
          updated_at: string
          user_id: string
          weather_snapshot: Json | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          crop?: string | null
          description?: string | null
          disease?: string | null
          id?: string
          image_path: string
          model?: string | null
          organic_treatment?: string | null
          prevention?: string | null
          provider?: string
          region?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          reviewer_status?: string
          severity?: string | null
          treatment?: string | null
          updated_at?: string
          user_id: string
          weather_snapshot?: Json | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          crop?: string | null
          description?: string | null
          disease?: string | null
          id?: string
          image_path?: string
          model?: string | null
          organic_treatment?: string | null
          prevention?: string | null
          provider?: string
          region?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          reviewer_status?: string
          severity?: string | null
          treatment?: string | null
          updated_at?: string
          user_id?: string
          weather_snapshot?: Json | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          answer: string
          created_at: string
          id: string
          message_id: string
          question: string
          rating: string
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string
          created_at?: string
          id?: string
          message_id: string
          question?: string
          rating: string
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          message_id?: string
          question?: string
          rating?: string
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      golden_answers: {
        Row: {
          answer: string
          block: string | null
          category: string | null
          created_at: string
          crop: string | null
          district: string | null
          embedding: string | null
          id: string
          question: string
          season: string | null
          soil_type: string | null
          source: string | null
          state: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          answer: string
          block?: string | null
          category?: string | null
          created_at?: string
          crop?: string | null
          district?: string | null
          embedding?: string | null
          id?: string
          question: string
          season?: string | null
          soil_type?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          answer?: string
          block?: string | null
          category?: string | null
          created_at?: string
          crop?: string | null
          district?: string | null
          embedding?: string | null
          id?: string
          question?: string
          season?: string | null
          soil_type?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      pending_reviews: {
        Row: {
          answer: string
          created_at: string
          crop: string | null
          edited_answer: string | null
          id: string
          language: string | null
          message_id: string | null
          question: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
          thread_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string
          crop?: string | null
          edited_answer?: string | null
          id?: string
          language?: string | null
          message_id?: string | null
          question: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          thread_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string
          crop?: string | null
          edited_answer?: string | null
          id?: string
          language?: string | null
          message_id?: string | null
          question?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          thread_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pop_answers: {
        Row: {
          answer: string
          block: string | null
          category: string | null
          created_at: string
          crop: string | null
          district: string | null
          embedding: string | null
          id: string
          question: string
          season: string | null
          soil_type: string | null
          source: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          answer: string
          block?: string | null
          category?: string | null
          created_at?: string
          crop?: string | null
          district?: string | null
          embedding?: string | null
          id?: string
          question: string
          season?: string | null
          soil_type?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string
          block?: string | null
          category?: string | null
          created_at?: string
          crop?: string | null
          district?: string | null
          embedding?: string | null
          id?: string
          question?: string
          season?: string | null
          soil_type?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          block: string
          created_at: string
          current_season: string
          district: string
          email: string
          farm_size: string
          full_name: string
          id: string
          irrigation_type: string
          preferred_language: string
          primary_crop: string
          soil_type: string
          state: string
          updated_at: string
          village: string
        }
        Insert: {
          block?: string
          created_at?: string
          current_season?: string
          district?: string
          email: string
          farm_size?: string
          full_name?: string
          id: string
          irrigation_type?: string
          preferred_language?: string
          primary_crop?: string
          soil_type?: string
          state?: string
          updated_at?: string
          village?: string
        }
        Update: {
          block?: string
          created_at?: string
          current_season?: string
          district?: string
          email?: string
          farm_size?: string
          full_name?: string
          id?: string
          irrigation_type?: string
          preferred_language?: string
          primary_crop?: string
          soil_type?: string
          state?: string
          updated_at?: string
          village?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weather_cache: {
        Row: {
          block: string | null
          created_at: string
          district: string | null
          fetched_at: string
          id: string
          latitude: number | null
          location_key: string
          longitude: number | null
          state: string | null
          updated_at: string
          weather: Json
        }
        Insert: {
          block?: string | null
          created_at?: string
          district?: string | null
          fetched_at?: string
          id?: string
          latitude?: number | null
          location_key: string
          longitude?: number | null
          state?: string | null
          updated_at?: string
          weather?: Json
        }
        Update: {
          block?: string | null
          created_at?: string
          district?: string | null
          fetched_at?: string
          id?: string
          latitude?: number | null
          location_key?: string
          longitude?: number | null
          state?: string | null
          updated_at?: string
          weather?: Json
        }
        Relationships: []
      }
      weather_settings: {
        Row: {
          cache_minutes: number
          cold_wave_c: number
          created_at: string
          enabled: boolean
          frost_c: number
          heat_wave_c: number
          heavy_rain_mm: number
          id: string
          spray_rain_prob_max: number
          spray_wind_max_kmh: number
          strong_wind_kmh: number
          updated_at: string
        }
        Insert: {
          cache_minutes?: number
          cold_wave_c?: number
          created_at?: string
          enabled?: boolean
          frost_c?: number
          heat_wave_c?: number
          heavy_rain_mm?: number
          id?: string
          spray_rain_prob_max?: number
          spray_wind_max_kmh?: number
          strong_wind_kmh?: number
          updated_at?: string
        }
        Update: {
          cache_minutes?: number
          cold_wave_c?: number
          created_at?: string
          enabled?: boolean
          frost_c?: number
          heat_wave_c?: number
          heavy_rain_mm?: number
          id?: string
          spray_rain_prob_max?: number
          spray_wind_max_kmh?: number
          strong_wind_kmh?: number
          updated_at?: string
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
      is_reviewer_or_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "reviewer"
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
      app_role: ["admin", "moderator", "user", "reviewer"],
    },
  },
} as const
