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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      cows: {
        Row: {
          breed: string
          cow_id: string
          created_at: string
          current_status: string
          date_acquired: string | null
          date_of_birth: string | null
          gender: string
          health_status: string
          id: string
          name: string
          notes: string | null
          photo: string | null
          weight: number | null
        }
        Insert: {
          breed?: string
          cow_id: string
          created_at?: string
          current_status?: string
          date_acquired?: string | null
          date_of_birth?: string | null
          gender?: string
          health_status?: string
          id?: string
          name: string
          notes?: string | null
          photo?: string | null
          weight?: number | null
        }
        Update: {
          breed?: string
          cow_id?: string
          created_at?: string
          current_status?: string
          date_acquired?: string | null
          date_of_birth?: string | null
          gender?: string
          health_status?: string
          id?: string
          name?: string
          notes?: string | null
          photo?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          notes: string | null
          payment_status: string
          supplier: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_status?: string
          supplier?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          notes?: string | null
          payment_status?: string
          supplier?: string | null
        }
        Relationships: []
      }
      farm: {
        Row: {
          contact: string | null
          created_at: string
          email: string | null
          farm_name: string
          id: string
          location: string | null
          owner_name: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          email?: string | null
          farm_name: string
          id?: string
          location?: string | null
          owner_name?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          email?: string | null
          farm_name?: string
          id?: string
          location?: string | null
          owner_name?: string | null
        }
        Relationships: []
      }
      feed_inventory: {
        Row: {
          cost: number
          created_at: string
          daily_usage: number
          expiry_date: string | null
          feed_name: string
          feed_type: string
          id: string
          minimum_stock: number
          notes: string | null
          purchase_date: string | null
          quantity: number
          supplier: string | null
          unit: string
        }
        Insert: {
          cost?: number
          created_at?: string
          daily_usage?: number
          expiry_date?: string | null
          feed_name: string
          feed_type?: string
          id?: string
          minimum_stock?: number
          notes?: string | null
          purchase_date?: string | null
          quantity?: number
          supplier?: string | null
          unit?: string
        }
        Update: {
          cost?: number
          created_at?: string
          daily_usage?: number
          expiry_date?: string | null
          feed_name?: string
          feed_type?: string
          id?: string
          minimum_stock?: number
          notes?: string | null
          purchase_date?: string | null
          quantity?: number
          supplier?: string | null
          unit?: string
        }
        Relationships: []
      }
      feed_usage: {
        Row: {
          created_at: string
          date: string
          feed_id: string
          id: string
          notes: string | null
          number_of_cows: number | null
          quantity_used: number
        }
        Insert: {
          created_at?: string
          date?: string
          feed_id: string
          id?: string
          notes?: string | null
          number_of_cows?: number | null
          quantity_used?: number
        }
        Update: {
          created_at?: string
          date?: string
          feed_id?: string
          id?: string
          notes?: string | null
          number_of_cows?: number | null
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "feed_usage_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "feed_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          amount: number
          category: string
          created_at: string
          customer: string | null
          date: string
          id: string
          milk_quantity: number | null
          notes: string | null
          payment_status: string
          price_per_litre: number | null
          source: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          customer?: string | null
          date?: string
          id?: string
          milk_quantity?: number | null
          notes?: string | null
          payment_status?: string
          price_per_litre?: number | null
          source?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          customer?: string | null
          date?: string
          id?: string
          milk_quantity?: number | null
          notes?: string | null
          payment_status?: string
          price_per_litre?: number | null
          source?: string | null
        }
        Relationships: []
      }
      milk_records: {
        Row: {
          cow_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          quantity: number
          recorded_by: string | null
          session: string
        }
        Insert: {
          cow_id: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          session?: string
        }
        Update: {
          cow_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          session?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_records_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          is_read: boolean
          priority: string
          related_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          is_read?: boolean
          priority?: string
          related_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          is_read?: boolean
          priority?: string
          related_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          photo: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string
          photo?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          photo?: string | null
          role?: string
        }
        Relationships: []
      }
      vaccinations: {
        Row: {
          cow_id: string
          created_at: string
          id: string
          is_completed: boolean
          next_due_date: string | null
          notes: string | null
          vaccination_date: string
          vaccine_name: string
        }
        Insert: {
          cow_id: string
          created_at?: string
          id?: string
          is_completed?: boolean
          next_due_date?: string | null
          notes?: string | null
          vaccination_date?: string
          vaccine_name: string
        }
        Update: {
          cow_id?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          next_due_date?: string | null
          notes?: string | null
          vaccination_date?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_cow_id_fkey"
            columns: ["cow_id"]
            isOneToOne: false
            referencedRelation: "cows"
            referencedColumns: ["id"]
          },
        ]
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
