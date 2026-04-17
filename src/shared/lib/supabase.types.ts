export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      categories: {
        Row: {
          color: string;
          created_at: string;
          happy_hour_end: string | null;
          happy_hour_start: string | null;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          happy_hour_end?: string | null;
          happy_hour_start?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          happy_hour_end?: string | null;
          happy_hour_start?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
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
      inventory_log: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          quantity_delta: number;
          reason: string;
          staff_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          quantity_delta: number;
          reason: string;
          staff_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity_delta?: number;
          reason?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_log_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_log_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
          id: string;
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
          id?: string;
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
          id?: string;
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
          id: string;
          notes: string | null;
          staff_id: string;
          status: Database['public']['Enums']['order_status'];
          tab_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          staff_id: string;
          status?: Database['public']['Enums']['order_status'];
          tab_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          staff_id?: string;
          status?: Database['public']['Enums']['order_status'];
          tab_id?: string;
          updated_at?: string;
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
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          idempotency_key: string;
          method: Database['public']['Enums']['payment_method'];
          processed_at: string;
          processed_by: string;
          reference_number: string | null;
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
          id?: string;
          idempotency_key: string;
          method: Database['public']['Enums']['payment_method'];
          processed_at?: string;
          processed_by: string;
          reference_number?: string | null;
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
          id?: string;
          idempotency_key?: string;
          method?: Database['public']['Enums']['payment_method'];
          processed_at?: string;
          processed_by?: string;
          reference_number?: string | null;
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
            foreignKeyName: 'payments_tab_id_fkey';
            columns: ['tab_id'];
            isOneToOne: true;
            referencedRelation: 'tabs';
            referencedColumns: ['id'];
          },
        ];
      };
      pool_sessions: {
        Row: {
          billed_minutes: number | null;
          created_at: string;
          id: string;
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
          id?: string;
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
          id?: string;
          started_at?: string;
          stopped_at?: string | null;
          tab_id?: string | null;
          table_id?: string;
          total_charge?: number | null;
          updated_at?: string;
        };
        Relationships: [
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
      pool_tables: {
        Row: {
          created_at: string;
          current_session_id: string | null;
          id: string;
          label: string;
          number: number;
          rate_per_hour: number;
          status: Database['public']['Enums']['pool_table_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_session_id?: string | null;
          id?: string;
          label: string;
          number: number;
          rate_per_hour: number;
          status?: Database['public']['Enums']['pool_table_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_session_id?: string | null;
          id?: string;
          label?: string;
          number?: number;
          rate_per_hour?: number;
          status?: Database['public']['Enums']['pool_table_status'];
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
          base_price: number;
          category_id: string;
          created_at: string;
          happy_hour_price: number | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          sku: string | null;
          updated_at: string;
        };
        Insert: {
          base_price: number;
          category_id: string;
          created_at?: string;
          happy_hour_price?: number | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          sku?: string | null;
          updated_at?: string;
        };
        Update: {
          base_price?: number;
          category_id?: string;
          created_at?: string;
          happy_hour_price?: number | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          sku?: string | null;
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
      tabs: {
        Row: {
          closed_at: string | null;
          created_at: string;
          customer_name: string | null;
          id: string;
          notes: string | null;
          opened_at: string;
          rappi_order_id: string | null;
          shift_id: string;
          staff_id: string;
          status: Database['public']['Enums']['tab_status'];
          table_number: number | null;
          updated_at: string;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          customer_name?: string | null;
          id?: string;
          notes?: string | null;
          opened_at?: string;
          rappi_order_id?: string | null;
          shift_id: string;
          staff_id: string;
          status?: Database['public']['Enums']['tab_status'];
          table_number?: number | null;
          updated_at?: string;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          customer_name?: string | null;
          id?: string;
          notes?: string | null;
          opened_at?: string;
          rappi_order_id?: string | null;
          shift_id?: string;
          staff_id?: string;
          status?: Database['public']['Enums']['tab_status'];
          table_number?: number | null;
          updated_at?: string;
        };
        Relationships: [
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
      get_user_role: {
        Args: never;
        Returns: Database['public']['Enums']['user_role'];
      };
      process_payment_atomic: {
        Args: {
          p_amount: number;
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
      tab_status: 'open' | 'closed' | 'paid' | 'voided';
      user_role: 'bartender' | 'manager' | 'admin';
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
  PublicCompositeTypeNameOrOptions extends string | { schema: keyof DatabaseWithoutInternals },
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
      tab_status: ['open', 'closed', 'paid', 'voided'],
      user_role: ['bartender', 'manager', 'admin'],
    },
  },
} as const;
