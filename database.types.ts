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
      centros: {
        Row: {
          activo: boolean | null
          ciudad: string | null
          codigo_postal: string | null
          created_at: string | null
          direccion_completa: string
          id: string
          nombre: string
          provincia: string | null
          radio_metros: number
          tipo: Database["public"]["Enums"]["tipo_centro"]
          ubicacion: unknown
          ubicacion_sugerida: unknown
          ubicacion_sugerida_at: string | null
          ubicacion_sugerida_por: string | null
          ubicacion_sugerida_precision_m: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          direccion_completa: string
          id?: string
          nombre: string
          provincia?: string | null
          radio_metros?: number
          tipo: Database["public"]["Enums"]["tipo_centro"]
          ubicacion: unknown
          ubicacion_sugerida?: unknown
          ubicacion_sugerida_at?: string | null
          ubicacion_sugerida_por?: string | null
          ubicacion_sugerida_precision_m?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          direccion_completa?: string
          id?: string
          nombre?: string
          provincia?: string | null
          radio_metros?: number
          tipo?: Database["public"]["Enums"]["tipo_centro"]
          ubicacion?: unknown
          ubicacion_sugerida?: unknown
          ubicacion_sugerida_at?: string | null
          ubicacion_sugerida_por?: string | null
          ubicacion_sugerida_precision_m?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          created_at: string
          id: number
          name: string
          province_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          province_id: number
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          province_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      device_changes: {
        Row: {
          authorization_code: string | null
          authorization_code_expires_at: string | null
          authorized_at: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          new_device_id: string | null
          old_device_id: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          authorization_code?: string | null
          authorization_code_expires_at?: string | null
          authorized_at?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_device_id?: string | null
          old_device_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          authorization_code?: string | null
          authorization_code_expires_at?: string | null
          authorized_at?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_device_id?: string | null
          old_device_id?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_changes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          baja_paciente_ids: Json
          bajas_documentos: Json
          bajas_pac_cursor: number
          bajas_prest_cursor: number
          candidates: Json
          consult_cursor: number
          created_at: string
          created_by: string | null
          error_message: string | null
          errors: Json
          existing_map: Json
          geocode_cache: Json
          geocode_cursor: number
          geocode_queue_indices: Json
          geocoded_count: number
          id: string
          pending_geocode: Json
          prestaciones_cancelled: number
          stage: string
          status: string
          summary: Json | null
          updated_at: string
          upsert_cursor: number
        }
        Insert: {
          baja_paciente_ids?: Json
          bajas_documentos?: Json
          bajas_pac_cursor?: number
          bajas_prest_cursor?: number
          candidates?: Json
          consult_cursor?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          errors?: Json
          existing_map?: Json
          geocode_cache?: Json
          geocode_cursor?: number
          geocode_queue_indices?: Json
          geocoded_count?: number
          id?: string
          pending_geocode?: Json
          prestaciones_cancelled?: number
          stage?: string
          status?: string
          summary?: Json | null
          updated_at?: string
          upsert_cursor?: number
        }
        Update: {
          baja_paciente_ids?: Json
          bajas_documentos?: Json
          bajas_pac_cursor?: number
          bajas_prest_cursor?: number
          candidates?: Json
          consult_cursor?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          errors?: Json
          existing_map?: Json
          geocode_cache?: Json
          geocode_cursor?: number
          geocode_queue_indices?: Json
          geocoded_count?: number
          id?: string
          pending_geocode?: Json
          prestaciones_cancelled?: number
          stage?: string
          status?: string
          summary?: Json | null
          updated_at?: string
          upsert_cursor?: number
        }
        Relationships: []
      }
      jornadas_residencia: {
        Row: {
          centro_id: string
          created_at: string | null
          entrada_at: string
          estado: string
          fecha: string
          id: string
          salida_at: string | null
          ubicacion_entrada_lat: number | null
          ubicacion_entrada_lng: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          centro_id: string
          created_at?: string | null
          entrada_at: string
          estado?: string
          fecha: string
          id?: string
          salida_at?: string | null
          ubicacion_entrada_lat?: number | null
          ubicacion_entrada_lng?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          centro_id?: string
          created_at?: string | null
          entrada_at?: string
          estado?: string
          fecha?: string
          id?: string
          salida_at?: string | null
          ubicacion_entrada_lat?: number | null
          ubicacion_entrada_lng?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      obras_sociales: {
        Row: {
          activa: boolean | null
          codigo: string | null
          created_at: string | null
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      paciente_centros: {
        Row: {
          activo: boolean | null
          centro_id: string
          created_at: string | null
          desde: string
          hasta: string | null
          id: string
          paciente_id: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          centro_id: string
          created_at?: string | null
          desde?: string
          hasta?: string | null
          id?: string
          paciente_id: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          centro_id?: string
          created_at?: string | null
          desde?: string
          hasta?: string | null
          id?: string
          paciente_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paciente_centros_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paciente_centros_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          activo: boolean | null
          apellido: string
          ciudad: string | null
          codigo_postal: string | null
          created_at: string | null
          direccion_completa: string
          documento: string
          email: string | null
          id: string
          nombre: string
          provincia: string | null
          telefono: string | null
          ubicacion: unknown
          ubicacion_sugerida: unknown
          ubicacion_sugerida_at: string | null
          ubicacion_sugerida_por: string | null
          ubicacion_sugerida_precision_m: number | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          apellido: string
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          direccion_completa: string
          documento: string
          email?: string | null
          id?: string
          nombre: string
          provincia?: string | null
          telefono?: string | null
          ubicacion?: unknown
          ubicacion_sugerida?: unknown
          ubicacion_sugerida_at?: string | null
          ubicacion_sugerida_por?: string | null
          ubicacion_sugerida_precision_m?: number | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          apellido?: string
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string | null
          direccion_completa?: string
          documento?: string
          email?: string | null
          id?: string
          nombre?: string
          provincia?: string | null
          telefono?: string | null
          ubicacion?: unknown
          ubicacion_sugerida?: unknown
          ubicacion_sugerida_at?: string | null
          ubicacion_sugerida_por?: string | null
          ubicacion_sugerida_precision_m?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prestaciones: {
        Row: {
          auto_cerrada: boolean | null
          auto_cierre_motivo: string | null
          centro_id: string | null
          chofer_user_id: string | null
          cierre_estado: string | null
          completado_por: string | null
          completed_at: string | null
          created_at: string | null
          cronico: boolean | null
          descripcion: string | null
          distancia_inicio: number | null
          distancia_validacion: number | null
          estado: Database["public"]["Enums"]["prestacion_estado"] | null
          fecha: string
          horas_reconocidas: number | null
          id: string
          monto: number | null
          notas: string | null
          obra_social_id: string | null
          paciente_id: string | null
          sentido_transporte: string | null
          started_at: string | null
          tipo_prestacion: Database["public"]["Enums"]["tipo_prestacion"]
          ubicacion_cierre: unknown
          ubicacion_inicio: unknown
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_cerrada?: boolean | null
          auto_cierre_motivo?: string | null
          centro_id?: string | null
          chofer_user_id?: string | null
          cierre_estado?: string | null
          completado_por?: string | null
          completed_at?: string | null
          created_at?: string | null
          cronico?: boolean | null
          descripcion?: string | null
          distancia_inicio?: number | null
          distancia_validacion?: number | null
          estado?: Database["public"]["Enums"]["prestacion_estado"] | null
          fecha: string
          horas_reconocidas?: number | null
          id?: string
          monto?: number | null
          notas?: string | null
          obra_social_id?: string | null
          paciente_id?: string | null
          sentido_transporte?: string | null
          started_at?: string | null
          tipo_prestacion: Database["public"]["Enums"]["tipo_prestacion"]
          ubicacion_cierre?: unknown
          ubicacion_inicio?: unknown
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_cerrada?: boolean | null
          auto_cierre_motivo?: string | null
          centro_id?: string | null
          chofer_user_id?: string | null
          cierre_estado?: string | null
          completado_por?: string | null
          completed_at?: string | null
          created_at?: string | null
          cronico?: boolean | null
          descripcion?: string | null
          distancia_inicio?: number | null
          distancia_validacion?: number | null
          estado?: Database["public"]["Enums"]["prestacion_estado"] | null
          fecha?: string
          horas_reconocidas?: number | null
          id?: string
          monto?: number | null
          notas?: string | null
          obra_social_id?: string | null
          paciente_id?: string | null
          sentido_transporte?: string | null
          started_at?: string | null
          tipo_prestacion?: Database["public"]["Enums"]["tipo_prestacion"]
          ubicacion_cierre?: unknown
          ubicacion_inicio?: unknown
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prestaciones_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "centros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestaciones_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestaciones_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      prestaciones_reasignacion_pool: {
        Row: {
          cancelled_at: string
          cancelled_by: string | null
          id: string
          metadata: Json | null
          prestacion_id: string
          prestador_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string
        }
        Insert: {
          cancelled_at?: string
          cancelled_by?: string | null
          id?: string
          metadata?: Json | null
          prestacion_id: string
          prestador_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
        }
        Update: {
          cancelled_at?: string
          cancelled_by?: string | null
          id?: string
          metadata?: Json | null
          prestacion_id?: string
          prestador_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestaciones_reasignacion_pool_prestacion_id_fkey"
            columns: ["prestacion_id"]
            isOneToOne: false
            referencedRelation: "prestaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestaciones_reasignacion_pool_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean | null
          apellido: string | null
          created_at: string | null
          device_id: string | null
          device_id_updated_at: string | null
          documento: string | null
          email: string | null
          especialidad: string | null
          id: string
          matricula: string | null
          nombre: string | null
          registration_source: string | null
          telefono: string | null
          tipo_prestador: string | null
          tipo_usuario: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          apellido?: string | null
          created_at?: string | null
          device_id?: string | null
          device_id_updated_at?: string | null
          documento?: string | null
          email?: string | null
          especialidad?: string | null
          id?: string
          matricula?: string | null
          nombre?: string | null
          registration_source?: string | null
          telefono?: string | null
          tipo_prestador?: string | null
          tipo_usuario?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          apellido?: string | null
          created_at?: string | null
          device_id?: string | null
          device_id_updated_at?: string | null
          documento?: string | null
          email?: string | null
          especialidad?: string | null
          id?: string
          matricula?: string | null
          nombre?: string | null
          registration_source?: string | null
          telefono?: string | null
          tipo_prestador?: string | null
          tipo_usuario?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provinces: {
        Row: {
          created_at: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      transportista_choferes: {
        Row: {
          activo: boolean
          chofer_user_id: string
          created_at: string
          transportista_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          chofer_user_id: string
          created_at?: string
          transportista_id: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          chofer_user_id?: string
          created_at?: string
          transportista_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ubicacion_sugerencias: {
        Row: {
          accuracy: number | null
          created_at: string
          created_by: string
          direccion_aproximada: string | null
          id: string
          origen: string
          paciente_id: string
          prestacion_id: string
          ubicacion_lat: number
          ubicacion_lng: number
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          created_by?: string
          direccion_aproximada?: string | null
          id?: string
          origen: string
          paciente_id: string
          prestacion_id: string
          ubicacion_lat: number
          ubicacion_lng: number
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          created_by?: string
          direccion_aproximada?: string | null
          id?: string
          origen?: string
          paciente_id?: string
          prestacion_id?: string
          ubicacion_lat?: number
          ubicacion_lng?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_user_roles: {
        Row: {
          role: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      aprobar_ubicacion_sugerida_centro: {
        Args: { p_centro_id: string }
        Returns: undefined
      }
      aprobar_ubicacion_sugerida_paciente: {
        Args: { p_paciente_id: string }
        Returns: undefined
      }
      autorizar_cambio_dispositivo:
        | { Args: { p_change_id: string }; Returns: Json }
        | {
            Args: { p_authorization_code: string; p_change_id: string }
            Returns: Json
          }
      calcular_distancia_metros: {
        Args: { punto1: unknown; punto2: unknown }
        Returns: number
      }
      cancelar_prestaciones_vencidas: { Args: never; Returns: undefined }
      cerrar_prestacion_con_validacion: {
        Args: {
          notas_cierre?: string
          p_device_id?: string
          p_timestamp_cierre_real?: string
          prestacion_id: string
          radio_permitido?: number
          ubicacion_profesional: unknown
        }
        Returns: {
          distancia_metros: number
          exito: boolean
          mensaje: string
          prestacion_actualizada: Json
        }[]
      }
      cerrar_prestaciones_abiertas_23_59: { Args: never; Returns: undefined }
      disable_prestador_and_cancel: {
        Args: { p_actor_id: string; p_prestador_id: string; p_reason?: string }
        Returns: {
          cancelled_count: number
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      finalizar_prestacion_transporte: {
        Args: {
          notas_cierre?: string
          prestacion_id: string
          radio_permitido?: number
          ubicacion_profesional: unknown
        }
        Returns: {
          distancia_metros: number
          exito: boolean
          mensaje: string
          prestacion_actualizada: Json
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_dashboard_detalle: {
        Args: { p_end: string; p_start: string }
        Returns: {
          cronico: boolean
          estado: Database["public"]["Enums"]["prestacion_estado"]
          fecha: string
          id: string
          monto: number
          paciente_id: string
          tipo_prestacion: string
          user_id: string
        }[]
      }
      get_dashboard_summary: {
        Args: { p_end: string; p_start: string }
        Returns: {
          canceladas: number
          completadas: number
          monto_total: number
          pendientes: number
          porcentaje_completado: number
          prestaciones_por_tipo: Json
          total: number
        }[]
      }
      get_pacientes_con_prestaciones: {
        Args: never
        Returns: {
          apellido: string
          documento: string
          id: string
          nombre: string
        }[]
      }
      get_prestadores_con_prestaciones: {
        Args: never
        Returns: {
          apellido: string
          documento: string
          id: string
          nombre: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      iniciar_prestacion_transporte: {
        Args: {
          prestacion_id: string
          radio_permitido?: number
          ubicacion_profesional: unknown
        }
        Returns: {
          distancia_metros: number
          exito: boolean
          mensaje: string
          prestacion_actualizada: Json
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      obtener_horas_acumuladas_mes:
        | {
            Args: never
            Returns: {
              minutos: number
              paciente_id: string
            }[]
          }
        | {
            Args: { p_user_id?: string }
            Returns: {
              minutos: number
              paciente_id: string
            }[]
          }
      obtener_prestaciones_con_coordenadas: {
        Args: { p_fecha_fin: string; p_fecha_inicio: string; p_user_id: string }
        Returns: {
          centro_direccion_completa: string
          centro_id: string
          centro_lat: number
          centro_lng: number
          centro_nombre: string
          centro_radio_metros: number
          completed_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["prestacion_estado"]
          fecha: string
          id: string
          monto: number
          notas: string
          obra_social_nombre: string
          paciente_apellido: string
          paciente_direccion_completa: string
          paciente_id: string
          paciente_lat: number
          paciente_lng: number
          paciente_nombre: string
          paciente_telefono: string
          sentido_transporte: string
          started_at: string
          tipo_prestacion: Database["public"]["Enums"]["tipo_prestacion"]
        }[]
      }
      obtener_prestaciones_con_coordenadas_v2: {
        Args: { p_fecha_fin: string; p_fecha_inicio: string; p_user_id: string }
        Returns: {
          centro_direccion_completa: string
          centro_domicilio_lat: number
          centro_domicilio_lng: number
          centro_id: string
          centro_lat: number
          centro_lng: number
          centro_nombre: string
          centro_radio_metros: number
          centro_sugerida_lat: number
          centro_sugerida_lng: number
          centro_tiene_ubicacion_sugerida: boolean
          chofer_user_id: string
          completed_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["prestacion_estado"]
          fecha: string
          id: string
          monto: number
          notas: string
          obra_social_nombre: string
          paciente_apellido: string
          paciente_direccion_completa: string
          paciente_domicilio_lat: number
          paciente_domicilio_lng: number
          paciente_id: string
          paciente_lat: number
          paciente_lng: number
          paciente_nombre: string
          paciente_sugerida_lat: number
          paciente_sugerida_lng: number
          paciente_telefono: string
          paciente_tiene_ubicacion_sugerida: boolean
          sentido_transporte: string
          started_at: string
          tipo_prestacion: Database["public"]["Enums"]["tipo_prestacion"]
        }[]
      }
      obtener_prestaciones_pendientes: {
        Args: { usuario_id?: string }
        Returns: {
          descripcion: string
          fecha: string
          monto: number
          obra_social: string
          paciente_direccion: string
          paciente_nombre: string
          paciente_telefono: string
          prestacion_id: string
          ubicacion_paciente_lat: number
          ubicacion_paciente_lng: number
        }[]
      }
      obtener_prestaciones_pendientes_centro: {
        Args: { p_centro_id: string }
        Returns: {
          estado: string
          fecha: string
          paciente_apellido: string
          paciente_completo_hoy: boolean
          paciente_id: string
          paciente_nombre: string
          prestacion_id: string
          tipo_prestacion: string
        }[]
      }
      obtener_viajes_transporte_chofer: {
        Args: {
          p_chofer_id: string
          p_fecha_fin: string
          p_fecha_inicio: string
        }
        Returns: {
          centro_direccion_completa: string
          centro_id: string
          centro_lat: number
          centro_lng: number
          centro_nombre: string
          centro_radio_metros: number
          centro_tiene_ubicacion_sugerida: boolean
          chofer_user_id: string
          completed_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["prestacion_estado"]
          fecha: string
          id: string
          monto: number
          notas: string
          obra_social_nombre: string
          paciente_apellido: string
          paciente_direccion_completa: string
          paciente_id: string
          paciente_lat: number
          paciente_lng: number
          paciente_nombre: string
          paciente_telefono: string
          paciente_tiene_ubicacion_sugerida: boolean
          sentido_transporte: string
          started_at: string
          tipo_prestacion: Database["public"]["Enums"]["tipo_prestacion"]
        }[]
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      programar_prestaciones_cronicas: { Args: never; Returns: undefined }
      programar_prestaciones_cronicas_manual: {
        Args: never
        Returns: undefined
      }
      rechazar_ubicacion_sugerida_centro: {
        Args: { p_centro_id: string }
        Returns: undefined
      }
      rechazar_ubicacion_sugerida_paciente: {
        Args: { p_paciente_id: string }
        Returns: undefined
      }
      registrar_device_id: { Args: { p_device_id: string }; Returns: Json }
      registrar_o_validar_device: {
        Args: { p_device_id: string }
        Returns: Json
      }
      set_prestador_activo: {
        Args: { p_activo: boolean; p_prestador_id: string }
        Returns: undefined
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      sugerir_ubicacion_centro:
        | {
            Args: {
              p_centro_id: string
              p_lat: number
              p_lng: number
              p_precision_m?: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_centro_id: string
              p_precision_m?: number
              p_ubicacion: unknown
            }
            Returns: undefined
          }
      sugerir_ubicacion_desde_prestacion: {
        Args: {
          p_lat: number
          p_lng: number
          p_precision_m?: number
          p_prestacion_id: string
        }
        Returns: {
          exito: boolean
          mensaje: string
        }[]
      }
      sugerir_ubicacion_paciente: {
        Args: {
          p_paciente_id: string
          p_precision_m?: number
          p_ubicacion: unknown
        }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      validar_prestaciones_centro: {
        Args: {
          p_device_id?: string
          p_prestacion_ids: string[]
          p_radio_permitido_metros?: number
          p_ubicacion_lat: number
          p_ubicacion_lng: number
        }
        Returns: Json
      }
      validar_ubicacion_prestacion: {
        Args: {
          prestacion_id: string
          radio_permitido?: number
          ubicacion_actual: unknown
        }
        Returns: {
          distancia_metros: number
          paciente_nombre: string
          valida: boolean
        }[]
      }
    }
    Enums: {
      prestacion_estado: "pendiente" | "completada" | "cancelada" | "en_proceso"
      tipo_centro: "geriatrico" | "escuela" | "centro medico" | "otro"
      tipo_prestacion:
        | "consulta"
        | "cirugia"
        | "diagnostico"
        | "emergencia"
        | "control"
        | "laboratorio"
        | "Acompañante Terapeutico"
        | "Kinesiología"
        | "Transporte"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      prestacion_estado: ["pendiente", "completada", "cancelada", "en_proceso"],
      tipo_centro: ["geriatrico", "escuela", "centro medico", "otro"],
      tipo_prestacion: [
        "consulta",
        "cirugia",
        "diagnostico",
        "emergencia",
        "control",
        "laboratorio",
        "Acompañante Terapeutico",
        "Kinesiología",
        "Transporte",
      ],
    },
  },
} as const
