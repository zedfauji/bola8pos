export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      caja_entries: {
        Row: {
          amount: number;
          caja_session_id: string;
          concept: string;
          created_at: string;
          id: string;
          staff_id: string;
          type: string;
        };
        Insert: {
          amount: number;
          caja_session_id: string;
          concept: string;
          created_at?: string;
          id?: string;
          staff_id: string;
          type: string;
        };
        Update: {
          amount?: number;
          caja_session_id?: string;
          concept?: string;
          created_at?: string;
          id?: string;
          staff_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'caja_entries_caja_session_id_fkey';
            columns: ['caja_session_id'];
            isOneToOne: false;
            referencedRelation: 'caja_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'caja_entries_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      caja_sessions: {
        Row: {
          closed_at: string | null;
          closed_by: string | null;
          closing_cash: number | null;
          created_at: string;
          id: string;
          notes: string | null;
          opened_at: string;
          opened_by: string;
          opening_cash: number;
          status: string;
        };
        Insert: {
          closed_at?: string | null;
          closed_by?: string | null;
          closing_cash?: number | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          opened_at?: string;
          opened_by: string;
          opening_cash?: number;
          status?: string;
        };
        Update: {
          closed_at?: string | null;
          closed_by?: string | null;
          closing_cash?: number | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          opened_at?: string;
          opened_by?: string;
          opening_cash?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'caja_sessions_closed_by_fkey';
            columns: ['closed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'caja_sessions_opened_by_fkey';
            columns: ['opened_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          color: string;
          created_at: string;
          deleted_at: string | null;
          happy_hour_end: string | null;
          happy_hour_start: string | null;
          id: string;
          is_food: boolean;
          name: string;
          parent_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          happy_hour_end?: string | null;
          happy_hour_start?: string | null;
          id?: string;
          is_food?: boolean;
          name: string;
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          happy_hour_end?: string | null;
          happy_hour_start?: string | null;
          id?: string;
          is_food?: boolean;
          name?: string;
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory: {
        Row: {
          created_at: string;
          id: string;
          low_stock_threshold: number;
          product_id: string;
          quantity_on_hand: number;
          unit: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          product_id: string;
          quantity_on_hand?: number;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          low_stock_threshold?: number;
          product_id?: string;
          quantity_on_hand?: number;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: true;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_movements: {
        Row: {
          created_at: string;
          id: string;
          ingredient_id: string | null;
          product_id: string;
          quantity_delta: number;
          reason: string;
          ref_id: string | null;
          ref_type: string | null;
          staff_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ingredient_id?: string | null;
          product_id: string;
          quantity_delta: number;
          reason: string;
          ref_id?: string | null;
          ref_type?: string | null;
          staff_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          ingredient_id?: string | null;
          product_id?: string;
          quantity_delta?: number;
          reason?: string;
          ref_id?: string | null;
          ref_type?: string | null;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      modifier_groups: {
        Row: {
          created_at: string;
          id: string;
          is_required: boolean;
          max_select: number;
          min_select: number;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_required?: boolean;
          max_select?: number;
          min_select?: number;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_required?: boolean;
          max_select?: number;
          min_select?: number;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      modifier_group_items: {
        Row: {
          group_id: string;
          modifier_id: string;
          sort_order: number;
        };
        Insert: {
          group_id: string;
          modifier_id: string;
          sort_order?: number;
        };
        Update: {
          group_id?: string;
          modifier_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'modifier_group_items_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'modifier_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'modifier_group_items_modifier_id_fkey';
            columns: ['modifier_id'];
            isOneToOne: false;
            referencedRelation: 'modifiers';
            referencedColumns: ['id'];
          },
        ];
      };
      product_modifier_groups: {
        Row: {
          group_id: string;
          product_id: string;
          sort_order: number | null;
        };
        Insert: {
          group_id: string;
          product_id: string;
          sort_order?: number | null;
        };
        Update: {
          group_id?: string;
          product_id?: string;
          sort_order?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'product_modifier_groups_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'modifier_groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_modifier_groups_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      modifiers: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          price_delta: number;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          price_delta?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          price_delta?: number;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_deleted: boolean;
          modifier_ids: string[];
          modifier_price_delta: number;
          notes: string | null;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          modifier_ids?: string[];
          modifier_price_delta?: number;
          notes?: string | null;
          order_id: string;
          product_id: string;
          quantity?: number;
          unit_price: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          modifier_ids?: string[];
          modifier_price_delta?: number;
          notes?: string | null;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_deleted: boolean;
          notes: string | null;
          staff_id: string;
          status: Database['public']['Enums']['order_status'];
          tab_id: string;
          updated_at: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          notes?: string | null;
          staff_id: string;
          status?: Database['public']['Enums']['order_status'];
          tab_id: string;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          notes?: string | null;
          staff_id?: string;
          status?: Database['public']['Enums']['order_status'];
          tab_id?: string;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_tab_id_fkey';
            columns: ['tab_id'];
            isOneToOne: false;
            referencedRelation: 'tabs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_voided_by_fkey';
            columns: ['voided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          deleted_at: string | null;
          discount_amount: number | null;
          discount_scope: string | null;
          discount_type: string | null;
          discount_value: number | null;
          id: string;
          idempotency_key: string;
          is_deleted: boolean;
          is_refund: boolean;
          method: Database['public']['Enums']['payment_method'];
          processed_at: string;
          processed_by: string;
          reference_number: string | null;
          refund_id: string | null;
          square_payment_id: string | null;
          square_receipt_url: string | null;
          tab_id: string;
          tendered_amount: number | null;
          tip_amount: number;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          deleted_at?: string | null;
          discount_amount?: number | null;
          discount_scope?: string | null;
          discount_type?: string | null;
          discount_value?: number | null;
          id?: string;
          idempotency_key: string;
          is_deleted?: boolean;
          is_refund?: boolean;
          method: Database['public']['Enums']['payment_method'];
          processed_at?: string;
          processed_by: string;
          reference_number?: string | null;
          refund_id?: string | null;
          square_payment_id?: string | null;
          square_receipt_url?: string | null;
          tab_id: string;
          tendered_amount?: number | null;
          tip_amount?: number;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          deleted_at?: string | null;
          discount_amount?: number | null;
          discount_scope?: string | null;
          discount_type?: string | null;
          discount_value?: number | null;
          id?: string;
          idempotency_key?: string;
          is_deleted?: boolean;
          is_refund?: boolean;
          method?: Database['public']['Enums']['payment_method'];
          processed_at?: string;
          processed_by?: string;
          reference_number?: string | null;
          refund_id?: string | null;
          square_payment_id?: string | null;
          square_receipt_url?: string | null;
          tab_id?: string;
          tendered_amount?: number | null;
          tip_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_processed_by_fkey';
            columns: ['processed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_refund_id_fkey';
            columns: ['refund_id'];
            isOneToOne: false;
            referencedRelation: 'refunds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_tab_id_fkey';
            columns: ['tab_id'];
            isOneToOne: true;
            referencedRelation: 'tabs';
            referencedColumns: ['id'];
          },
        ];
      };
      refund_items: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          order_item_id: string;
          qty: number;
          refund_id: string;
          restock: boolean;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          order_item_id: string;
          qty: number;
          refund_id: string;
          restock?: boolean;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_item_id?: string;
          qty?: number;
          refund_id?: string;
          restock?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'refund_items_order_item_id_fkey';
            columns: ['order_item_id'];
            isOneToOne: false;
            referencedRelation: 'order_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refund_items_refund_id_fkey';
            columns: ['refund_id'];
            isOneToOne: false;
            referencedRelation: 'refunds';
            referencedColumns: ['id'];
          },
        ];
      };
      refunds: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string;
          id: string;
          original_payment_id: string;
          reason: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by: string;
          id?: string;
          original_payment_id: string;
          reason: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string;
          id?: string;
          original_payment_id?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'refunds_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_original_payment_id_fkey';
            columns: ['original_payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      pool_sessions: {
        Row: {
          billed_minutes: number | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_deleted: boolean;
          previous_table_id: string | null;
          started_at: string;
          stopped_at: string | null;
          tab_id: string | null;
          table_id: string;
          total_charge: number | null;
          updated_at: string;
        };
        Insert: {
          billed_minutes?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          previous_table_id?: string | null;
          started_at?: string;
          stopped_at?: string | null;
          tab_id?: string | null;
          table_id: string;
          total_charge?: number | null;
          updated_at?: string;
        };
        Update: {
          billed_minutes?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          previous_table_id?: string | null;
          started_at?: string;
          stopped_at?: string | null;
          tab_id?: string | null;
          table_id?: string;
          total_charge?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pool_sessions_previous_table_id_fkey';
            columns: ['previous_table_id'];
            isOneToOne: false;
            referencedRelation: 'pool_tables';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pool_sessions_tab_id_fkey';
            columns: ['tab_id'];
            isOneToOne: false;
            referencedRelation: 'tabs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pool_sessions_table_id_fkey';
            columns: ['table_id'];
            isOneToOne: false;
            referencedRelation: 'pool_tables';
            referencedColumns: ['id'];
          },
        ];
      };
      pool_table_transfers: {
        Row: {
          from_pool_table_id: string;
          id: string;
          pool_session_id: string;
          reason: string | null;
          to_pool_table_id: string;
          transferred_at: string;
          transferred_by: string;
        };
        Insert: {
          from_pool_table_id: string;
          id?: string;
          pool_session_id: string;
          reason?: string | null;
          to_pool_table_id: string;
          transferred_at?: string;
          transferred_by: string;
        };
        Update: {
          from_pool_table_id?: string;
          id?: string;
          pool_session_id?: string;
          reason?: string | null;
          to_pool_table_id?: string;
          transferred_at?: string;
          transferred_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pool_table_transfers_from_pool_table_id_fkey';
            columns: ['from_pool_table_id'];
            isOneToOne: false;
            referencedRelation: 'pool_tables';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pool_table_transfers_pool_session_id_fkey';
            columns: ['pool_session_id'];
            isOneToOne: false;
            referencedRelation: 'pool_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pool_table_transfers_to_pool_table_id_fkey';
            columns: ['to_pool_table_id'];
            isOneToOne: false;
            referencedRelation: 'pool_tables';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pool_table_transfers_transferred_by_fkey';
            columns: ['transferred_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      pool_tables: {
        Row: {
          created_at: string;
          current_session_id: string | null;
          deleted_at: string | null;
          id: string;
          is_deleted: boolean;
          label: string;
          number: number;
          rate_per_hour: number;
          status: Database['public']['Enums']['pool_table_status'];
          table_type: 'pool' | 'carom' | 'consumption';
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_session_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          label: string;
          number: number;
          rate_per_hour: number;
          status?: Database['public']['Enums']['pool_table_status'];
          table_type?: 'pool' | 'carom' | 'consumption';
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_session_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          label?: string;
          number?: number;
          rate_per_hour?: number;
          status?: Database['public']['Enums']['pool_table_status'];
          table_type?: 'pool' | 'carom' | 'consumption';
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_pool_tables_current_session';
            columns: ['current_session_id'];
            isOneToOne: false;
            referencedRelation: 'pool_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      // TODO: regenerate types after Phase 5 migrations applied (Docker unavailable — manual transcription)
      prep_productions: {
        Row: {
          id: string;
          prep_ingredient_id: string;
          qty_produced: number;
          notes: string | null;
          produced_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prep_ingredient_id: string;
          qty_produced: number;
          notes?: string | null;
          produced_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          prep_ingredient_id?: string;
          qty_produced?: number;
          notes?: string | null;
          produced_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'prep_productions_prep_ingredient_id_fkey';
            columns: ['prep_ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'prep_productions_produced_by_fkey';
            columns: ['produced_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      product_modifiers: {
        Row: {
          created_at: string;
          modifier_id: string;
          product_id: string;
        };
        Insert: {
          created_at?: string;
          modifier_id: string;
          product_id: string;
        };
        Update: {
          created_at?: string;
          modifier_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_modifiers_modifier_id_fkey';
            columns: ['modifier_id'];
            isOneToOne: false;
            referencedRelation: 'modifiers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_modifiers_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          barcode: string | null;
          base_price: number;
          category_id: string;
          combo_eligible: boolean;
          created_at: string;
          deleted_at: string | null;
          happy_hour_price: number | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          is_combo: boolean;
          name: string;
          sku: string | null;
          stock_threshold: number | null;
          updated_at: string;
        };
        Insert: {
          barcode?: string | null;
          base_price: number;
          category_id: string;
          combo_eligible?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          happy_hour_price?: number | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_combo?: boolean;
          name: string;
          sku?: string | null;
          stock_threshold?: number | null;
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          base_price?: number;
          category_id?: string;
          combo_eligible?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          happy_hour_price?: number | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_combo?: boolean;
          name?: string;
          sku?: string | null;
          stock_threshold?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          pin: string;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          id: string;
          is_active?: boolean;
          name: string;
          pin: string;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          pin?: string;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      rappi_orders: {
        Row: {
          accepted_at: string | null;
          completed_at: string | null;
          customer_name: string;
          delivery_address: string;
          id: string;
          items: Json;
          rappi_order_id: string;
          rappi_total: number;
          received_at: string;
          rejection_reason: string | null;
          status: Database['public']['Enums']['rappi_order_status'];
          subtotal: number;
          tab_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          completed_at?: string | null;
          customer_name?: string;
          delivery_address?: string;
          id?: string;
          items?: Json;
          rappi_order_id: string;
          rappi_total: number;
          received_at?: string;
          rejection_reason?: string | null;
          status?: Database['public']['Enums']['rappi_order_status'];
          subtotal: number;
          tab_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          completed_at?: string | null;
          customer_name?: string;
          delivery_address?: string;
          id?: string;
          items?: Json;
          rappi_order_id?: string;
          rappi_total?: number;
          received_at?: string;
          rejection_reason?: string | null;
          status?: Database['public']['Enums']['rappi_order_status'];
          subtotal?: number;
          tab_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'rappi_orders_tab_id_fkey';
            columns: ['tab_id'];
            isOneToOne: false;
            referencedRelation: 'tabs';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: {
          id: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          id?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          id?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      settings_backups: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          label: string;
          restored_at: string | null;
          restored_by: string | null;
          snapshot: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label: string;
          restored_at?: string | null;
          restored_by?: string | null;
          snapshot: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string;
          restored_at?: string | null;
          restored_by?: string | null;
          snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'settings_backups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'settings_backups_restored_by_fkey';
            columns: ['restored_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      shifts: {
        Row: {
          clock_in: string;
          clock_out: string | null;
          closing_cash: number | null;
          created_at: string;
          id: string;
          opening_cash: number;
          staff_id: string;
          updated_at: string;
        };
        Insert: {
          clock_in?: string;
          clock_out?: string | null;
          closing_cash?: number | null;
          created_at?: string;
          id?: string;
          opening_cash?: number;
          staff_id: string;
          updated_at?: string;
        };
        Update: {
          clock_in?: string;
          clock_out?: string | null;
          closing_cash?: number | null;
          created_at?: string;
          id?: string;
          opening_cash?: number;
          staff_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shifts_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tab_transfers: {
        Row: {
          from_staff_id: string | null;
          from_table: number | null;
          id: string;
          reason: string | null;
          tab_id: string;
          to_staff_id: string | null;
          to_table: number | null;
          transfer_type: string;
          transferred_at: string;
          transferred_by: string;
        };
        Insert: {
          from_staff_id?: string | null;
          from_table?: number | null;
          id?: string;
          reason?: string | null;
          tab_id: string;
          to_staff_id?: string | null;
          to_table?: number | null;
          transfer_type?: string;
          transferred_at?: string;
          transferred_by: string;
        };
        Update: {
          from_staff_id?: string | null;
          from_table?: number | null;
          id?: string;
          reason?: string | null;
          tab_id?: string;
          to_staff_id?: string | null;
          to_table?: number | null;
          transfer_type?: string;
          transferred_at?: string;
          transferred_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tab_transfers_from_staff_id_fkey';
            columns: ['from_staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tab_transfers_tab_id_fkey';
            columns: ['tab_id'];
            isOneToOne: false;
            referencedRelation: 'tabs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tab_transfers_to_staff_id_fkey';
            columns: ['to_staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tab_transfers_transferred_by_fkey';
            columns: ['transferred_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tabs: {
        Row: {
          caja_session_id: string | null;
          closed_at: string | null;
          created_at: string;
          customer_name: string | null;
          deleted_at: string | null;
          id: string;
          is_deleted: boolean;
          notes: string | null;
          opened_at: string;
          parent_tab_id: string | null;
          rappi_order_id: string | null;
          shift_id: string;
          split_label: string | null;
          split_mode: string | null;
          staff_id: string;
          status: Database['public']['Enums']['tab_status'];
          table_number: number | null;
          updated_at: string;
        };
        Insert: {
          caja_session_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          customer_name?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          notes?: string | null;
          opened_at?: string;
          parent_tab_id?: string | null;
          rappi_order_id?: string | null;
          shift_id: string;
          split_label?: string | null;
          split_mode?: string | null;
          staff_id: string;
          status?: Database['public']['Enums']['tab_status'];
          table_number?: number | null;
          updated_at?: string;
        };
        Update: {
          caja_session_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          customer_name?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean;
          notes?: string | null;
          opened_at?: string;
          parent_tab_id?: string | null;
          rappi_order_id?: string | null;
          shift_id?: string;
          split_label?: string | null;
          split_mode?: string | null;
          staff_id?: string;
          status?: Database['public']['Enums']['tab_status'];
          table_number?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tabs_caja_session_id_fkey';
            columns: ['caja_session_id'];
            isOneToOne: false;
            referencedRelation: 'caja_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tabs_parent_tab_id_fkey';
            columns: ['parent_tab_id'];
            isOneToOne: false;
            referencedRelation: 'tabs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tabs_shift_id_fkey';
            columns: ['shift_id'];
            isOneToOne: false;
            referencedRelation: 'shifts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tabs_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      recipes: {
        Row: {
          id: string;
          product_id: string | null;
          prep_ingredient_id: string | null;
          yield_qty: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          prep_ingredient_id?: string | null;
          yield_qty?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string | null;
          prep_ingredient_id?: string | null;
          yield_qty?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recipes_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipes_prep_ingredient_id_fkey';
            columns: ['prep_ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      recipe_items: {
        Row: {
          id: string;
          recipe_id: string;
          ingredient_id: string;
          qty: number;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          ingredient_id: string;
          qty: number;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          ingredient_id?: string;
          qty?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_items_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          action: string;
          actor_id: string | null;
          entity_type: string | null;
          entity_id: string | null;
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          action: string;
          actor_id?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          details?: Json | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      // Report views — Phase 8 S6-01 (pre-regen manual transcription)
      combo_mix_daily: {
        Row: {
          date: string | null;
          combo_product_id: string | null;
          combo_name: string | null;
          qty_sold: number | null;
          net_revenue: number | null;
          avg_price: number | null;
          override_count: number | null;
        };
      };
      recipe_variance_daily: {
        Row: {
          date: string | null;
          ingredient_id: string | null;
          ingredient_name: string | null;
          theoretical_used: number | null;
          physical_delta: number | null;
          variance_pct: number | null;
        };
      };
      waitlist_metrics_daily: {
        Row: {
          date: string | null;
          parties_seated: number | null;
          avg_quoted_wait: number | null;
          avg_actual_wait: number | null;
          no_show_rate: number | null;
        };
      };
    };
    Functions: {
      close_caja_session: {
        Args: {
          p_caja_id: string;
          p_closed_by: string;
          p_closing_cash: number;
          p_notes?: string;
        };
        Returns: Json;
      };
      create_order_with_items: {
        Args: {
          p_items: Json;
          p_notes: string;
          p_staff_id: string;
          p_status: Database['public']['Enums']['order_status'];
          p_tab_id: string;
        };
        Returns: Json;
      };
      get_caja_report: { Args: { p_caja_id: string }; Returns: Json };
      get_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      list_caja_sessions: { Args: { p_limit?: number }; Returns: Json };
      process_payment_atomic: {
        Args: {
          p_amount: number;
          p_discount_amount?: number;
          p_discount_scope?: string;
          p_discount_type?: string;
          p_discount_value?: number;
          p_idempotency_key: string;
          p_method: string;
          p_rappi_order_id?: string;
          p_reference_number?: string;
          p_staff_id: string;
          p_tab_id: string;
          p_tendered_amount?: number;
          p_tip_amount: number;
        };
        Returns: Json;
      };
      process_refund: {
        Args: {
          p_original_payment_id: string;
          p_items: Json;
          p_reason: string;
          p_manager_pin: string;
        };
        Returns: string;
      };
      split_tab_by_amount: {
        Args: {
          p_parent_tab_id: string;
          p_amounts: Json;
        };
        Returns: string[];
      };
      split_tab_by_item: {
        Args: {
          p_parent_tab_id: string;
          p_assignments: Json;
        };
        Returns: string[];
      };
      split_tab_by_person: {
        Args: {
          p_parent_tab_id: string;
          p_n: number;
          p_assignments: Json;
        };
        Returns: string[];
      };
      split_tab_evenly: {
        Args: {
          p_parent_tab_id: string;
          p_n: number;
        };
        Returns: Json;
      };
      transfer_pool_session: {
        Args: {
          p_reason?: string;
          p_session_id: string;
          p_to_pool_table_id: string;
          p_transferred_by: string;
        };
        Returns: Json;
      };
      transfer_tab: {
        Args: {
          p_reason?: string;
          p_tab_id: string;
          p_to_staff_id?: string;
          p_to_table?: number;
          p_transfer_type?: string;
          p_transferred_by: string;
        };
        Returns: Json;
      };
      deplete_for_order_item: {
        Args: {
          p_order_item_id: string;
          p_direction: number;
          p_allow_negative?: boolean;
        };
        Returns: undefined;
      };
    };
    Enums: {
      order_status: 'pending' | 'served' | 'voided';
      payment_method: 'cash' | 'card' | 'tab_transfer' | 'rappi';
      pool_table_status: 'available' | 'occupied' | 'reserved' | 'maintenance';
      rappi_order_status:
        | 'pending_acceptance'
        | 'accepted'
        | 'preparing'
        | 'ready_for_pickup'
        | 'completed'
        | 'rejected';
      tab_status: 'open' | 'closed' | 'paid' | 'voided' | 'split';
      user_role: 'bartender' | 'manager' | 'admin' | 'kitchen';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      order_status: ['pending', 'served', 'voided'],
      payment_method: ['cash', 'card', 'tab_transfer', 'rappi'],
      pool_table_status: ['available', 'occupied', 'reserved', 'maintenance'],
      rappi_order_status: [
        'pending_acceptance',
        'accepted',
        'preparing',
        'ready_for_pickup',
        'completed',
        'rejected',
      ],
      tab_status: ['open', 'closed', 'paid', 'voided', 'split'],
      user_role: ['bartender', 'manager', 'admin', 'kitchen'],
    },
  },
} as const;
