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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_audit_log: {
        Row: {
          args: Json | null
          created_at: string
          duration_ms: number | null
          id: string
          result: Json | null
          tool_name: string
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          args?: Json | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          result?: Json | null
          tool_name: string
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          args?: Json | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          result?: Json | null
          tool_name?: string
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          source: string
          terminal_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          source?: string
          terminal_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          source?: string
          terminal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_entries: {
        Row: {
          amount: number
          caja_session_id: string
          concept: string
          created_at: string
          id: string
          staff_id: string
          type: string
        }
        Insert: {
          amount: number
          caja_session_id: string
          concept: string
          created_at?: string
          id?: string
          staff_id: string
          type: string
        }
        Update: {
          amount?: number
          caja_session_id?: string
          concept?: string
          created_at?: string
          id?: string
          staff_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "caja_entries_caja_session_id_fkey"
            columns: ["caja_session_id"]
            isOneToOne: false
            referencedRelation: "caja_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      caja_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_cash: number | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_cash: number
          status: string
          version: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_cash?: number
          status?: string
          version?: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_cash?: number
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "caja_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          deleted_at: string | null
          happy_hour_end: string | null
          happy_hour_start: string | null
          id: string
          name: string
          parent_id: string | null
          routing: Database["public"]["Enums"]["category_routing"]
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          happy_hour_end?: string | null
          happy_hour_start?: string | null
          id?: string
          name: string
          parent_id?: string | null
          routing?: Database["public"]["Enums"]["category_routing"]
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          deleted_at?: string | null
          happy_hour_end?: string | null
          happy_hour_start?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          routing?: Database["public"]["Enums"]["category_routing"]
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_availability: {
        Row: {
          combo_product_id: string
          created_at: string
          days_of_week: number[]
          end_date: string | null
          end_time: string | null
          id: string
          start_date: string | null
          start_time: string | null
        }
        Insert: {
          combo_product_id: string
          created_at?: string
          days_of_week?: number[]
          end_date?: string | null
          end_time?: string | null
          id?: string
          start_date?: string | null
          start_time?: string | null
        }
        Update: {
          combo_product_id?: string
          created_at?: string
          days_of_week?: number[]
          end_date?: string | null
          end_time?: string | null
          id?: string
          start_date?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combo_availability_combo_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "combo_availability_combo_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_slot_options: {
        Row: {
          child_product_id: string | null
          combo_slot_id: string
          created_at: string
          id: string
          prepaid_minutes: number | null
          sort_order: number
        }
        Insert: {
          child_product_id?: string | null
          combo_slot_id: string
          created_at?: string
          id?: string
          prepaid_minutes?: number | null
          sort_order?: number
        }
        Update: {
          child_product_id?: string | null
          combo_slot_id?: string
          created_at?: string
          id?: string
          prepaid_minutes?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_slot_options_child_product_id_fkey"
            columns: ["child_product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "combo_slot_options_child_product_id_fkey"
            columns: ["child_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_slot_options_combo_slot_id_fkey"
            columns: ["combo_slot_id"]
            isOneToOne: false
            referencedRelation: "combo_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_slots: {
        Row: {
          combo_product_id: string
          created_at: string
          id: string
          is_required: boolean
          label: string
          max_qty: number
          min_qty: number
          slot_type: string
          sort_order: number
        }
        Insert: {
          combo_product_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          label: string
          max_qty?: number
          min_qty?: number
          slot_type: string
          sort_order?: number
        }
        Update: {
          combo_product_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          label?: string
          max_qty?: number
          min_qty?: number
          slot_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_slots_combo_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "combo_slots_combo_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          category: string | null
          cost_per_base_unit: number
          created_at: string | null
          id: string
          is_active: boolean
          is_prep: boolean
          name: string
          purchase_to_base_factor: number
          purchase_uom: string | null
          quantity_on_hand: number
          reorder_point: number | null
          uom: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          cost_per_base_unit?: number
          created_at?: string | null
          id?: string
          is_active?: boolean
          is_prep?: boolean
          name: string
          purchase_to_base_factor?: number
          purchase_uom?: string | null
          quantity_on_hand?: number
          reorder_point?: number | null
          uom: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          cost_per_base_unit?: number
          created_at?: string | null
          id?: string
          is_active?: boolean
          is_prep?: boolean
          name?: string
          purchase_to_base_factor?: number
          purchase_uom?: string | null
          quantity_on_hand?: number
          reorder_point?: number | null
          uom?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          created_at: string
          id: string
          low_stock_threshold: number
          product_id: string
          quantity_on_hand: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          low_stock_threshold?: number
          product_id: string
          quantity_on_hand?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          low_stock_threshold?: number
          product_id?: string
          quantity_on_hand?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_group_items: {
        Row: {
          group_id: string
          modifier_id: string
          sort_order: number
        }
        Insert: {
          group_id: string
          modifier_id: string
          sort_order?: number
        }
        Update: {
          group_id?: string
          modifier_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifier_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_group_items_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          max_select: number
          min_select: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      modifier_inventory_rules: {
        Row: {
          created_at: string
          delta: number
          id: string
          ingredient_id: string
          modifier_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          ingredient_id: string
          modifier_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          ingredient_id?: string
          modifier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_inventory_rules_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifier_inventory_rules_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          created_at: string
          id: string
          name: string
          price_delta: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price_delta?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          combo_slot_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          kds_status: Database["public"]["Enums"]["kds_status"]
          modifier_ids: string[]
          modifier_price_delta: number
          notes: string | null
          order_id: string
          parent_order_item_id: string | null
          product_id: string
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          combo_slot_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          kds_status?: Database["public"]["Enums"]["kds_status"]
          modifier_ids?: string[]
          modifier_price_delta?: number
          notes?: string | null
          order_id: string
          parent_order_item_id?: string | null
          product_id: string
          quantity?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          combo_slot_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          kds_status?: Database["public"]["Enums"]["kds_status"]
          modifier_ids?: string[]
          modifier_price_delta?: number
          notes?: string | null
          order_id?: string
          parent_order_item_id?: string | null
          product_id?: string
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_combo_slot_id_fkey"
            columns: ["combo_slot_id"]
            isOneToOne: false
            referencedRelation: "combo_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_parent_order_item_id_fkey"
            columns: ["parent_order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_parent_order_item_id_fkey"
            columns: ["parent_order_item_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["parent_order_item_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          notes: string | null
          staff_id: string
          status: Database["public"]["Enums"]["order_status"]
          tab_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["order_status"]
          tab_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          tab_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["tab_id"]
          },
          {
            foreignKeyName: "orders_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          discount_amount: number | null
          discount_scope: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          idempotency_key: string
          is_deleted: boolean
          is_refund: boolean
          method: Database["public"]["Enums"]["payment_method"]
          processed_at: string
          processed_by: string
          reference_number: string | null
          refund_id: string | null
          square_payment_id: string | null
          square_receipt_url: string | null
          tab_id: string
          tendered_amount: number | null
          tip_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          discount_amount?: number | null
          discount_scope?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          idempotency_key: string
          is_deleted?: boolean
          is_refund?: boolean
          method: Database["public"]["Enums"]["payment_method"]
          processed_at?: string
          processed_by: string
          reference_number?: string | null
          refund_id?: string | null
          square_payment_id?: string | null
          square_receipt_url?: string | null
          tab_id: string
          tendered_amount?: number | null
          tip_amount?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          discount_amount?: number | null
          discount_scope?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          idempotency_key?: string
          is_deleted?: boolean
          is_refund?: boolean
          method?: Database["public"]["Enums"]["payment_method"]
          processed_at?: string
          processed_by?: string
          reference_number?: string | null
          refund_id?: string | null
          square_payment_id?: string | null
          square_receipt_url?: string | null
          tab_id?: string
          tendered_amount?: number | null
          tip_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["tab_id"]
          },
          {
            foreignKeyName: "payments_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_sessions: {
        Row: {
          billed_minutes: number | null
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          prepaid_minutes: number
          previous_table_id: string | null
          source_order_item_id: string | null
          started_at: string
          stopped_at: string | null
          tab_id: string | null
          table_id: string
          total_charge: number | null
          updated_at: string
          version: number
        }
        Insert: {
          billed_minutes?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          prepaid_minutes?: number
          previous_table_id?: string | null
          source_order_item_id?: string | null
          started_at?: string
          stopped_at?: string | null
          tab_id?: string | null
          table_id: string
          total_charge?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          billed_minutes?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          prepaid_minutes?: number
          previous_table_id?: string | null
          source_order_item_id?: string | null
          started_at?: string
          stopped_at?: string | null
          tab_id?: string | null
          table_id?: string
          total_charge?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pool_sessions_previous_table_id_fkey"
            columns: ["previous_table_id"]
            isOneToOne: false
            referencedRelation: "pool_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_sessions_source_order_item_id_fkey"
            columns: ["source_order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_sessions_source_order_item_id_fkey"
            columns: ["source_order_item_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["parent_order_item_id"]
          },
          {
            foreignKeyName: "pool_sessions_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["tab_id"]
          },
          {
            foreignKeyName: "pool_sessions_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "pool_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_table_transfers: {
        Row: {
          from_pool_table_id: string
          id: string
          pool_session_id: string
          reason: string | null
          to_pool_table_id: string
          transferred_at: string
          transferred_by: string
        }
        Insert: {
          from_pool_table_id: string
          id?: string
          pool_session_id: string
          reason?: string | null
          to_pool_table_id: string
          transferred_at?: string
          transferred_by: string
        }
        Update: {
          from_pool_table_id?: string
          id?: string
          pool_session_id?: string
          reason?: string | null
          to_pool_table_id?: string
          transferred_at?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_table_transfers_from_pool_table_id_fkey"
            columns: ["from_pool_table_id"]
            isOneToOne: false
            referencedRelation: "pool_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_table_transfers_pool_session_id_fkey"
            columns: ["pool_session_id"]
            isOneToOne: false
            referencedRelation: "pool_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_table_transfers_to_pool_table_id_fkey"
            columns: ["to_pool_table_id"]
            isOneToOne: false
            referencedRelation: "pool_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_table_transfers_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_tables: {
        Row: {
          created_at: string
          current_session_id: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean
          label: string
          number: number
          rate_per_hour: number
          status: Database["public"]["Enums"]["pool_table_status"]
          table_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_session_id?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          label: string
          number: number
          rate_per_hour: number
          status?: Database["public"]["Enums"]["pool_table_status"]
          table_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_session_id?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          label?: string
          number?: number
          rate_per_hour?: number
          status?: Database["public"]["Enums"]["pool_table_status"]
          table_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pool_tables_current_session"
            columns: ["current_session_id"]
            isOneToOne: false
            referencedRelation: "pool_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_codebase_index: {
        Row: {
          chunk_text: string
          embedding: string | null
          file_path: string
          id: string
          indexed_at: string
          metadata: Json | null
        }
        Insert: {
          chunk_text: string
          embedding?: string | null
          file_path: string
          id?: string
          indexed_at?: string
          metadata?: Json | null
        }
        Update: {
          chunk_text?: string
          embedding?: string | null
          file_path?: string
          id?: string
          indexed_at?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      pos_error_log: {
        Row: {
          component: string | null
          created_at: string
          detail: string | null
          error_code: string
          id: string
          message: string
          raw: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string
          detail?: string | null
          error_code: string
          id?: string
          message: string
          raw?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string
          detail?: string | null
          error_code?: string
          id?: string
          message?: string
          raw?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_error_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_productions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          prep_ingredient_id: string
          produced_by: string | null
          qty_produced: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          prep_ingredient_id: string
          produced_by?: string | null
          qty_produced: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          prep_ingredient_id?: string
          produced_by?: string | null
          qty_produced?: number
        }
        Relationships: [
          {
            foreignKeyName: "prep_productions_prep_ingredient_id_fkey"
            columns: ["prep_ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_productions_produced_by_fkey"
            columns: ["produced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifier_groups: {
        Row: {
          group_id: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          group_id: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          group_id?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_modifier_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_modifier_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_modifier_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_modifiers: {
        Row: {
          created_at: string
          modifier_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          modifier_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          modifier_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_modifiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_modifiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          base_price: number
          category_id: string
          combo_eligible: boolean
          combo_price_override: number | null
          created_at: string
          deleted_at: string | null
          happy_hour_price: number | null
          id: string
          image_url: string | null
          is_active: boolean
          is_combo: boolean
          name: string
          sku: string | null
          stock_threshold: number | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          base_price: number
          category_id: string
          combo_eligible?: boolean
          combo_price_override?: number | null
          created_at?: string
          deleted_at?: string | null
          happy_hour_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_combo?: boolean
          name: string
          sku?: string | null
          stock_threshold?: number | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          base_price?: number
          category_id?: string
          combo_eligible?: boolean
          combo_price_override?: number | null
          created_at?: string
          deleted_at?: string | null
          happy_hour_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_combo?: boolean
          name?: string
          sku?: string | null
          stock_threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          must_change_pin: boolean
          name: string
          pin: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id: string
          is_active?: boolean
          must_change_pin?: boolean
          name: string
          pin: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          must_change_pin?: boolean
          name?: string
          pin?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rappi_orders: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          customer_name: string
          delivery_address: string
          id: string
          items: Json
          rappi_order_id: string
          rappi_total: number
          received_at: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["rappi_order_status"]
          subtotal: number
          tab_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          customer_name?: string
          delivery_address?: string
          id?: string
          items?: Json
          rappi_order_id: string
          rappi_total: number
          received_at?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["rappi_order_status"]
          subtotal: number
          tab_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          customer_name?: string
          delivery_address?: string
          id?: string
          items?: Json
          rappi_order_id?: string
          rappi_total?: number
          received_at?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["rappi_order_status"]
          subtotal?: number
          tab_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rappi_orders_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["tab_id"]
          },
          {
            foreignKeyName: "rappi_orders_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          id: string
          ingredient_id: string
          qty: number
          recipe_id: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          qty: number
          recipe_id: string
        }
        Update: {
          id?: string
          ingredient_id?: string
          qty?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          prep_ingredient_id: string | null
          product_id: string | null
          updated_at: string
          yield_qty: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          prep_ingredient_id?: string | null
          product_id?: string | null
          updated_at?: string
          yield_qty?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          prep_ingredient_id?: string | null
          product_id?: string | null
          updated_at?: string
          yield_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_prep_ingredient_id_fkey"
            columns: ["prep_ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_item_id: string
          qty: number
          refund_id: string
          restock: boolean
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_item_id: string
          qty: number
          refund_id: string
          restock?: boolean
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_item_id?: string
          qty?: number
          refund_id?: string
          restock?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "refund_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["parent_order_item_id"]
          },
          {
            foreignKeyName: "refund_items_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          original_payment_id: string
          reason: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          original_payment_id: string
          reason: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          original_payment_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_backups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          restored_at: string | null
          restored_by: string | null
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          restored_at?: string | null
          restored_by?: string | null
          snapshot: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          restored_at?: string | null
          restored_by?: string | null
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_backups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_backups_restored_by_fkey"
            columns: ["restored_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          clock_in: string
          clock_out: string | null
          closing_cash: number | null
          created_at: string
          id: string
          opening_cash: number
          staff_id: string
          updated_at: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          closing_cash?: number | null
          created_at?: string
          id?: string
          opening_cash?: number
          staff_id: string
          updated_at?: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          closing_cash?: number | null
          created_at?: string
          id?: string
          opening_cash?: number
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string | null
          notes: string | null
          product_id: string | null
          quantity_delta: number
          reason: string
          ref_id: string | null
          ref_type: string | null
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          notes?: string | null
          product_id?: string | null
          quantity_delta: number
          reason: string
          ref_id?: string | null
          ref_type?: string | null
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          notes?: string | null
          product_id?: string | null
          quantity_delta?: number
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_log_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tab_transfers: {
        Row: {
          from_staff_id: string | null
          from_table: number | null
          id: string
          reason: string | null
          tab_id: string
          to_staff_id: string | null
          to_table: number | null
          transfer_type: string
          transferred_at: string
          transferred_by: string
        }
        Insert: {
          from_staff_id?: string | null
          from_table?: number | null
          id?: string
          reason?: string | null
          tab_id: string
          to_staff_id?: string | null
          to_table?: number | null
          transfer_type?: string
          transferred_at?: string
          transferred_by: string
        }
        Update: {
          from_staff_id?: string | null
          from_table?: number | null
          id?: string
          reason?: string | null
          tab_id?: string
          to_staff_id?: string | null
          to_table?: number | null
          transfer_type?: string
          transferred_at?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "tab_transfers_from_staff_id_fkey"
            columns: ["from_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_transfers_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["tab_id"]
          },
          {
            foreignKeyName: "tab_transfers_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_transfers_to_staff_id_fkey"
            columns: ["to_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tab_transfers_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tabs: {
        Row: {
          caja_session_id: string | null
          closed_at: string | null
          created_at: string
          customer_name: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean
          notes: string | null
          opened_at: string
          parent_tab_id: string | null
          rappi_order_id: string | null
          shift_id: string
          split_label: string | null
          split_mode: string | null
          staff_id: string
          status: Database["public"]["Enums"]["tab_status"]
          table_number: number | null
          updated_at: string
          version: number
        }
        Insert: {
          caja_session_id?: string | null
          closed_at?: string | null
          created_at?: string
          customer_name?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          opened_at?: string
          parent_tab_id?: string | null
          rappi_order_id?: string | null
          shift_id: string
          split_label?: string | null
          split_mode?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["tab_status"]
          table_number?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          caja_session_id?: string | null
          closed_at?: string | null
          created_at?: string
          customer_name?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          opened_at?: string
          parent_tab_id?: string | null
          rappi_order_id?: string | null
          shift_id?: string
          split_label?: string | null
          split_mode?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["tab_status"]
          table_number?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tabs_caja_session_id_fkey"
            columns: ["caja_session_id"]
            isOneToOne: false
            referencedRelation: "caja_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_parent_tab_id_fkey"
            columns: ["parent_tab_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["tab_id"]
          },
          {
            foreignKeyName: "tabs_parent_tab_id_fkey"
            columns: ["parent_tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          created_at: string
          id: string
          name: string
          notified_at: string | null
          party_size: number
          phone_e164: string | null
          seated_at: string | null
          status: string
          table_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notified_at?: string | null
          party_size: number
          phone_e164?: string | null
          seated_at?: string | null
          status?: string
          table_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notified_at?: string | null
          party_size?: number
          phone_e164?: string | null
          seated_at?: string | null
          status?: string
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "pool_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_notifications: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          provider_message_id: string | null
          status: string
          waitlist_entry_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          status: string
          waitlist_entry_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          status?: string
          waitlist_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_notifications_waitlist_entry_id_fkey"
            columns: ["waitlist_entry_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      combo_mix_daily: {
        Row: {
          avg_price: number | null
          combo_name: string | null
          combo_product_id: string | null
          date: string | null
          net_revenue: number | null
          override_count: number | null
          qty_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "product_combo_usage"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["combo_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_combo_usage: {
        Row: {
          child_item_count: number | null
          ordered_at: string | null
          parent_order_item_id: string | null
          product_id: string | null
          product_name: string | null
          tab_id: string | null
          tab_name: string | null
        }
        Relationships: []
      }
      recipe_variance_daily: {
        Row: {
          date: string | null
          ingredient_id: string | null
          ingredient_name: string | null
          physical_delta: number | null
          theoretical_used: number | null
          variance_pct: number | null
        }
        Relationships: []
      }
      waitlist_metrics_daily: {
        Row: {
          avg_actual_wait: number | null
          avg_quoted_wait: number | null
          date: string | null
          no_show_rate: number | null
          parties_seated: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_combo_to_tab: {
        Args: {
          p_combo_product_id: string
          p_override_availability?: boolean
          p_override_reason?: string
          p_slot_selections: Json
          p_tab_id: string
        }
        Returns: string
      }
      caja_open: {
        Args: {
          p_opened_by: string
          p_opening_cash: number
          p_terminal_id?: string
        }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          closing_cash: number | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_cash: number
          status: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "caja_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clear_must_change_pin: { Args: { p_terminal_id?: string }; Returns: Json }
      close_caja_session: {
        Args: {
          p_caja_id: string
          p_closed_by: string
          p_closing_cash: number
          p_notes?: string
        }
        Returns: Json
      }
      close_tab: {
        Args: {
          p_expected_version?: number
          p_status: Database["public"]["Enums"]["tab_status"]
          p_tab_id: string
          p_terminal_id?: string
        }
        Returns: Json
      }
      create_order_with_items: {
        Args: {
          p_expected_version?: number
          p_items: Json
          p_notes: string
          p_skip_depletion?: boolean
          p_staff_id: string
          p_status: Database["public"]["Enums"]["order_status"]
          p_tab_id: string
        }
        Returns: Json
      }
      deplete_for_order_item: {
        Args: {
          p_allow_negative?: boolean
          p_direction: number
          p_order_item_id: string
        }
        Returns: undefined
      }
      force_pin_change: {
        Args: { p_staff_id: string; p_terminal_id?: string }
        Returns: Json
      }
      get_caja_report: { Args: { p_caja_id: string }; Returns: Json }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_combo_available: {
        Args: { p_combo_id: string; p_ts: string }
        Returns: boolean
      }
      list_caja_sessions: { Args: { p_limit?: number }; Returns: Json }
      match_codebase_chunks: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          chunk_text: string
          file_path: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      process_payment_atomic: {
        Args: {
          p_amount: number
          p_discount_amount?: number
          p_discount_scope?: string
          p_discount_type?: string
          p_discount_value?: number
          p_expected_version?: number
          p_idempotency_key: string
          p_method: string
          p_rappi_order_id?: string
          p_reference_number?: string
          p_staff_id: string
          p_tab_id: string
          p_tendered_amount?: number
          p_tip_amount: number
        }
        Returns: Json
      }
      process_refund: {
        Args: {
          p_items: Json
          p_manager_pin: string
          p_original_payment_id: string
          p_reason: string
        }
        Returns: string
      }
      produce_prep_batch: {
        Args: {
          p_notes?: string
          p_prep_ingredient_id: string
          p_produced_by?: string
          p_qty_produced: number
          p_terminal_id?: string
        }
        Returns: {
          created_at: string
          id: string
          notes: string | null
          prep_ingredient_id: string
          produced_by: string | null
          qty_produced: number
        }
        SetofOptions: {
          from: "*"
          to: "prep_productions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity_id?: string
          p_entity_type: string
          p_source?: string
          p_terminal_id?: string
          p_user_id?: string
        }
        Returns: string
      }
      record_stock_movement: {
        Args: {
          p_delta: number
          p_ingredient_id: string
          p_notes?: string
          p_reason: string
          p_ref_id: string
          p_ref_type: string
          p_terminal_id?: string
        }
        Returns: {
          created_at: string
          id: string
          ingredient_id: string | null
          notes: string | null
          product_id: string | null
          quantity_delta: number
          reason: string
          ref_id: string | null
          ref_type: string | null
          staff_id: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      split_tab_by_amount: {
        Args: { p_amounts: Json; p_parent_tab_id: string }
        Returns: string[]
      }
      split_tab_by_item: {
        Args: { p_assignments: Json; p_parent_tab_id: string }
        Returns: string[]
      }
      split_tab_by_person: {
        Args: { p_assignments: Json; p_n: number; p_parent_tab_id: string }
        Returns: string[]
      }
      split_tab_evenly: {
        Args: { p_n: number; p_parent_tab_id: string }
        Returns: Json
      }
      transfer_pool_session: {
        Args: {
          p_reason?: string
          p_session_id: string
          p_to_pool_table_id: string
          p_transferred_by: string
        }
        Returns: Json
      }
      transfer_tab: {
        Args: {
          p_reason?: string
          p_tab_id: string
          p_terminal_id?: string
          p_to_staff_id?: string
          p_to_table?: number
          p_transfer_type?: string
          p_transferred_by: string
        }
        Returns: Json
      }
    }
    Enums: {
      category_routing: "KITCHEN" | "BAR" | "NONE"
      kds_status: "pending" | "in_progress" | "done"
      order_status: "pending" | "served" | "voided"
      payment_method: "cash" | "card" | "tab_transfer" | "rappi"
      pool_table_status: "available" | "occupied" | "reserved" | "maintenance"
      rappi_order_status:
        | "pending_acceptance"
        | "accepted"
        | "preparing"
        | "ready_for_pickup"
        | "completed"
        | "rejected"
      tab_status: "open" | "closed" | "paid" | "voided" | "split"
      user_role: "bartender" | "manager" | "admin" | "kitchen"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      category_routing: ["KITCHEN", "BAR", "NONE"],
      kds_status: ["pending", "in_progress", "done"],
      order_status: ["pending", "served", "voided"],
      payment_method: ["cash", "card", "tab_transfer", "rappi"],
      pool_table_status: ["available", "occupied", "reserved", "maintenance"],
      rappi_order_status: [
        "pending_acceptance",
        "accepted",
        "preparing",
        "ready_for_pickup",
        "completed",
        "rejected",
      ],
      tab_status: ["open", "closed", "paid", "voided", "split"],
      user_role: ["bartender", "manager", "admin", "kitchen"],
    },
  },
} as const
