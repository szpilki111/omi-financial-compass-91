export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_section_mappings: {
        Row: {
          account_prefix: string
          created_at: string
          id: string
          report_type: Database["public"]["Enums"]["report_type"]
          section_id: string
          updated_at: string
        }
        Insert: {
          account_prefix: string
          created_at?: string
          id?: string
          report_type: Database["public"]["Enums"]["report_type"]
          section_id: string
          updated_at?: string
        }
        Update: {
          account_prefix?: string
          created_at?: string
          id?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_section_mappings_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "report_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          id: string
          name: string
          number: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          number: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          number?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_date: string
          document_name: string
          document_number: string
          id: string
          location_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_date: string
          document_name: string
          document_number: string
          id?: string
          location_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_date?: string
          document_name?: string
          document_number?: string
          id?: string
          location_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_accounts: {
        Row: {
          account_id: string
          created_at: string
          id: string
          location_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          location_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_settings: {
        Row: {
          created_at: string
          house_abbreviation: string
          id: string
          location_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          house_abbreviation: string
          id?: string
          location_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          house_abbreviation?: string
          id?: string
          location_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_settings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_label: string | null
          action_link: string | null
          created_at: string
          date: string
          id: string
          message: string
          priority: string
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_link?: string | null
          created_at?: string
          date?: string
          id?: string
          message: string
          priority: string
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_link?: string | null
          created_at?: string
          date?: string
          id?: string
          message?: string
          priority?: string
          read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          location_id: string | null
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          location_id?: string | null
          name: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          location_id?: string | null
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_account_details: {
        Row: {
          account_id: string
          account_name: string
          account_number: string
          account_type: string
          created_at: string | null
          id: string
          report_id: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          account_id: string
          account_name: string
          account_number: string
          account_type: string
          created_at?: string | null
          id?: string
          report_id: string
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          account_name?: string
          account_number?: string
          account_type?: string
          created_at?: string | null
          id?: string
          report_id?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_account_details_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_account_details_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_details: {
        Row: {
          balance: number
          closing_balance: number | null
          created_at: string
          expense_total: number
          id: string
          income_total: number
          opening_balance: number | null
          report_id: string
          settlements_total: number
          updated_at: string
        }
        Insert: {
          balance?: number
          closing_balance?: number | null
          created_at?: string
          expense_total?: number
          id?: string
          income_total?: number
          opening_balance?: number | null
          report_id: string
          settlements_total?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          closing_balance?: number | null
          created_at?: string
          expense_total?: number
          id?: string
          income_total?: number
          opening_balance?: number | null
          report_id?: string
          settlements_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_details_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_entries: {
        Row: {
          account_name: string
          account_number: string
          created_at: string
          credit_closing: number | null
          credit_opening: number | null
          credit_turnover: number | null
          debit_closing: number | null
          debit_opening: number | null
          debit_turnover: number | null
          id: string
          report_id: string
          section_id: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          created_at?: string
          credit_closing?: number | null
          credit_opening?: number | null
          credit_turnover?: number | null
          debit_closing?: number | null
          debit_opening?: number | null
          debit_turnover?: number | null
          id?: string
          report_id: string
          section_id?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          created_at?: string
          credit_closing?: number | null
          credit_opening?: number | null
          credit_turnover?: number | null
          debit_closing?: number | null
          debit_opening?: number | null
          debit_turnover?: number | null
          id?: string
          report_id?: string
          section_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_entries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "report_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      report_sections: {
        Row: {
          created_at: string
          id: string
          name: string
          report_type: Database["public"]["Enums"]["report_type"]
          section_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          report_type: Database["public"]["Enums"]["report_type"]
          section_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          section_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          location_id: string
          month: number
          period: string
          report_type: Database["public"]["Enums"]["report_type"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          location_id: string
          month: number
          period: string
          report_type?: Database["public"]["Enums"]["report_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          location_id?: string
          month?: number
          period?: string
          report_type?: Database["public"]["Enums"]["report_type"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number | null
          created_at: string
          credit_account_id: string | null
          credit_amount: number | null
          currency: string
          date: string
          debit_account_id: string | null
          debit_amount: number | null
          description: string
          document_id: string | null
          document_number: string | null
          exchange_rate: number | null
          id: string
          is_split_transaction: boolean | null
          location_id: string
          parent_transaction_id: string | null
          settlement_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          credit_account_id?: string | null
          credit_amount?: number | null
          currency?: string
          date: string
          debit_account_id?: string | null
          debit_amount?: number | null
          description: string
          document_id?: string | null
          document_number?: string | null
          exchange_rate?: number | null
          id?: string
          is_split_transaction?: boolean | null
          location_id: string
          parent_transaction_id?: string | null
          settlement_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          credit_account_id?: string | null
          credit_amount?: number | null
          currency?: string
          date?: string
          debit_account_id?: string | null
          debit_amount?: number | null
          description?: string
          document_id?: string | null
          document_number?: string | null
          exchange_rate?: number | null
          id?: string
          is_split_transaction?: boolean | null
          location_id?: string
          parent_transaction_id?: string | null
          settlement_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          windows98_style: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          windows98_style?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          windows98_style?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_user_password: {
        Args:
          | { user_id: number; new_password: string }
          | { user_id: string; new_password: string }
        Returns: boolean
      }
      create_user_admin: {
        Args: {
          user_email: string
          user_password: string
          user_name: string
          user_role: string
          user_location_id?: string
        }
        Returns: string
      }
      delete_document_with_transactions: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      delete_user_admin: {
        Args: { user_id_to_delete: string }
        Returns: undefined
      }
      generate_document_number: {
        Args: { p_location_id: string; p_year: number; p_month: number }
        Returns: string
      }
      get_current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_id_fixed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_location_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_setting: {
        Args: { p_user_id: string }
        Returns: {
          windows98_style: boolean
        }[]
      }
      insert_profile_admin: {
        Args:
          | { user_id: number; profile_data: Json }
          | {
              user_id: string
              user_name: string
              user_role: string
              user_email: string
              location_id?: string
            }
        Returns: undefined
      }
      upsert_user_setting: {
        Args: { p_user_id: string; p_windows98_style: boolean }
        Returns: undefined
      }
    }
    Enums: {
      report_type:
        | "standard"
        | "zos"
        | "bilans"
        | "rzis"
        | "jpk"
        | "analiza"
        | "monthly"
        | "annual"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      report_type: [
        "standard",
        "zos",
        "bilans",
        "rzis",
        "jpk",
        "analiza",
        "monthly",
        "annual",
      ],
    },
  },
} as const
