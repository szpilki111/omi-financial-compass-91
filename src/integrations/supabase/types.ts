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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      account_category_restrictions: {
        Row: {
          account_number_prefix: string
          analytical_required: boolean
          category_prefix: string
          created_at: string
          id: string
          is_restricted: boolean
          updated_at: string
        }
        Insert: {
          account_number_prefix: string
          analytical_required?: boolean
          category_prefix: string
          created_at?: string
          id?: string
          is_restricted?: boolean
          updated_at?: string
        }
        Update: {
          account_number_prefix?: string
          analytical_required?: boolean
          category_prefix?: string
          created_at?: string
          id?: string
          is_restricted?: boolean
          updated_at?: string
        }
        Relationships: []
      }
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
          analytical: boolean
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          id: string
          is_active: boolean
          name: string
          number: string
          type: string
          updated_at: string
        }
        Insert: {
          analytical?: boolean
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          id?: string
          is_active?: boolean
          name: string
          number: string
          type: string
          updated_at?: string
        }
        Update: {
          analytical?: boolean
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          id?: string
          is_active?: boolean
          name?: string
          number?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          category: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          location_id: string | null
          pinned: boolean | null
          title: string
          updated_at: string | null
          visible_to: string[] | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location_id?: string | null
          pinned?: boolean | null
          title: string
          updated_at?: string | null
          visible_to?: string[] | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location_id?: string | null
          pinned?: boolean | null
          title?: string
          updated_at?: string | null
          visible_to?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytical_accounts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          location_id: string
          name: string
          number_suffix: string
          parent_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          location_id: string
          name: string
          number_suffix: string
          parent_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          location_id?: string
          name?: string
          number_suffix?: string
          parent_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytical_accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytical_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          account_type: string
          created_at: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          account_type: string
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          account_type?: string
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      budget_category_mappings: {
        Row: {
          account_prefix: string
          category_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          account_prefix: string
          category_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          account_prefix?: string
          category_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          account_name: string
          account_prefix: string
          account_type: string
          budget_plan_id: string
          created_at: string | null
          forecasted_amount: number | null
          id: string
          planned_amount: number
          previous_year_amount: number | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          account_prefix: string
          account_type: string
          budget_plan_id: string
          created_at?: string | null
          forecasted_amount?: number | null
          id?: string
          planned_amount?: number
          previous_year_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          account_prefix?: string
          account_type?: string
          budget_plan_id?: string
          created_at?: string | null
          forecasted_amount?: number | null
          id?: string
          planned_amount?: number
          previous_year_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_plan_id_fkey"
            columns: ["budget_plan_id"]
            isOneToOne: false
            referencedRelation: "budget_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_plans: {
        Row: {
          additional_expenses: number | null
          additional_expenses_description: string | null
          approved_at: string | null
          approved_by: string | null
          attachments: string[] | null
          comments: string | null
          created_at: string | null
          created_by: string | null
          forecast_method: string
          id: string
          location_id: string
          planned_cost_reduction: number | null
          planned_cost_reduction_description: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          additional_expenses?: number | null
          additional_expenses_description?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachments?: string[] | null
          comments?: string | null
          created_at?: string | null
          created_by?: string | null
          forecast_method?: string
          id?: string
          location_id: string
          planned_cost_reduction?: number | null
          planned_cost_reduction_description?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          additional_expenses?: number | null
          additional_expenses_description?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attachments?: string[] | null
          comments?: string | null
          created_at?: string | null
          created_by?: string | null
          forecast_method?: string
          id?: string
          location_id?: string
          planned_cost_reduction?: number | null
          planned_cost_reduction_description?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_plans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_plans_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_plans_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string
          event_type: string
          id: string
          is_global: boolean | null
          is_recurring: boolean | null
          location_id: string | null
          priority: string | null
          recurring_pattern: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date: string
          event_type: string
          id?: string
          is_global?: boolean | null
          is_recurring?: boolean | null
          location_id?: string | null
          priority?: string | null
          recurring_pattern?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_global?: boolean | null
          is_recurring?: boolean | null
          location_id?: string | null
          priority?: string | null
          recurring_pattern?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          currency: string
          document_date: string
          document_name: string
          document_number: string
          exchange_rate: number
          id: string
          location_id: string
          updated_at: string
          user_id: string
          validation_errors: Json | null
        }
        Insert: {
          created_at?: string
          currency?: string
          document_date: string
          document_name: string
          document_number: string
          exchange_rate?: number
          id?: string
          location_id: string
          updated_at?: string
          user_id: string
          validation_errors?: Json | null
        }
        Update: {
          created_at?: string
          currency?: string
          document_date?: string
          document_name?: string
          document_number?: string
          exchange_rate?: number
          id?: string
          location_id?: string
          updated_at?: string
          user_id?: string
          validation_errors?: Json | null
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
      error_report_responses: {
        Row: {
          attachments: string[] | null
          created_at: string
          error_report_id: string
          id: string
          message: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string
          error_report_id: string
          id?: string
          message: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: string[] | null
          created_at?: string
          error_report_id?: string
          id?: string
          message?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "error_report_responses_error_report_id_fkey"
            columns: ["error_report_id"]
            isOneToOne: false
            referencedRelation: "error_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          additional_files: string[] | null
          admin_response: string | null
          assigned_to: string | null
          browser_info: Json | null
          created_at: string
          description: string
          id: string
          page_url: string
          priority: Database["public"]["Enums"]["error_report_priority"]
          screenshot_url: string | null
          status: Database["public"]["Enums"]["error_report_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_files?: string[] | null
          admin_response?: string | null
          assigned_to?: string | null
          browser_info?: Json | null
          created_at?: string
          description: string
          id?: string
          page_url: string
          priority?: Database["public"]["Enums"]["error_report_priority"]
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["error_report_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_files?: string[] | null
          admin_response?: string | null
          assigned_to?: string | null
          browser_info?: Json | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string
          priority?: Database["public"]["Enums"]["error_report_priority"]
          screenshot_url?: string | null
          status?: Database["public"]["Enums"]["error_report_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_rate_history: {
        Row: {
          created_at: string | null
          currency_code: string
          effective_date: string
          fetched_at: string | null
          id: string
          rate: number
          source: string | null
        }
        Insert: {
          created_at?: string | null
          currency_code: string
          effective_date: string
          fetched_at?: string | null
          id?: string
          rate: number
          source?: string | null
        }
        Update: {
          created_at?: string | null
          currency_code?: string
          effective_date?: string
          fetched_at?: string | null
          id?: string
          rate?: number
          source?: string | null
        }
        Relationships: []
      }
      failed_logins: {
        Row: {
          attempt_count: number
          created_at: string
          email: string
          id: string
          last_attempt: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          email: string
          id?: string
          last_attempt?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          email?: string
          id?: string
          last_attempt?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          title: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
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
          allow_foreign_currencies: boolean
          created_at: string
          house_abbreviation: string
          id: string
          location_id: string
          updated_at: string
        }
        Insert: {
          allow_foreign_currencies?: boolean
          created_at?: string
          house_abbreviation: string
          id?: string
          location_id: string
          updated_at?: string
        }
        Update: {
          allow_foreign_currencies?: boolean
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
          bank_account: string | null
          city: string | null
          created_at: string
          id: string
          location_identifier: string | null
          name: string
          nip: string | null
          postal_code: string | null
          regon: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          city?: string | null
          created_at?: string
          id?: string
          location_identifier?: string | null
          name: string
          nip?: string | null
          postal_code?: string | null
          regon?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          city?: string | null
          created_at?: string
          id?: string
          location_identifier?: string | null
          name?: string
          nip?: string | null
          postal_code?: string | null
          regon?: string | null
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
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked: boolean
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          location_id: string | null
          login: string | null
          name: string
          phone: string | null
          position: string | null
          role: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          location_id?: string | null
          login?: string | null
          name: string
          phone?: string | null
          position?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          location_id?: string | null
          login?: string | null
          name?: string
          phone?: string | null
          position?: string | null
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
      project_features: {
        Row: {
          category: Database["public"]["Enums"]["project_feature_category"]
          code_location: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          implementation_percentage: number | null
          notes: string | null
          parent_feature_id: string | null
          priority: Database["public"]["Enums"]["project_feature_priority"]
          status: Database["public"]["Enums"]["project_feature_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["project_feature_category"]
          code_location?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          implementation_percentage?: number | null
          notes?: string | null
          parent_feature_id?: string | null
          priority?: Database["public"]["Enums"]["project_feature_priority"]
          status?: Database["public"]["Enums"]["project_feature_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["project_feature_category"]
          code_location?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          implementation_percentage?: number | null
          notes?: string | null
          parent_feature_id?: string | null
          priority?: Database["public"]["Enums"]["project_feature_priority"]
          status?: Database["public"]["Enums"]["project_feature_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_features_parent_feature_id_fkey"
            columns: ["parent_feature_id"]
            isOneToOne: false
            referencedRelation: "project_features"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          created_at: string | null
          id: string
          location_id: string | null
          month: number
          recipient_email: string
          reminder_type: string
          sent_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          month: number
          recipient_email: string
          reminder_type: string
          sent_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string | null
          month?: number
          recipient_email?: string
          reminder_type?: string
          sent_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_location_id_fkey"
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
          display_order: number | null
          document_id: string | null
          document_number: string | null
          exchange_rate: number | null
          id: string
          is_parallel: boolean
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
          display_order?: number | null
          document_id?: string | null
          document_number?: string | null
          exchange_rate?: number | null
          id?: string
          is_parallel?: boolean
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
          display_order?: number | null
          document_id?: string | null
          document_number?: string | null
          exchange_rate?: number | null
          id?: string
          is_parallel?: boolean
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
      trusted_devices: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          device_name: string | null
          id: string
          ip_address: string | null
          last_used_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          created_at: string
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_events: {
        Row: {
          created_at: string
          email: string | null
          error_message: string | null
          id: string
          ip: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          id?: string
          ip?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_login_events_user_id_fkey"
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
      verification_codes: {
        Row: {
          code: string
          created_at: string | null
          device_fingerprint: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          device_fingerprint: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          device_fingerprint?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_parent_progress: {
        Args: { p_parent_id: string }
        Returns: number
      }
      can_access_report: { Args: { p_report_id: string }; Returns: boolean }
      change_user_password:
        | { Args: { new_password: string; user_id: number }; Returns: boolean }
        | {
            Args: { new_password: string; user_id: string }
            Returns: undefined
          }
      check_report_editing_blocked: {
        Args: { p_document_date: string; p_location_id: string }
        Returns: boolean
      }
      cleanup_expired_password_reset_tokens: { Args: never; Returns: undefined }
      cleanup_expired_verification_codes: { Args: never; Returns: undefined }
      create_user_admin: {
        Args: {
          user_email: string
          user_location_id?: string
          user_name: string
          user_password: string
          user_role: string
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
      exec_sql: { Args: { sql: string }; Returns: undefined }
      generate_document_number: {
        Args: { p_location_id: string; p_month: number; p_year: number }
        Returns: string
      }
      get_admin_emails: {
        Args: never
        Returns: {
          email: string
          id: string
          name: string
        }[]
      }
      get_current_user_id: { Args: never; Returns: string }
      get_current_user_id_fixed: { Args: never; Returns: string }
      get_user_filtered_accounts: {
        Args: {
          p_include_inactive?: boolean
          p_skip_restrictions?: boolean
          p_user_id: string
        }
        Returns: {
          analytical: boolean
          id: string
          name: string
          number: string
          type: string
        }[]
      }
      get_user_filtered_accounts_with_analytics: {
        Args: {
          p_include_inactive?: boolean
          p_skip_restrictions?: boolean
          p_user_id: string
        }
        Returns: {
          analytical: boolean
          has_analytics: boolean
          id: string
          is_active: boolean
          name: string
          number: string
          type: string
        }[]
      }
      get_user_location_id: { Args: never; Returns: string }
      get_user_location_ids: { Args: never; Returns: string[] }
      get_user_role: { Args: never; Returns: string }
      get_user_setting: {
        Args: { p_user_id: string }
        Returns: {
          windows98_style: boolean
        }[]
      }
      handle_signup_or_signin: {
        Args: { email: string; pass: string }
        Returns: Json
      }
      insert_profile_admin:
        | { Args: { profile_data: Json; user_id: number }; Returns: undefined }
        | {
            Args: {
              location_id?: string
              user_email: string
              user_id: string
              user_name: string
              user_role: string
            }
            Returns: undefined
          }
      upsert_user_setting: {
        Args: { p_user_id: string; p_windows98_style: boolean }
        Returns: undefined
      }
    }
    Enums: {
      error_report_priority: "low" | "medium" | "high" | "critical"
      error_report_status:
        | "new"
        | "in_progress"
        | "resolved"
        | "closed"
        | "needs_info"
      project_feature_category: "planned" | "done" | "remaining" | "beyond_plan"
      project_feature_priority: "low" | "medium" | "high" | "critical"
      project_feature_status: "not_started" | "in_progress" | "completed"
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
      error_report_priority: ["low", "medium", "high", "critical"],
      error_report_status: [
        "new",
        "in_progress",
        "resolved",
        "closed",
        "needs_info",
      ],
      project_feature_category: ["planned", "done", "remaining", "beyond_plan"],
      project_feature_priority: ["low", "medium", "high", "critical"],
      project_feature_status: ["not_started", "in_progress", "completed"],
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
