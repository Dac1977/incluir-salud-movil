import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment-timezone';
import 'moment/locale/es'; // Importar locale en español
import { supabase } from '../lib/supabase';
import { connectivityService } from './connectivityService';
import { deviceService } from './deviceService';
import { jornadaService } from './jornadaService';

// Tipos base de la base de datos
export interface PrestacionDB {
  id: string;
  user_id: string;
  paciente_id: string;
  fecha: string;
  tipo_prestacion: 'consulta' | 'cirugia' | 'diagnostico' | 'emergencia' | 'control' | 'laboratorio';
  estado: 'pendiente' | 'completada' | 'cancelada' | 'en_proceso';
  monto: number;
  descripcion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  ubicacion_cierre: any | null;
  distancia_validacion: number | null;
}

export interface PacienteDB {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  email: string;
  direccion_completa: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  ubicacion: any; // PostGIS POINT
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ObraSocialDB {
  id: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Tipos derivados para la aplicación
export interface PrestacionCompleta {
  prestacion_id: string;
  descripcion: string;
  fecha: string;
  monto: number;
  paciente_nombre: string;
  paciente_direccion: string;
  paciente_telefono: string;
  ubicacion_paciente_lat: number;
  ubicacion_paciente_lng: number;
  paciente_tiene_ubicacion_sugerida?: boolean;
  obra_social: string;
  estado: 'pendiente' | 'completada' | 'cancelada' | 'en_proceso';
  tipo_prestacion: string;
  chofer_user_id?: string | null;
  sentido_transporte?: string;
  centro_id?: string;
  centro_nombre?: string;
  centro_direccion?: string;
  centro_lat?: number;
  centro_lng?: number;
  centro_radio_metros?: number;
  centro_tiene_ubicacion_sugerida?: boolean;
  paciente_domicilio_lat?: number;
  paciente_domicilio_lng?: number;
  paciente_sugerida_lat?: number;
  paciente_sugerida_lng?: number;
  centro_domicilio_lat?: number;
  centro_domicilio_lng?: number;
  centro_sugerida_lat?: number;
  centro_sugerida_lng?: number;
  started_at?: string;
  completed_at?: string;
  notas?: string;
  paciente_id: string;
}

export interface SugerenciaOffline {
  tipo: 'paciente' | 'centro';
  id: string;
  ubicacion_lat: number;
  ubicacion_lng: number;
  precision_m: number | null;
  timestamp: string;
}

export interface PrestacionOffline {
  prestacion_id: string;
  prestacion_ids?: string[];
  accion?: 'cerrar' | 'cerrar_domicilio' | 'iniciar_domicilio' | 'transporte_iniciar' | 'transporte_finalizar' | 'centro_validar';
  ubicacion_lat: number;
  ubicacion_lng: number;
  notas: string;
  timestamp: string;
  distancia_metros: number;
}

export interface ValidacionUbicacion {
  exito: boolean;
  mensaje: string;
  distancia_metros: number;
  prestacion_actualizada?: any;
}

class PrestacionService {
  private readonly OFFLINE_KEY = 'prestaciones_offline';
  private readonly SUGGESTIONS_OFFLINE_KEY = 'sugerencias_offline';
  private readonly CACHE_KEY = 'prestaciones_cache';
  private readonly CACHE_TIMESTAMP_KEY = 'prestaciones_cache_timestamp';
  private readonly TIMEZONE = 'America/Argentina/Buenos_Aires';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  constructor() {
    // Configurar moment.js con el timezone de Argentina y locale en español
    moment.tz.setDefault(this.TIMEZONE);
    moment.locale('es');
  }

  // Corre una promesa con un límite de tiempo. Si se excede, rechaza con un error
  // de timeout (la promesa original sigue en curso pero deja de bloquear el flujo),
  // permitiendo que el llamador caiga a su fallback de cache. Pensado para casos como
  // "hay señal pero no hay crédito/datos reales" donde el request queda colgado en vez
  // de fallar rápido.
  private conTimeout<T>(promesa: PromiseLike<T>, ms: number = 15000): Promise<T> {
    return Promise.race([
      Promise.resolve(promesa),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_RED')), ms)
      )
    ]);
  }

  async sugerirUbicacionDesdePrestacion(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    precisionM?: number | null
  ): Promise<{ exito: boolean; mensaje: string; offline?: boolean }> {
    const isOnline = await connectivityService.isOnline();

    // Determinar si la prestación es en centro para guardar la sugerencia correctamente
    const cachedData = await this.obtenerDeCache();
    const prestacion = cachedData
      ? [...cachedData.pendientes, ...cachedData.completadas].find(p => p.prestacion_id === prestacionId)
      : undefined;
    const esCentro = prestacion?.centro_id && prestacion.tipo_prestacion !== 'Transporte';
    const sugerenciaTipo: 'paciente' | 'centro' = esCentro ? 'centro' : 'paciente';
    const sugerenciaId = esCentro ? prestacion.centro_id! : prestacionId;

    if (!isOnline) {
      await this.guardarSugerenciaOffline({
        tipo: sugerenciaTipo,
        id: sugerenciaId,
        ubicacion_lat: ubicacionLat,
        ubicacion_lng: ubicacionLng,
        precision_m: precisionM ?? null,
        timestamp: new Date().toISOString(),
      });
      return { exito: true, mensaje: 'Sugerencia guardada. Se enviará cuando tengas conexión.', offline: true };
    }

    const { data, error } = await supabase.rpc('sugerir_ubicacion_desde_prestacion', {
      p_prestacion_id: prestacionId,
      p_lat: ubicacionLat,
      p_lng: ubicacionLng,
      p_precision_m: precisionM ?? undefined,
    });

    if (error) {
      throw error;
    }

    const payload = (data?.[0] as { exito: boolean; mensaje: string } | undefined) ?? {
      exito: false,
      mensaje: 'Respuesta inválida al sugerir ubicación',
    };

    if (payload.exito) {
      await this.guardarSugerenciaOffline({
        tipo: sugerenciaTipo,
        id: sugerenciaId,
        ubicacion_lat: ubicacionLat,
        ubicacion_lng: ubicacionLng,
        precision_m: precisionM ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    return payload;
  }

  async sugerirUbicacionCentro(
    centroId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    precisionM?: number | null
  ): Promise<{ exito: boolean; mensaje: string; offline?: boolean }> {
    const isOnline = await connectivityService.isOnline();

    if (!isOnline) {
      await this.guardarSugerenciaOffline({
        tipo: 'centro',
        id: centroId,
        ubicacion_lat: ubicacionLat,
        ubicacion_lng: ubicacionLng,
        precision_m: precisionM ?? null,
        timestamp: new Date().toISOString(),
      });
      return { exito: true, mensaje: 'Sugerencia guardada. Se enviará cuando tengas conexión.', offline: true };
    }

    const { data, error } = await supabase.rpc('sugerir_ubicacion_centro', {
      p_centro_id: centroId,
      p_lat: ubicacionLat,
      p_lng: ubicacionLng,
      p_precision_m: precisionM ?? undefined,
    });

    if (error) {
      throw error;
    }

    const payload = ((data as any)?.[0] as { exito: boolean; mensaje: string } | undefined) ?? {
      exito: false,
      mensaje: 'Respuesta inválida al sugerir ubicación del centro',
    };

    return payload;
  }

  // Transporte: iniciar prestación (valida ORIGEN según sentido_transporte)
  async iniciarPrestacionTransporteConValidacion(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number
  ): Promise<ValidacionUbicacion> {
    const isOnline = await connectivityService.isOnline();
    if (!isOnline) {
      const validacionOffline = await this.validarUbicacionTransporteOffline(prestacionId, ubicacionLat, ubicacionLng, 'iniciar');
      if (validacionOffline.exito) {
        await this.guardarPrestacionOffline({
          prestacion_id: prestacionId,
          accion: 'transporte_iniciar',
          ubicacion_lat: ubicacionLat,
          ubicacion_lng: ubicacionLng,
          notas: '',
          timestamp: new Date().toISOString(),
          distancia_metros: validacionOffline.distancia_metros,
        });
        await this.actualizarCacheTransporte(prestacionId, 'iniciar');
      }
      return validacionOffline;
    }

    const { data, error } = await supabase.rpc('iniciar_prestacion_transporte', {
      prestacion_id: prestacionId,
      ubicacion_profesional: `POINT(${ubicacionLng} ${ubicacionLat})`,
      radio_permitido: 50,
    });

    if (error) {
      throw error;
    }

    const payload = data?.[0] as ValidacionUbicacion | undefined;
    if (!payload) {
      throw new Error('Respuesta inválida al iniciar prestación de transporte');
    }

    return payload;
  }

  // Transporte: finalizar prestación (valida DESTINO según sentido_transporte)
  async finalizarPrestacionTransporteConValidacion(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    notas?: string
  ): Promise<ValidacionUbicacion> {
    const isOnline = await connectivityService.isOnline();
    if (!isOnline) {
      const validacionOffline = await this.validarUbicacionTransporteOffline(prestacionId, ubicacionLat, ubicacionLng, 'finalizar');
      if (validacionOffline.exito) {
        await this.guardarPrestacionOffline({
          prestacion_id: prestacionId,
          accion: 'transporte_finalizar',
          ubicacion_lat: ubicacionLat,
          ubicacion_lng: ubicacionLng,
          notas: notas || '',
          timestamp: new Date().toISOString(),
          distancia_metros: validacionOffline.distancia_metros,
        });
        await this.actualizarCacheTransporte(prestacionId, 'finalizar', notas);
      }
      return validacionOffline;
    }

    const { data, error } = await supabase.rpc('finalizar_prestacion_transporte', {
      prestacion_id: prestacionId,
      ubicacion_profesional: `POINT(${ubicacionLng} ${ubicacionLat})`,
      notas_cierre: notas || undefined,
      radio_permitido: 50,
    });

    if (error) {
      throw error;
    }

    const payload = data?.[0] as ValidacionUbicacion | undefined;
    if (!payload) {
      throw new Error('Respuesta inválida al finalizar prestación de transporte');
    }

    return payload;
  }

  // Función auxiliar para obtener el rango de fechas del día usando moment.js
  private obtenerRangoFechaDelDia(fecha?: Date | string): { inicio: Date; fin: Date } {
    // Determinar si estamos en modo testing o producción
    const esModoTesting = process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_TESTING_MODE === 'true';

    let fechaBase: moment.Moment;

    if (esModoTesting) {
      // Para testing, usar 2024-10-22 en timezone de Argentina
      fechaBase = moment.tz('2024-10-22', this.TIMEZONE);
    } else {
      // Para producción, usar la fecha actual o la proporcionada
      if (fecha) {
        fechaBase = moment.tz(fecha, this.TIMEZONE);
      } else {
        fechaBase = moment.tz(this.TIMEZONE);
      }
    }

    // Obtener inicio y fin del día en timezone de Argentina
    const inicio = fechaBase.clone().startOf('day').toDate();
    const fin = fechaBase.clone().endOf('day').toDate();

    return { inicio, fin };
  }

  // Métodos de cache
  private async guardarEnCache(data: { pendientes: PrestacionCompleta[]; completadas: PrestacionCompleta[] }): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
      await AsyncStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log('✅ Cache actualizado');
    } catch (error) {
      console.error('Error guardando cache:', error);
    }
  }

  private async obtenerDeCache(): Promise<{ pendientes: PrestacionCompleta[]; completadas: PrestacionCompleta[] } | null> {
    try {
      const cachedData = await AsyncStorage.getItem(this.CACHE_KEY);
      const timestamp = await AsyncStorage.getItem(this.CACHE_TIMESTAMP_KEY);

      if (!cachedData || !timestamp) {
        return null;
      }

      // El cache no expira: los datos mensuales permanecen hasta actualizarse desde el servidor.
      const cacheAge = Date.now() - parseInt(timestamp);
      console.log(`📦 Usando cache local (última actualización hace ${Math.round(cacheAge / 60000)} min)`);
      return JSON.parse(cachedData);
    } catch (error) {
      console.error('Error leyendo cache:', error);
      return null;
    }
  }

  private async limpiarCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CACHE_KEY);
      await AsyncStorage.removeItem(this.CACHE_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error limpiando cache:', error);
    }
  }

  // Guarda en cache las prestaciones de un rango, fusionando con lo ya cacheado de otros días.
  // Las prestaciones cacheadas dentro del rango se reemplazan por los datos frescos;
  // las de otros días se conservan (poda entradas de más de 35 días).
  private async guardarEnCacheRango(
    data: { pendientes: PrestacionCompleta[]; completadas: PrestacionCompleta[] },
    inicioISO: string,
    finISO: string
  ): Promise<void> {
    try {
      const inicio = moment(inicioISO);
      const fin = moment(finISO);
      const limiteAntiguedad = moment().subtract(35, 'days');

      const cachePrevio = await this.obtenerDeCache();
      const fueraDelRango = (p: PrestacionCompleta) => {
        const fecha = moment(p.fecha);
        return (fecha.isBefore(inicio) || fecha.isAfter(fin)) && fecha.isAfter(limiteAntiguedad);
      };

      const idsNuevos = new Set(
        [...data.pendientes, ...data.completadas].map(p => p.prestacion_id)
      );

      const pendientesPrevias = (cachePrevio?.pendientes || []).filter(
        p => fueraDelRango(p) && !idsNuevos.has(p.prestacion_id)
      );
      const completadasPrevias = (cachePrevio?.completadas || []).filter(
        p => fueraDelRango(p) && !idsNuevos.has(p.prestacion_id)
      );

      await this.guardarEnCache({
        pendientes: [...data.pendientes, ...pendientesPrevias],
        completadas: [...data.completadas, ...completadasPrevias],
      });
    } catch (error) {
      console.error('Error guardando cache por rango:', error);
      // Fallback: guardar al menos los datos frescos
      await this.guardarEnCache(data);
    }
  }

  // Filtra los datos cacheados a un rango de fechas (para lecturas offline)
  private filtrarCachePorRango(
    cachedData: { pendientes: PrestacionCompleta[]; completadas: PrestacionCompleta[] },
    inicioISO: string,
    finISO: string
  ): { pendientes: PrestacionCompleta[]; completadas: PrestacionCompleta[] } {
    const inicio = moment(inicioISO);
    const fin = moment(finISO);
    const dentroDelRango = (p: PrestacionCompleta) => {
      const fecha = moment(p.fecha);
      return !fecha.isBefore(inicio) && !fecha.isAfter(fin);
    };
    return {
      pendientes: cachedData.pendientes.filter(dentroDelRango),
      completadas: cachedData.completadas.filter(dentroDelRango),
    };
  }

  // Verificar si el usuario ya completó una prestación hoy para este paciente
  async verificarLimiteCompletadasHoy(userId?: string, pacienteId?: string): Promise<{
    yaCompletoHoy: boolean;
    cantidadCompletadasHoy: number;
    detallePrestacion?: {
      tipo: string;
      hora: string;
      paciente: string;
    };
  }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener inicio y fin del día actual en Argentina
      const ahora = moment.tz(this.TIMEZONE);
      const inicioDelDiaArgentina = ahora.clone().startOf('day');
      const finDelDiaArgentina = ahora.clone().endOf('day');

      // Convertir a UTC para la consulta
      const inicioDelDiaUTC = inicioDelDiaArgentina.clone().utc().toISOString();
      const finDelDiaUTC = finDelDiaArgentina.clone().utc().toISOString();

      let query = supabase
        .from('prestaciones')
        .select('id, tipo_prestacion, completed_at, paciente_id, pacientes(nombre, apellido)', { count: 'exact' })
        .eq('user_id', currentUserId)
        .eq('estado', 'completada')
        .gte('completed_at', inicioDelDiaUTC)
        .lte('completed_at', finDelDiaUTC);

      // Si se proporciona pacienteId, filtrar por ese paciente
      if (pacienteId) {
        query = query.eq('paciente_id', pacienteId);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error verificando límite:', error);
        throw error;
      }

      const cantidadCompletadas = count || 0;
      let detallePrestacion;

      if (cantidadCompletadas > 0 && data && data.length > 0) {
        const prestacion = data[0];
        // @ts-ignore
        const pacienteNombre = prestacion.pacientes ? `${prestacion.pacientes.nombre} ${prestacion.pacientes.apellido}` : 'Paciente';

        detallePrestacion = {
          tipo: prestacion.tipo_prestacion,
          hora: this.formatearFecha(prestacion?.completed_at || '', 'HH:mm'),
          paciente: pacienteNombre
        };
      }

      return {
        yaCompletoHoy: cantidadCompletadas >= 1,
        cantidadCompletadasHoy: cantidadCompletadas,
        detallePrestacion
      };
    } catch (error) {
      console.error('Error verificando límite de completadas:', error);
      throw error;
    }
  }

  private async validarUbicacionTransporteOffline(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    accion: 'iniciar' | 'finalizar',
    radioPermitidoDefault: number = 50
  ): Promise<ValidacionUbicacion> {
    const cachedData = await this.obtenerDeCache();
    if (!cachedData) {
      throw new Error('No hay datos en cache para validar ubicación offline');
    }

    const prestacion = cachedData.pendientes.find(p => p.prestacion_id === prestacionId);
    if (!prestacion) {
      throw new Error('Prestación no encontrada en cache');
    }

    const sentido = String(prestacion.sentido_transporte || '').toLowerCase();
    const usarCentro = (accion === 'iniciar' && sentido === 'vuelta') || (accion === 'finalizar' && sentido === 'ida');

    const targetLat = usarCentro ? prestacion.centro_lat : prestacion.ubicacion_paciente_lat;
    const targetLng = usarCentro ? prestacion.centro_lng : prestacion.ubicacion_paciente_lng;
    if (typeof targetLat !== 'number' || typeof targetLng !== 'number') {
      throw new Error('Coordenadas inválidas para validar transporte offline');
    }

    const radioPermitido = usarCentro && typeof prestacion.centro_radio_metros === 'number'
      ? prestacion.centro_radio_metros
      : radioPermitidoDefault;

    const distancia = this.calcularDistancia(ubicacionLat, ubicacionLng, targetLat, targetLng);
    const dentroDelRango = distancia <= radioPermitido;

    return {
      exito: dentroDelRango,
      mensaje: dentroDelRango
        ? (accion === 'iniciar'
          ? 'Prestación iniciada offline - se sincronizará automáticamente'
          : 'Prestación finalizada offline - se sincronizará automáticamente')
        : `Estás muy lejos del lugar de la prestación. Distancia actual: ${Math.round(distancia)}m (máximo permitido: ${Math.round(radioPermitido)}m)`,
      distancia_metros: distancia,
      prestacion_actualizada: dentroDelRango ? {
        id: prestacionId,
        estado: accion === 'iniciar' ? 'en_proceso' : 'completada',
      } : undefined
    };
  }

  private async actualizarCacheTransporte(
    prestacionId: string,
    accion: 'iniciar' | 'finalizar',
    notas?: string
  ): Promise<void> {
    const cachedData = await this.obtenerDeCache();
    if (!cachedData) return;

    const pendientes = [...cachedData.pendientes];
    const completadas = [...cachedData.completadas];
    const idx = pendientes.findIndex(p => p.prestacion_id === prestacionId);
    if (idx === -1) return;

    const p = { ...pendientes[idx] };
    if (accion === 'iniciar') {
      p.estado = 'en_proceso';
      p.started_at = new Date().toISOString();
      pendientes[idx] = p;
    } else {
      p.estado = 'completada';
      p.completed_at = new Date().toISOString();
      if (typeof notas === 'string') {
        p.notas = notas;
      }
      pendientes.splice(idx, 1);
      completadas.unshift(p);
    }

    await this.guardarEnCache({ pendientes, completadas });
  }

  // Obtener prestaciones de la última semana (por defecto)
  async obtenerPrestacionesUltimaSemana(userId?: string, forceRefresh: boolean = false): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    const ahora = moment.tz(this.TIMEZONE);
    const hace7Dias = ahora.clone().subtract(7, 'days').startOf('day').toDate();
    const finHoy = ahora.clone().endOf('day').toDate();

    return this.obtenerPrestacionesPorRango(hace7Dias, finHoy, userId);
  }

  async obtenerViajesTransporteChoferPorRango(
    choferUserId: string,
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    const isOnline = await connectivityService.isOnline();
    if (!isOnline) {
      throw new Error('Sin conexión: el listado de viajes asignados requiere internet.');
    }

    const inicioArgentina = moment(fechaInicio).tz(this.TIMEZONE).startOf('day');
    const finArgentina = moment(fechaFin).tz(this.TIMEZONE).endOf('day');

    const inicioUTC = inicioArgentina.clone().utc().toISOString();
    const finUTC = finArgentina.clone().utc().toISOString();

    const { data: prestaciones, error } = await supabase.rpc('obtener_viajes_transporte_chofer', {
      p_chofer_id: choferUserId,
      p_fecha_inicio: inicioUTC,
      p_fecha_fin: finUTC,
    });

    if (error) throw error;

    const prestacionesCompletas: PrestacionCompleta[] = (prestaciones || []).map((p: any) => {
      return {
        prestacion_id: p.id,
        descripcion: p.descripcion || `${p.tipo_prestacion} - ${p.paciente_nombre} ${p.paciente_apellido}`,
        fecha: p.fecha,
        monto: p.monto,
        paciente_nombre: `${p.paciente_nombre} ${p.paciente_apellido}`,
        paciente_direccion: p.paciente_direccion_completa,
        paciente_telefono: p.paciente_telefono,
        ubicacion_paciente_lat: p.paciente_lat || 0,
        ubicacion_paciente_lng: p.paciente_lng || 0,
        paciente_tiene_ubicacion_sugerida: Boolean(p.paciente_tiene_ubicacion_sugerida),
        obra_social: p.obra_social_nombre || '',
        estado: p.estado,
        tipo_prestacion: p.tipo_prestacion,
        chofer_user_id: p.chofer_user_id ?? null,
        sentido_transporte: p.sentido_transporte || undefined,
        centro_id: p.centro_id || undefined,
        centro_nombre: p.centro_nombre || undefined,
        centro_direccion: p.centro_direccion_completa || undefined,
        centro_lat: typeof p.centro_lat === 'number' ? p.centro_lat : undefined,
        centro_lng: typeof p.centro_lng === 'number' ? p.centro_lng : undefined,
        centro_radio_metros: typeof p.centro_radio_metros === 'number' ? p.centro_radio_metros : undefined,
        centro_tiene_ubicacion_sugerida: Boolean(p.centro_tiene_ubicacion_sugerida),
        paciente_domicilio_lat: typeof p.paciente_domicilio_lat === 'number' ? p.paciente_domicilio_lat : undefined,
        paciente_domicilio_lng: typeof p.paciente_domicilio_lng === 'number' ? p.paciente_domicilio_lng : undefined,
        paciente_sugerida_lat: typeof p.paciente_sugerida_lat === 'number' ? p.paciente_sugerida_lat : undefined,
        paciente_sugerida_lng: typeof p.paciente_sugerida_lng === 'number' ? p.paciente_sugerida_lng : undefined,
        centro_domicilio_lat: typeof p.centro_domicilio_lat === 'number' ? p.centro_domicilio_lat : undefined,
        centro_domicilio_lng: typeof p.centro_domicilio_lng === 'number' ? p.centro_domicilio_lng : undefined,
        centro_sugerida_lat: typeof p.centro_sugerida_lat === 'number' ? p.centro_sugerida_lat : undefined,
        centro_sugerida_lng: typeof p.centro_sugerida_lng === 'number' ? p.centro_sugerida_lng : undefined,
        started_at: p.started_at || undefined,
        notas: p.notas || undefined,
        paciente_id: p.paciente_id,
      };
    });

    const pendientes = prestacionesCompletas.filter((p) => p.estado === 'pendiente' || p.estado === 'en_proceso');
    const completadas = prestacionesCompletas.filter((p) => p.estado === 'completada');

    return { pendientes, completadas, isFromCache: false, isOffline: false };
  }

  // Fusionar datos del servidor con cache local cuando hay acciones offline pendientes
  // Esto evita que un pull-to-refresh pise prestaciones que el usuario ya inició/cerró offline
  private async mergeConCacheSiAccionesPendientes(
    dbPendientes: PrestacionCompleta[],
    dbCompletadas: PrestacionCompleta[]
  ): Promise<{ pendientes: PrestacionCompleta[]; completadas: PrestacionCompleta[] }> {
    try {
      const offlineData = await AsyncStorage.getItem(this.OFFLINE_KEY);
      if (!offlineData) return { pendientes: dbPendientes, completadas: dbCompletadas };

      const lista: PrestacionOffline[] = JSON.parse(offlineData);
      const idsConAccionPendiente = new Set<string>();
      for (const accion of lista) {
        idsConAccionPendiente.add(accion.prestacion_id);
        if (accion.prestacion_ids) {
          for (const id of accion.prestacion_ids) idsConAccionPendiente.add(id);
        }
      }

      if (idsConAccionPendiente.size === 0) {
        return { pendientes: dbPendientes, completadas: dbCompletadas };
      }

      const cachedData = await this.obtenerDeCache();
      if (!cachedData) return { pendientes: dbPendientes, completadas: dbCompletadas };

      const findInCache = (id: string): PrestacionCompleta | undefined =>
        cachedData.pendientes.find(p => p.prestacion_id === id) ||
        cachedData.completadas.find(p => p.prestacion_id === id);

      const merge = (list: PrestacionCompleta[]) =>
        list.map(p => (idsConAccionPendiente.has(p.prestacion_id) ? findInCache(p.prestacion_id) || p : p));

      const mergedPendientes = merge(dbPendientes);
      const mergedCompletadas = merge(dbCompletadas);

      // Agregar del cache las prestaciones con acción pendiente que no vengan del servidor
      const dbIds = new Set([...dbPendientes, ...dbCompletadas].map(p => p.prestacion_id));
      const allCache = [...cachedData.pendientes, ...cachedData.completadas];
      for (const p of allCache) {
        if (idsConAccionPendiente.has(p.prestacion_id) && !dbIds.has(p.prestacion_id)) {
          if (p.estado === 'completada') {
            mergedCompletadas.push(p);
          } else {
            mergedPendientes.push(p);
          }
        }
      }

      return { pendientes: mergedPendientes, completadas: mergedCompletadas };
    } catch (error) {
      console.error('Error mergeando cache con acciones offline:', error);
      return { pendientes: dbPendientes, completadas: dbCompletadas };
    }
  }

  // Obtener prestaciones del día actual con sistema de cache inteligente
  async obtenerPrestacionesDelDia(userId?: string, forceRefresh: boolean = false): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    try {
      const isOnline = await connectivityService.isOnline();

      // Si no hay internet, usar cache (solo las prestaciones del día actual)
      if (!isOnline) {
        console.log('📡 Sin conexión - usando cache offline');
        const cachedData = await this.obtenerDeCache();
        if (cachedData) {
          const inicioHoy = moment.tz(this.TIMEZONE).startOf('day').utc().toISOString();
          const finHoy = moment.tz(this.TIMEZONE).endOf('day').utc().toISOString();
          const soloHoy = this.filtrarCachePorRango(cachedData, inicioHoy, finHoy);
          return { ...soloHoy, isFromCache: true, isOffline: true };
        } else {
          throw new Error('Sin conexión y sin datos en cache');
        }
      }

      // Si hay internet, SIEMPRE obtener datos frescos del servidor
      // Limpiar registros offline que ya están sincronizados (automático al tener conexión)
      await this.limpiarRegistrosYaSincronizados();

      // Obtener datos frescos del servidor
      console.log('🌐 Obteniendo datos frescos del servidor (conexión disponible)');

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener rango de fechas del día en hora Argentina
      const ahora = moment.tz(this.TIMEZONE);
      const inicioDelDiaArgentina = ahora.clone().startOf('day');
      const finDelDiaArgentina = ahora.clone().endOf('day');

      // Convertir a UTC para la consulta
      const inicioDelDiaUTC = inicioDelDiaArgentina.clone().utc().toISOString();
      const finDelDiaUTC = finDelDiaArgentina.clone().utc().toISOString();

      console.log(`📅 Consultando prestaciones del día:
        - Argentina: ${inicioDelDiaArgentina.format('YYYY-MM-DD HH:mm:ss')} a ${finDelDiaArgentina.format('YYYY-MM-DD HH:mm:ss')}
        - UTC: ${inicioDelDiaUTC} a ${finDelDiaUTC}`);

      // Query usando RPC para obtener coordenadas extraídas
      const { data: prestaciones, error } = await this.conTimeout(
        supabase.rpc('obtener_prestaciones_con_coordenadas_v2', {
          p_user_id: currentUserId,
          p_fecha_inicio: inicioDelDiaUTC,
          p_fecha_fin: finDelDiaUTC
        })
      );
      if (error) {
        console.log(error);
        throw error;
      }


      // Transformar datos a formato esperado por la aplicación
      const prestacionesCompletas: PrestacionCompleta[] = (prestaciones || []).map((p: any) => {
        return {
          prestacion_id: p.id,
          descripcion: p.descripcion || `${p.tipo_prestacion} - ${p.paciente_nombre} ${p.paciente_apellido}`,
          fecha: p.fecha,
          monto: p.monto,
          paciente_nombre: `${p.paciente_nombre} ${p.paciente_apellido}`,
          paciente_direccion: p.paciente_direccion_completa,
          paciente_telefono: p.paciente_telefono,
          ubicacion_paciente_lat: p.paciente_lat || 0,
          ubicacion_paciente_lng: p.paciente_lng || 0,
          paciente_tiene_ubicacion_sugerida: Boolean(p.paciente_tiene_ubicacion_sugerida),
          obra_social: p.obra_social_nombre || '',
          estado: p.estado,
          tipo_prestacion: p.tipo_prestacion,
          chofer_user_id: p.chofer_user_id ?? null,
          sentido_transporte: p.sentido_transporte || undefined,
          centro_id: p.centro_id || undefined,
          centro_nombre: p.centro_nombre || undefined,
          centro_direccion: p.centro_direccion_completa || undefined,
          centro_lat: typeof p.centro_lat === 'number' ? p.centro_lat : undefined,
          centro_lng: typeof p.centro_lng === 'number' ? p.centro_lng : undefined,
          centro_radio_metros: typeof p.centro_radio_metros === 'number' ? p.centro_radio_metros : undefined,
          centro_tiene_ubicacion_sugerida: Boolean(p.centro_tiene_ubicacion_sugerida),
          paciente_domicilio_lat: typeof p.paciente_domicilio_lat === 'number' ? p.paciente_domicilio_lat : undefined,
          paciente_domicilio_lng: typeof p.paciente_domicilio_lng === 'number' ? p.paciente_domicilio_lng : undefined,
          paciente_sugerida_lat: typeof p.paciente_sugerida_lat === 'number' ? p.paciente_sugerida_lat : undefined,
          paciente_sugerida_lng: typeof p.paciente_sugerida_lng === 'number' ? p.paciente_sugerida_lng : undefined,
          centro_domicilio_lat: typeof p.centro_domicilio_lat === 'number' ? p.centro_domicilio_lat : undefined,
          centro_domicilio_lng: typeof p.centro_domicilio_lng === 'number' ? p.centro_domicilio_lng : undefined,
          centro_sugerida_lat: typeof p.centro_sugerida_lat === 'number' ? p.centro_sugerida_lat : undefined,
          centro_sugerida_lng: typeof p.centro_sugerida_lng === 'number' ? p.centro_sugerida_lng : undefined,
          started_at: p.started_at || undefined,
          completed_at: p.completed_at || undefined,
          notas: p.notas || undefined,
          paciente_id: p.paciente_id
        };
      });

      const pendientes = prestacionesCompletas.filter(p => p.estado === 'pendiente' || p.estado === 'en_proceso');
      const completadas = prestacionesCompletas.filter(p => p.estado === 'completada');

      // Fusionar con cache cuando haya acciones offline pendientes
      const resultado = await this.mergeConCacheSiAccionesPendientes(pendientes, completadas);

      // Guardar en cache para uso offline (fusiona con otros días ya cacheados)
      await this.guardarEnCacheRango(resultado, inicioDelDiaUTC, finDelDiaUTC);

      return { ...resultado, isFromCache: false, isOffline: false };
    } catch (error) {
      console.error('Error obteniendo prestaciones:', error);

      // Si falla el request, intentar usar cache como fallback (solo el día actual)
      const cachedData = await this.obtenerDeCache();
      if (cachedData) {
        console.log('🔄 Usando cache como fallback después de error');
        const inicioHoy = moment.tz(this.TIMEZONE).startOf('day').utc().toISOString();
        const finHoy = moment.tz(this.TIMEZONE).endOf('day').utc().toISOString();
        const soloHoy = this.filtrarCachePorRango(cachedData, inicioHoy, finHoy);
        return { ...soloHoy, isFromCache: true, isOffline: true };
      }

      throw error;
    }
  }

  // Validar ubicación offline usando datos en cache (valida contra domicilio + sugerida)
  private async validarUbicacionOffline(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    radioPermitido: number = 50
  ): Promise<ValidacionUbicacion> {
    try {
      const cachedData = await this.obtenerDeCache();
      if (!cachedData) {
        throw new Error('No hay datos en cache para validar ubicación offline');
      }

      const prestacion = [...cachedData.pendientes, ...cachedData.completadas].find(p => p.prestacion_id === prestacionId);
      if (!prestacion) {
        throw new Error('Prestación no encontrada en cache');
      }

      const esAT = this.esTipoAT(prestacion.tipo_prestacion);
      const radioEfectivo = (prestacion.centro_id && prestacion.centro_radio_metros) || radioPermitido;

      const referencias = await this.obtenerReferenciasDomicilio(prestacionId, prestacion);

      if (referencias.length === 0) {
        if (esAT) {
          return {
            exito: true,
            mensaje: 'Prestación completada offline - se sincronizará automáticamente',
            distancia_metros: 0,
            prestacion_actualizada: { id: prestacionId, estado: 'completada', fecha_cierre: new Date().toISOString() }
          };
        }
        throw new Error('El paciente no tiene ubicación registrada ni sugerida');
      }

      const resultados = referencias.map(r => ({
        distancia: this.calcularDistancia(ubicacionLat, ubicacionLng, r.lat, r.lng),
        descripcion: r.descripcion
      }));
      const masCercana = resultados.reduce((min, r) => r.distancia < min.distancia ? r : min);
      const dentroDelRango = esAT || masCercana.distancia <= radioEfectivo;

      return {
        exito: dentroDelRango,
        mensaje: dentroDelRango
          ? 'Prestación completada offline - se sincronizará automáticamente'
          : `Estás muy lejos del ${masCercana.descripcion}. Distancia actual: ${Math.round(masCercana.distancia)}m (máximo permitido: ${radioEfectivo}m)`,
        distancia_metros: masCercana.distancia,
        prestacion_actualizada: dentroDelRango ? {
          id: prestacionId,
          estado: 'completada',
          fecha_cierre: new Date().toISOString()
        } : undefined
      };
    } catch (error) {
      console.error('Error validando ubicación offline:', error);
      throw error;
    }
  }

  // Validar ubicación y cerrar prestación
  async cerrarPrestacionConValidacion(
    prestacionId: string,
    ubicacionLat: number,
    ubicacionLng: number,
    notas?: string,
    pacienteId?: string,
    timestampCierreReal?: string
  ): Promise<ValidacionUbicacion> {
    try {
      const isOnline = await connectivityService.isOnline();

      // VALIDACIÓN: Verificar límite de 1 prestación por día POR PACIENTE
      if (isOnline) {
        let pacienteIdParaValidar = pacienteId || '';

        // Intentar obtener de cache si no se pasó (aunque idealmente actualizaremos la llamada)
        if (!pacienteIdParaValidar) {
          const cachedData = await this.obtenerDeCache();
          const prestacion = cachedData?.pendientes.find(p => p.prestacion_id === prestacionId);
          if (prestacion) {
            pacienteIdParaValidar = prestacion.paciente_id;
          }
        }

        if (pacienteIdParaValidar) {
          const limiteCheck = await this.verificarLimiteCompletadasHoy(undefined, pacienteIdParaValidar);
          if (limiteCheck.yaCompletoHoy) {
            const detalle = limiteCheck.detallePrestacion;
            const mensaje = detalle
              ? `Ya completaste una ${detalle.tipo} para ${detalle.paciente} hoy a las ${detalle.hora}. Podrás completar otra mañana.`
              : 'Ya completaste una prestación para este paciente hoy. Solo puedes completar 1 prestación por paciente por día.';

            return {
              exito: false,
              mensaje: mensaje,
              distancia_metros: 0
            };
          }
        }
      }

      // Si no hay conexión, validar offline
      if (!isOnline) {
        console.log('📱 Sin conexión - validando ubicación offline');

        // Validar ubicación usando datos en cache
        const validacionOffline = await this.validarUbicacionOffline(prestacionId, ubicacionLat, ubicacionLng);

        // Si pasa la validación offline, guardar para sincronizar después
        if (validacionOffline.exito) {
          await this.guardarPrestacionOffline({
            prestacion_id: prestacionId,
            ubicacion_lat: ubicacionLat,
            ubicacion_lng: ubicacionLng,
            notas: notas || '',
            timestamp: new Date().toISOString(),
            distancia_metros: validacionOffline.distancia_metros
          });
        }

        return validacionOffline;
      }

      // Si hay conexión, usar validación online normal

      // Llamar a la función de Supabase para validar y cerrar
      const deviceId = await deviceService.getDeviceId();
      const { data, error } = await supabase.rpc('cerrar_prestacion_con_validacion', {
        prestacion_id: prestacionId,
        ubicacion_profesional: `POINT(${ubicacionLng} ${ubicacionLat})`,
        notas_cierre: notas || undefined,
        p_device_id: deviceId ?? undefined,
        radio_permitido: 50,
        p_timestamp_cierre_real: timestampCierreReal || undefined
      });

      if (error) {
        throw error;
      }

      const resultado = data[0] as ValidacionUbicacion;
      return resultado;
    } catch (error) {
      console.error('Error cerrando prestación:', error);
      throw error;
    }
  }

  // Helpers para detectar tipo de prestación domiciliaria
  esTipoAT(tipo: string): boolean {
    const t = tipo.toLowerCase();
    return t.includes('acompañante') || t.includes('acompanante');
  }

  esTipoKinesiologo(tipo: string): boolean {
    const t = tipo.toLowerCase();
    return t.includes('kinesiol') || t.includes('kine');
  }

  // Obtiene las ubicaciones de referencia para validar inicio/cierre domiciliario:
  // Usa campos separados domicilio y sugerida (paciente o centro) + sugerencias offline pendientes.
  private async obtenerReferenciasDomicilio(
    prestacionId: string,
    prestacion: PrestacionCompleta | undefined
  ): Promise<Array<{ lat: number; lng: number; descripcion: string }>> {
    const referencias: Array<{ lat: number; lng: number; descripcion: string }> = [];

    if (!prestacion) return referencias;

    // Determinar si es prestación en centro
    const esCentro = prestacion.centro_id &&
      (typeof prestacion.centro_domicilio_lat === 'number' || typeof prestacion.centro_sugerida_lat === 'number' ||
       typeof prestacion.centro_lat === 'number');

    if (esCentro) {
      // 1. Ubicación oficial del centro
      if (typeof prestacion.centro_domicilio_lat === 'number' && typeof prestacion.centro_domicilio_lng === 'number') {
        referencias.push({
          lat: prestacion.centro_domicilio_lat,
          lng: prestacion.centro_domicilio_lng,
          descripcion: 'centro'
        });
      }

      // 2. Ubicación sugerida del centro
      if (typeof prestacion.centro_sugerida_lat === 'number' && typeof prestacion.centro_sugerida_lng === 'number') {
        referencias.push({
          lat: prestacion.centro_sugerida_lat,
          lng: prestacion.centro_sugerida_lng,
          descripcion: 'centro (sugerida)'
        });
      }

      // 3. Sugerencia offline pendiente para el centro
      const sugerencias = await this.obtenerSugerenciasOffline();
      const sugerencia = sugerencias.find(s => s.tipo === 'centro' && s.id === prestacion.centro_id);
      if (sugerencia) {
        referencias.push({
          lat: sugerencia.ubicacion_lat,
          lng: sugerencia.ubicacion_lng,
          descripcion: 'centro (sugerencia pendiente)'
        });
      }
    } else {
      // 1. Domicilio del paciente
      if (typeof prestacion.paciente_domicilio_lat === 'number' && typeof prestacion.paciente_domicilio_lng === 'number') {
        referencias.push({
          lat: prestacion.paciente_domicilio_lat,
          lng: prestacion.paciente_domicilio_lng,
          descripcion: 'domicilio'
        });
      }

      // 2. Ubicación sugerida del paciente
      if (typeof prestacion.paciente_sugerida_lat === 'number' && typeof prestacion.paciente_sugerida_lng === 'number') {
        referencias.push({
          lat: prestacion.paciente_sugerida_lat,
          lng: prestacion.paciente_sugerida_lng,
          descripcion: 'ubicación sugerida'
        });
      }

      // 3. Sugerencia offline pendiente para el paciente
      const sugerencias = await this.obtenerSugerenciasOffline();
      const sugerencia = sugerencias.find(s => s.tipo === 'paciente' && s.id === prestacionId);
      if (sugerencia) {
        referencias.push({
          lat: sugerencia.ubicacion_lat,
          lng: sugerencia.ubicacion_lng,
          descripcion: 'sugerencia pendiente'
        });
      }
    }

    return referencias;
  }

  // Iniciar prestación domiciliaria (AT o Kine) con validación de ubicación
  async iniciarPrestacionDomicilio(
    prestacionId: string,
    lat: number,
    lng: number,
    radioPermitido: number = 50
  ): Promise<ValidacionUbicacion> {
    try {
      const cachedData = await this.obtenerDeCache();
      const prestacion = cachedData?.pendientes.find(p => p.prestacion_id === prestacionId);

      const referencias = await this.obtenerReferenciasDomicilio(prestacionId, prestacion);

      if (referencias.length === 0) {
        return {
          exito: false,
          mensaje: 'El paciente no tiene ubicación registrada. Sugerí una ubicación antes de iniciar.',
          distancia_metros: 0
        };
      }

      const resultados = referencias.map(r => ({
        distancia: this.calcularDistancia(lat, lng, r.lat, r.lng),
        descripcion: r.descripcion
      }));

      const masCercana = resultados.reduce((min, r) => r.distancia < min.distancia ? r : min);

      if (masCercana.distancia > radioPermitido) {
        const detalles = resultados
          .map(r => `${Math.round(r.distancia)}m del ${r.descripcion}`)
          .join(' y ');
        return {
          exito: false,
          mensaje: `Estás a ${detalles}. Debés estar a menos de ${radioPermitido}m de alguna.`,
          distancia_metros: masCercana.distancia
        };
      }

      const distancia = masCercana.distancia;

      // Si es una prestación de centro/residencia, verificar que no haya una jornada activa
      if (prestacion?.centro_id) {
        const jornadaActiva = await jornadaService.obtenerJornadaActivaHoy(prestacion.centro_id);
        if (jornadaActiva) {
          return {
            exito: false,
            mensaje: `La prestación de ${prestacion.paciente_nombre} ya se inició en jornada. Completala desde Validar en Centro.`,
            distancia_metros: 0
          };
        }
      }

      const now = new Date().toISOString();
      const isOnline = await connectivityService.isOnline();

      // VALIDACIÓN: máximo 1 prestación activa/completada por paciente por día
      if (isOnline && prestacion?.paciente_id) {
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user?.id;

        if (currentUserId) {
          // Las domiciliarias son individuales: solo una en_proceso a la vez
          // (cualquier paciente, mismo o distinto). Se excluye Transporte (flujo separado).
          const { data: enProceso } = await supabase
            .from('prestaciones')
            .select('id, pacientes(nombre, apellido)')
            .eq('user_id', currentUserId)
            .eq('estado', 'en_proceso')
            .neq('id', prestacionId)
            .neq('tipo_prestacion', 'Transporte')
            .limit(1);

          if (enProceso && enProceso.length > 0) {
            const otra = enProceso[0] as any;
            const nombreOtra = otra.pacientes
              ? `${otra.pacientes.nombre} ${otra.pacientes.apellido}`
              : 'otro paciente';
            return {
              exito: false,
              mensaje: `Ya tenés una prestación en proceso para ${nombreOtra}. Cerrala antes de iniciar otra.`,
              distancia_metros: 0
            };
          }

          // ¿Ya completó una prestación hoy para este paciente?
          const limiteCheck = await this.verificarLimiteCompletadasHoy(currentUserId, prestacion.paciente_id);
          if (limiteCheck.yaCompletoHoy) {
            const detalle = limiteCheck.detallePrestacion;
            const mensaje = detalle
              ? `Ya completaste una ${detalle.tipo} para ${detalle.paciente} hoy a las ${detalle.hora}. Podrás completar otra mañana.`
              : `Ya completaste una prestación para ${prestacion.paciente_nombre} hoy. Solo se permite 1 por paciente por día.`;

            return {
              exito: false,
              mensaje,
              distancia_metros: 0
            };
          }
        }
      }

      if (!isOnline) {
        // Modo offline: guardar inicio para sincronizar después
        await this.guardarPrestacionOffline({
          prestacion_id: prestacionId,
          accion: 'iniciar_domicilio',
          ubicacion_lat: lat,
          ubicacion_lng: lng,
          notas: '',
          timestamp: now,
          distancia_metros: distancia,
        });
        // Guardar coords de inicio en AsyncStorage (para validación de cierre en Kine)
        await AsyncStorage.setItem(`inicio_coords_${prestacionId}`, JSON.stringify({ lat, lng, started_at: now }));
        // Actualizar cache
        await this.actualizarCacheTransporte(prestacionId, 'iniciar');
        return { exito: true, mensaje: 'Prestación iniciada sin conexión. Se sincronizará automáticamente.', distancia_metros: distancia };
      }

      // Actualizar en DB
      const { error } = await supabase
        .from('prestaciones')
        .update({ estado: 'en_proceso', started_at: now, updated_at: now })
        .eq('id', prestacionId);

      if (error) throw error;

      // Guardar coords de inicio en AsyncStorage (para validación de cierre en Kine)
      await AsyncStorage.setItem(`inicio_coords_${prestacionId}`, JSON.stringify({ lat, lng, started_at: now }));

      // Actualizar cache
      await this.actualizarCacheTransporte(prestacionId, 'iniciar');

      return { exito: true, mensaje: 'Prestación iniciada correctamente.', distancia_metros: distancia };
    } catch (error) {
      console.error('Error iniciando prestación domicilio:', error);
      return { exito: false, mensaje: 'No se pudo iniciar la prestación. Intentá nuevamente.', distancia_metros: 0 };
    }
  }

  // Cerrar prestación domiciliaria (AT: solo duración; Kine: duración + ubicación)
  async cerrarPrestacionDomicilio(
    prestacionId: string,
    lat: number,
    lng: number,
    tipoPrestacion: string,
    notas?: string,
    forzarCierre: boolean = false,
    motivoCierreAnticipado?: string
  ): Promise<ValidacionUbicacion> {
    try {
      const esKine = this.esTipoKinesiologo(tipoPrestacion);
      const minDuracion = esKine ? 30 : 40;

      // Obtener started_at desde cache o AsyncStorage
      const cachedData = await this.obtenerDeCache();
      const prestacion = cachedData?.pendientes.find(p => p.prestacion_id === prestacionId);
      const inicioRaw = await AsyncStorage.getItem(`inicio_coords_${prestacionId}`);
      const inicioDatos = inicioRaw ? JSON.parse(inicioRaw) : null;

      const startedAt = prestacion?.started_at || inicioDatos?.started_at;

      // Validar duración mínima (a menos que se fuerce el cierre)
      if (startedAt && !forzarCierre) {
        const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
        if (mins < minDuracion) {
          return {
            exito: false,
            mensaje: `DURACION_INSUFICIENTE|${mins}|${minDuracion}`,
            distancia_metros: 0
          };
        }
      }

      // Validar que el cierre esté cerca del domicilio o de la sugerencia (solo Kine).
      // Con forzarCierre se omite el chequeo pero se registra la distancia real para auditoría.
      let distanciaCierre: number | null = null;
      if (esKine) {
        const referenciasCierre = await this.obtenerReferenciasDomicilio(prestacionId, prestacion);
        if (referenciasCierre.length > 0) {
          const resultadosCierre = referenciasCierre.map(r => ({
            distancia: this.calcularDistancia(lat, lng, r.lat, r.lng),
            descripcion: r.descripcion
          }));
          const masCercanaCierre = resultadosCierre.reduce((min, r) => r.distancia < min.distancia ? r : min);
          distanciaCierre = masCercanaCierre.distancia;

          if (masCercanaCierre.distancia > 50 && !forzarCierre) {
            return {
              exito: false,
              mensaje: `FUERA_DE_RANGO|${Math.round(masCercanaCierre.distancia)}`,
              distancia_metros: masCercanaCierre.distancia
            };
          }
        }
      }

      const now = new Date().toISOString();
      const isOnline = await connectivityService.isOnline();

      // VALIDACIÓN: Verificar límite de 1 prestación por día POR PACIENTE (igual que cerrarPrestacionConValidacion)
      if (isOnline && prestacion?.paciente_id) {
        const limiteCheck = await this.verificarLimiteCompletadasHoy(undefined, prestacion.paciente_id);
        if (limiteCheck.yaCompletoHoy) {
          const detalle = limiteCheck.detallePrestacion;
          const mensaje = detalle
            ? `Ya completaste una ${detalle.tipo} para ${detalle.paciente} hoy a las ${detalle.hora}. Podrás completar otra mañana.`
            : 'Ya completaste una prestación para este paciente hoy. Solo puedes completar 1 prestación por paciente por día.';

          return {
            exito: false,
            mensaje: mensaje,
            distancia_metros: 0
          };
        }
      }

      // Construir notas finales
      let notasFinales = notas || '';
      if (forzarCierre && motivoCierreAnticipado) {
        const prefijo = distanciaCierre != null && distanciaCierre > 50
          ? '[CIERRE FUERA DE RANGO] '
          : '[CIERRE ANTICIPADO] ';
        notasFinales = notasFinales
          ? `${prefijo}${motivoCierreAnticipado} | ${notasFinales}`
          : `${prefijo}${motivoCierreAnticipado}`;
      }

      if (!isOnline) {
        // Guardar offline para sincronizar después
        await this.guardarPrestacionOffline({
          prestacion_id: prestacionId,
          accion: 'cerrar_domicilio',
          ubicacion_lat: lat,
          ubicacion_lng: lng,
          notas: notasFinales,
          timestamp: now,
          distancia_metros: distanciaCierre != null ? Math.round(distanciaCierre) : 0,
        });
        // Limpiar coords de inicio
        await AsyncStorage.removeItem(`inicio_coords_${prestacionId}`);
        // Actualizar cache local
        await this.actualizarCacheTransporte(prestacionId, 'finalizar', notasFinales || undefined);
        return { exito: true, mensaje: 'Prestación guardada sin conexión. Se sincronizará automáticamente.', distancia_metros: 0 };
      }

      // Actualizar en DB (siempre guardar ubicación de cierre)
      const { error } = await supabase
        .from('prestaciones')
        .update({
          estado: 'completada',
          completed_at: now,
          updated_at: now,
          ubicacion_cierre: `POINT(${lng} ${lat})`,
          ...(distanciaCierre != null && { distancia_validacion: Math.round(distanciaCierre) }),
          ...(notasFinales && { notas: notasFinales })
        })
        .eq('id', prestacionId);

      if (error) throw error;

      // Limpiar coords de inicio
      await AsyncStorage.removeItem(`inicio_coords_${prestacionId}`);

      // Actualizar cache
      await this.actualizarCacheTransporte(prestacionId, 'finalizar', notasFinales || undefined);

      return { exito: true, mensaje: 'Prestación completada correctamente.', distancia_metros: 0 };
    } catch (error) {
      console.error('Error cerrando prestación domicilio:', error);
      return { exito: false, mensaje: 'No se pudo completar la prestación. Intentá nuevamente.', distancia_metros: 0 };
    }
  }

  // Horas acumuladas del mes por paciente para el AT logueado
  async obtenerHorasAcumuladasMes(): Promise<Record<string, number>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      if (!currentUserId) throw new Error('Usuario no autenticado');
      const { data, error } = await supabase.rpc('obtener_horas_acumuladas_mes', { p_user_id: currentUserId });
      if (error) throw error;
      const resultado: Record<string, number> = {};
      for (const row of (data || [])) {
        resultado[row.paciente_id] = Math.round(Number(row.minutos));
      }
      return resultado;
    } catch (error) {
      console.error('Error obteniendo horas acumuladas:', error);
      return {};
    }
  }

  // Resetear estado de prestación (solo para desarrollo)
  async resetearEstadoPrestacion(prestacionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('prestaciones')
        .update({
          estado: 'pendiente',
          notas: null,
          ubicacion_cierre: null,
          distancia_validacion: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', prestacionId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error reseteando prestación:', error);
      throw error;
    }
  }

  // Guardar sugerencia en storage local (siempre, para que esté disponible al iniciar)
  private async guardarSugerenciaOffline(sugerencia: SugerenciaOffline): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(this.SUGGESTIONS_OFFLINE_KEY);
      const lista: SugerenciaOffline[] = raw ? JSON.parse(raw) : [];
      const index = lista.findIndex(s => s.tipo === sugerencia.tipo && s.id === sugerencia.id);
      if (index >= 0) {
        lista[index] = sugerencia;
      } else {
        lista.push(sugerencia);
      }
      await AsyncStorage.setItem(this.SUGGESTIONS_OFFLINE_KEY, JSON.stringify(lista));
    } catch (error) {
      console.error('Error guardando sugerencia offline:', error);
    }
  }

  async obtenerSugerenciasOffline(): Promise<SugerenciaOffline[]> {
    try {
      const raw = await AsyncStorage.getItem(this.SUGGESTIONS_OFFLINE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async sincronizarSugerenciasOffline(): Promise<number> {
    try {
      const lista = await this.obtenerSugerenciasOffline();
      if (lista.length === 0) return 0;

      const fallidas: SugerenciaOffline[] = [];
      let sincronizadas = 0;

      for (const s of lista) {
        try {
          let resultado: { exito: boolean };
          if (s.tipo === 'paciente') {
            resultado = await this.sugerirUbicacionDesdePrestacion(s.id, s.ubicacion_lat, s.ubicacion_lng, s.precision_m);
          } else {
            resultado = await this.sugerirUbicacionCentro(s.id, s.ubicacion_lat, s.ubicacion_lng, s.precision_m);
          }
          if (resultado.exito) {
            sincronizadas++;
          } else {
            fallidas.push(s);
          }
        } catch {
          fallidas.push(s);
        }
      }

      if (fallidas.length === 0) {
        await AsyncStorage.removeItem(this.SUGGESTIONS_OFFLINE_KEY);
      } else {
        await AsyncStorage.setItem(this.SUGGESTIONS_OFFLINE_KEY, JSON.stringify(fallidas));
      }

      return sincronizadas;
    } catch (error) {
      console.error('Error sincronizando sugerencias offline:', error);
      return 0;
    }
  }

  // Guardar prestación offline para sincronizar después
  private async guardarPrestacionOffline(prestacion: PrestacionOffline): Promise<void> {
    try {
      const prestacionesOffline = await AsyncStorage.getItem(this.OFFLINE_KEY);
      const lista = prestacionesOffline ? JSON.parse(prestacionesOffline) : [];

      if (!prestacion.accion) {
        prestacion.accion = 'cerrar';
      }

      // Evitar duplicados
      const existe = lista.find((p: PrestacionOffline) => p.prestacion_id === prestacion.prestacion_id);
      if (!existe) {
        lista.push(prestacion);
        await AsyncStorage.setItem(this.OFFLINE_KEY, JSON.stringify(lista));
      }
    } catch (error) {
      console.error('Error guardando prestación offline:', error);
    }
  }

  // Limpiar registros offline que ya están sincronizados (automático al conectarse)
  async limpiarRegistrosYaSincronizados(): Promise<number> {
    try {
      const isOnline = await connectivityService.isOnline();
      if (!isOnline) {
        return 0;
      }

      const prestacionesOffline = await this.obtenerPrestacionesOffline();
      if (prestacionesOffline.length === 0) {
        return 0;
      }

      console.log(`🔍 Verificando ${prestacionesOffline.length} prestaciones offline...`);

      // Verificar cuáles ya están completadas en el servidor
      const prestacionesIds = prestacionesOffline.map(p => p.prestacion_id);

      const { data: prestacionesCompletadas, error } = await supabase
        .from('prestaciones')
        .select('id')
        .in('id', prestacionesIds)
        .eq('estado', 'completada');

      if (error) {
        console.error('Error verificando prestaciones:', error);
        return 0;
      }

      const idsCompletadas = prestacionesCompletadas?.map(p => p.id) || [];

      if (idsCompletadas.length > 0) {
        // Filtrar las que NO están completadas (mantener solo las pendientes)
        const prestacionesPendientes = prestacionesOffline.filter(
          p => !idsCompletadas.includes(p.prestacion_id)
        );

        // Actualizar el storage con solo las pendientes
        if (prestacionesPendientes.length === 0) {
          await AsyncStorage.removeItem(this.OFFLINE_KEY);
        } else {
          await AsyncStorage.setItem(this.OFFLINE_KEY, JSON.stringify(prestacionesPendientes));
        }

        console.log(`🗑️ Limpiadas ${idsCompletadas.length} prestaciones ya sincronizadas`);
        return idsCompletadas.length;
      }

      return 0;
    } catch (error) {
      console.error('Error limpiando registros sincronizados:', error);
      return 0;
    }
  }

  // Sincronización completa (prestaciones offline + actualizar cache)
  async sincronizarTodo(): Promise<{ prestacionesSincronizadas: number; cacheActualizado: boolean }> {
    try {
      const isOnline = await connectivityService.isOnline();

      if (!isOnline) {
        console.log('📡 Sin conexión - no se puede sincronizar');
        return { prestacionesSincronizadas: 0, cacheActualizado: false };
      }

      console.log('🔄 Iniciando sincronización completa...');

      // 1. Limpiar registros ya sincronizados
      await this.limpiarRegistrosYaSincronizados();

      // 2. Sincronizar prestaciones offline restantes
      const prestacionesSincronizadas = await this.sincronizarPrestacionesOffline();

      // 3. Sincronizar sugerencias offline
      await this.sincronizarSugerenciasOffline();

      // 4. Actualizar cache con datos frescos
      const datosActualizados = await this.obtenerPrestacionesDelDia(undefined, true);

      console.log(`✅ Sincronización completa: ${prestacionesSincronizadas} prestaciones sincronizadas, cache actualizado`);

      return {
        prestacionesSincronizadas,
        cacheActualizado: true
      };
    } catch (error) {
      console.error('Error en sincronización completa:', error);
      return { prestacionesSincronizadas: 0, cacheActualizado: false };
    }
  }

  // Sincronizar prestaciones offline
  async sincronizarPrestacionesOffline(): Promise<number> {
    try {
      const prestacionesOffline = await AsyncStorage.getItem(this.OFFLINE_KEY);
      if (!prestacionesOffline) return 0;

      const lista: PrestacionOffline[] = JSON.parse(prestacionesOffline);
      const prestacionesFallidas: PrestacionOffline[] = [];
      let sincronizadas = 0;

      for (const prestacion of lista) {
        try {
          let resultado: ValidacionUbicacion;
          if (prestacion.accion === 'iniciar_domicilio') {
            const { data: updated, error: dbError } = await supabase
              .from('prestaciones')
              .update({
                estado: 'en_proceso',
                started_at: prestacion.timestamp,
                updated_at: new Date().toISOString()
              })
              .eq('id', prestacion.prestacion_id)
              .select('id');

            if (dbError) throw dbError;
            if (!updated || updated.length === 0) {
              throw new Error('No se pudo iniciar la prestación en el servidor (sin permisos o no existe)');
            }

            resultado = { exito: true, mensaje: '', distancia_metros: 0 };
          } else if (prestacion.accion === 'transporte_iniciar') {
            resultado = await this.iniciarPrestacionTransporteConValidacion(
              prestacion.prestacion_id,
              prestacion.ubicacion_lat,
              prestacion.ubicacion_lng
            );
          } else if (prestacion.accion === 'transporte_finalizar') {
            resultado = await this.finalizarPrestacionTransporteConValidacion(
              prestacion.prestacion_id,
              prestacion.ubicacion_lat,
              prestacion.ubicacion_lng,
              prestacion.notas
            );
          } else if (prestacion.accion === 'centro_validar') {
            const ids = prestacion.prestacion_ids || [prestacion.prestacion_id];
            const res = await this.validarPrestacionesCentro(
              ids,
              prestacion.ubicacion_lat,
              prestacion.ubicacion_lng
            );
            resultado = {
              exito: res.exito,
              mensaje: res.mensaje,
              distancia_metros: res.distancia_metros ?? 0,
            };
          } else if (prestacion.accion === 'cerrar_domicilio') {
            // Chequear estado actual antes de pisar: si el cron ya la auto-cerró,
            // solo se permite sobreescribir con el horario real si corresponde al mismo día ARG.
            const { data: actual, error: fetchError } = await supabase
              .from('prestaciones')
              .select('estado, auto_cerrada, fecha')
              .eq('id', prestacion.prestacion_id)
              .single();

            if (fetchError) throw fetchError;

            if (actual?.estado === 'completada' && actual.auto_cerrada) {
              const fechaCierreReal = moment.tz(prestacion.timestamp, this.TIMEZONE).format('YYYY-MM-DD');
              const fechaProgramada = moment.tz(actual.fecha, this.TIMEZONE).format('YYYY-MM-DD');

              if (fechaCierreReal !== fechaProgramada) {
                // El cierre real llegó en un día distinto: se mantiene el auto-cierre del cron
                resultado = { exito: true, mensaje: 'Prestación ya cerrada automáticamente', distancia_metros: 0 };
              } else {
                const { data: updated, error: dbError } = await supabase
                  .from('prestaciones')
                  .update({
                    estado: 'completada',
                    completed_at: prestacion.timestamp,
                    updated_at: new Date().toISOString(),
                    ubicacion_cierre: `POINT(${prestacion.ubicacion_lng} ${prestacion.ubicacion_lat})`,
                    auto_cerrada: false,
                    auto_cierre_motivo: null,
                    cierre_estado: 'manual',
                    ...(prestacion.distancia_metros > 0 && { distancia_validacion: prestacion.distancia_metros }),
                    ...(prestacion.notas && { notas: prestacion.notas })
                  })
                  .eq('id', prestacion.prestacion_id)
                  .select('id');

                if (dbError) throw dbError;
                if (!updated || updated.length === 0) {
                  throw new Error('No se pudo cerrar la prestación en el servidor (sin permisos o no existe)');
                }

                resultado = { exito: true, mensaje: '', distancia_metros: 0 };
              }
            } else if (actual?.estado === 'completada') {
              // Ya estaba completada manualmente por otro medio: no pisar
              resultado = { exito: true, mensaje: 'Prestación ya cerrada', distancia_metros: 0 };
            } else {
              const { data: updated, error: dbError } = await supabase
                .from('prestaciones')
                .update({
                  estado: 'completada',
                  completed_at: prestacion.timestamp,
                  updated_at: new Date().toISOString(),
                  ubicacion_cierre: `POINT(${prestacion.ubicacion_lng} ${prestacion.ubicacion_lat})`,
                  ...(prestacion.distancia_metros > 0 && { distancia_validacion: prestacion.distancia_metros }),
                  ...(prestacion.notas && { notas: prestacion.notas })
                })
                .eq('id', prestacion.prestacion_id)
                .select('id');

              if (dbError) throw dbError;
              if (!updated || updated.length === 0) {
                throw new Error('No se pudo cerrar la prestación en el servidor (sin permisos o no existe)');
              }

              resultado = { exito: true, mensaje: '', distancia_metros: 0 };
            }
          } else {
            resultado = await this.cerrarPrestacionConValidacion(
              prestacion.prestacion_id,
              prestacion.ubicacion_lat,
              prestacion.ubicacion_lng,
              prestacion.notas,
              undefined,
              prestacion.timestamp
            );
          }

          // Solo contar como sincronizada si fue exitosa
          if (resultado.exito) {
            sincronizadas++;
            console.log(`✅ Prestación ${prestacion.prestacion_id} sincronizada exitosamente`);
          } else {
            // Si falla validación, mantener en offline para revisión manual
            prestacionesFallidas.push(prestacion);
            console.log(`⚠️ Prestación ${prestacion.prestacion_id} falló validación: ${resultado.mensaje}`);
          }
        } catch (error) {
          // Si hay error de conexión, mantener en offline
          prestacionesFallidas.push(prestacion);
          console.error(`❌ Error sincronizando prestación ${prestacion.prestacion_id}:`, error);
        }
      }

      // Actualizar storage: solo mantener las que fallaron
      if (prestacionesFallidas.length === 0) {
        await AsyncStorage.removeItem(this.OFFLINE_KEY);
        console.log('🗑️ Todas las prestaciones offline sincronizadas - storage limpiado');
      } else {
        await AsyncStorage.setItem(this.OFFLINE_KEY, JSON.stringify(prestacionesFallidas));
        console.log(`📱 ${prestacionesFallidas.length} prestaciones permanecen offline`);
      }

      return sincronizadas;
    } catch (error) {
      console.error('Error sincronizando prestaciones offline:', error);
      return 0;
    }
  }

  // Obtener prestaciones offline pendientes
  async obtenerPrestacionesOffline(): Promise<PrestacionOffline[]> {
    try {
      const prestacionesOffline = await AsyncStorage.getItem(this.OFFLINE_KEY);
      return prestacionesOffline ? JSON.parse(prestacionesOffline) : [];
    } catch (error) {
      console.error('Error obteniendo prestaciones offline:', error);
      return [];
    }
  }

  // Extraer coordenadas de un campo PostGIS POINT (DEPRECATED - usar RPC)
  private extraerCoordenadas(ubicacionPostGIS: any): { lat: number; lng: number } {
    console.warn('⚠️ DEPRECATED: extraerCoordenadas() se está usando. Debería usar la función RPC obtener_prestaciones_con_coordenadas');

    try {
      if (!ubicacionPostGIS) {
        return { lat: 0, lng: 0 };
      }

      // Si es un objeto con coordinates (GeoJSON format)
      if (ubicacionPostGIS.coordinates && Array.isArray(ubicacionPostGIS.coordinates)) {
        return {
          lng: ubicacionPostGIS.coordinates[0],
          lat: ubicacionPostGIS.coordinates[1]
        };
      }

      // Si es un string WKT (Well-Known Text) como "POINT(-58.4002282 -34.6205978)"
      if (typeof ubicacionPostGIS === 'string' && ubicacionPostGIS.includes('POINT')) {
        const coords = ubicacionPostGIS.match(/POINT\(([^)]+)\)/);
        if (coords && coords[1]) {
          const [lng, lat] = coords[1].split(' ').map(Number);
          return { lat, lng };
        }
      }

      // Si es un objeto con propiedades lat/lng directas
      if (typeof ubicacionPostGIS === 'object' && ubicacionPostGIS.lat && ubicacionPostGIS.lng) {
        return {
          lat: Number(ubicacionPostGIS.lat),
          lng: Number(ubicacionPostGIS.lng)
        };
      }

      // Si es un objeto con type: "Point" (PostGIS JSON format)
      if (ubicacionPostGIS.type === 'Point' && ubicacionPostGIS.coordinates) {
        return {
          lng: ubicacionPostGIS.coordinates[0],
          lat: ubicacionPostGIS.coordinates[1]
        };
      }

      // Fallback - ya no debería llegar aquí con la nueva implementación
      console.warn('Formato de ubicación no reconocido (usando RPC debería evitar esto):', ubicacionPostGIS);
      return { lat: 0, lng: 0 };
    } catch (error) {
      console.error('Error extrayendo coordenadas:', error);
      return { lat: 0, lng: 0 };
    }
  }

  // Funciones auxiliares para manejo de fechas con moment.js
  formatearFecha(fecha: string | Date, formato: string = 'DD/MM/YYYY HH:mm'): string {
    return moment.tz(fecha, this.TIMEZONE).format(formato);
  }

  obtenerFechaActualArgentina(): moment.Moment {
    return moment.tz(this.TIMEZONE);
  }

  esFechaVencida(fecha: string | Date): boolean {
    const fechaMoment = moment.tz(fecha, this.TIMEZONE);
    const ahora = moment.tz(this.TIMEZONE);
    return fechaMoment.isBefore(ahora);
  }

  obtenerMinutosRestantes(fecha: string | Date): number {
    const fechaMoment = moment.tz(fecha, this.TIMEZONE);
    const ahora = moment.tz(this.TIMEZONE);
    return fechaMoment.diff(ahora, 'minutes');
  }

  // Calcular distancia entre dos puntos (Haversine formula)
  calcularDistancia(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distancia en metros
  }

  // Obtener prestaciones por rango de fechas personalizado
  async obtenerPrestacionesPorRango(
    fechaInicio: Date,
    fechaFin: Date,
    userId?: string
  ): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    // Convertir fechas de Argentina a UTC para la consulta y cache
    const inicioArgentina = moment(fechaInicio).tz(this.TIMEZONE).startOf('day');
    const finArgentina = moment(fechaFin).tz(this.TIMEZONE).endOf('day');
    const inicioUTC = inicioArgentina.clone().utc().toISOString();
    const finUTC = finArgentina.clone().utc().toISOString();

    try {
      const isOnline = await connectivityService.isOnline();

      // Si no hay internet, intentar usar cache filtrado al rango solicitado
      if (!isOnline) {
        const cachedData = await this.obtenerDeCache();
        if (cachedData) {
          console.log('📡 Sin conexión - usando cache filtrado al rango solicitado');
          const cacheRango = this.filtrarCachePorRango(cachedData, inicioUTC, finUTC);
          if (cacheRango.pendientes.length > 0 || cacheRango.completadas.length > 0) {
            return { ...cacheRango, isFromCache: true, isOffline: true };
          }
        }

        throw new Error('Sin conexión y el rango solicitado no está disponible offline');
      }

      // Si hay internet, obtener datos del servidor
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      console.log(`📅 Consultando prestaciones por rango:
        - Argentina: ${inicioArgentina.format('YYYY-MM-DD HH:mm:ss')} a ${finArgentina.format('YYYY-MM-DD HH:mm:ss')}
        - UTC: ${inicioUTC} a ${finUTC}`);

      // Query usando RPC para obtener coordenadas extraídas
      const { data: prestaciones, error } = await this.conTimeout(
        supabase.rpc('obtener_prestaciones_con_coordenadas_v2', {
          p_user_id: currentUserId,
          p_fecha_inicio: inicioUTC,
          p_fecha_fin: finUTC
        })
      );

      if (error) {
        console.log(error);
        throw error;
      }

      // Transformar datos a formato esperado por la aplicación
      const prestacionesCompletas: PrestacionCompleta[] = (prestaciones || []).map((p: any) => {
        return {
          prestacion_id: p.id,
          descripcion: p.descripcion || `${p.tipo_prestacion} - ${p.paciente_nombre} ${p.paciente_apellido}`,
          fecha: p.fecha,
          monto: p.monto,
          paciente_nombre: `${p.paciente_nombre} ${p.paciente_apellido}`,
          paciente_direccion: p.paciente_direccion_completa,
          paciente_telefono: p.paciente_telefono,
          ubicacion_paciente_lat: p.paciente_lat || 0,
          ubicacion_paciente_lng: p.paciente_lng || 0,
          paciente_tiene_ubicacion_sugerida: Boolean(p.paciente_tiene_ubicacion_sugerida),
          obra_social: p.obra_social_nombre || '',
          estado: p.estado,
          tipo_prestacion: p.tipo_prestacion,
          chofer_user_id: p.chofer_user_id ?? null,
          sentido_transporte: p.sentido_transporte || undefined,
          centro_id: p.centro_id || undefined,
          centro_nombre: p.centro_nombre || undefined,
          centro_direccion: p.centro_direccion_completa || undefined,
          centro_lat: typeof p.centro_lat === 'number' ? p.centro_lat : undefined,
          centro_lng: typeof p.centro_lng === 'number' ? p.centro_lng : undefined,
          centro_radio_metros: typeof p.centro_radio_metros === 'number' ? p.centro_radio_metros : undefined,
          centro_tiene_ubicacion_sugerida: Boolean(p.centro_tiene_ubicacion_sugerida),
          paciente_domicilio_lat: typeof p.paciente_domicilio_lat === 'number' ? p.paciente_domicilio_lat : undefined,
          paciente_domicilio_lng: typeof p.paciente_domicilio_lng === 'number' ? p.paciente_domicilio_lng : undefined,
          paciente_sugerida_lat: typeof p.paciente_sugerida_lat === 'number' ? p.paciente_sugerida_lat : undefined,
          paciente_sugerida_lng: typeof p.paciente_sugerida_lng === 'number' ? p.paciente_sugerida_lng : undefined,
          centro_domicilio_lat: typeof p.centro_domicilio_lat === 'number' ? p.centro_domicilio_lat : undefined,
          centro_domicilio_lng: typeof p.centro_domicilio_lng === 'number' ? p.centro_domicilio_lng : undefined,
          centro_sugerida_lat: typeof p.centro_sugerida_lat === 'number' ? p.centro_sugerida_lat : undefined,
          centro_sugerida_lng: typeof p.centro_sugerida_lng === 'number' ? p.centro_sugerida_lng : undefined,
          started_at: p.started_at || undefined,
          completed_at: p.completed_at || undefined,
          notas: p.notas || undefined,
          paciente_id: p.paciente_id
        };
      });

      const pendientes = prestacionesCompletas.filter(p => p.estado === 'pendiente' || p.estado === 'en_proceso');
      const completadas = prestacionesCompletas.filter(p => p.estado === 'completada');

      // Fusionar con cache cuando haya acciones offline pendientes
      const resultado = await this.mergeConCacheSiAccionesPendientes(pendientes, completadas);

      // Guardar en cache el rango consultado (fusionando con otros días cacheados)
      await this.guardarEnCacheRango(resultado, inicioUTC, finUTC);
      console.log('💾 Cache del rango actualizado durante consulta de rango');

      return { ...resultado, isFromCache: false, isOffline: false };
    } catch (error) {
      console.error('Error obteniendo prestaciones por rango:', error);

      // Si falla el request, intentar usar cache como fallback filtrado al rango
      const cachedData = await this.obtenerDeCache();
      if (cachedData) {
        console.log('🔄 Usando cache como fallback después de error en rango');
        const cacheRango = this.filtrarCachePorRango(cachedData, inicioUTC, finUTC);
        if (cacheRango.pendientes.length > 0 || cacheRango.completadas.length > 0) {
          return { ...cacheRango, isFromCache: true, isOffline: true };
        }
      }

      throw error;
    }
  }

  // Obtener prestaciones del mes actual
  async obtenerPrestacionesDelMes(userId?: string): Promise<{
    pendientes: PrestacionCompleta[];
    completadas: PrestacionCompleta[];
    isFromCache: boolean;
    isOffline: boolean;
  }> {
    const inicioMes = moment.tz(this.TIMEZONE).startOf('month').toDate();
    const finMes = moment.tz(this.TIMEZONE).endOf('month').toDate();

    return this.obtenerPrestacionesPorRango(inicioMes, finMes, userId);
  }

  // ==================== VALIDACIÓN GRUPAL EN CENTROS ====================

  // Obtener prestaciones pendientes de un centro para el usuario actual
  async obtenerPrestacionesPendientesCentro(centroId: string): Promise<{
    prestaciones: Array<{
      prestacion_id: string;
      paciente_id: string;
      paciente_nombre: string;
      paciente_apellido: string;
      fecha: string;
      estado: string;
      tipo_prestacion: string;
      started_at?: string | null;
    }>;
    error?: string;
  }> {
    try {
      const isOnline = await connectivityService.isOnline();

      if (!isOnline) {
        // Fallback offline: usar datos cacheados de obtenerPrestacionesDelDia
        const cached = await this.obtenerDeCache();
        if (cached) {
          const prestacionesCentro = cached.pendientes
            .filter(p => p.centro_id === centroId && p.tipo_prestacion !== 'Transporte')
            .map(p => {
              const partes = (p.paciente_nombre || '').split(' ');
              const nombre = partes[0] || '';
              const apellido = partes.slice(1).join(' ') || '';
              return {
                prestacion_id: p.prestacion_id,
                paciente_id: p.paciente_id,
                paciente_nombre: nombre,
                paciente_apellido: apellido,
                fecha: p.fecha,
                estado: p.estado,
                tipo_prestacion: p.tipo_prestacion,
                started_at: p.started_at || null,
              };
            });
          return { prestaciones: prestacionesCentro };
        }
        return { prestaciones: [], error: 'Sin conexión y sin datos en cache' };
      }

      const { data, error } = await this.conTimeout(
        supabase.rpc('obtener_prestaciones_pendientes_centro', {
          p_centro_id: centroId
        })
      );

      if (error) {
        console.error('Error obteniendo prestaciones del centro:', error);
        return { prestaciones: [], error: error.message };
      }

      const startedAtMap = new Map<string, string | null>();
      if (data && data.length > 0) {
        const ids = (data || []).map((p: any) => p.prestacion_id);
        const { data: startedData, error: startedError } = await (supabase as any)
          .from('prestaciones')
          .select('id, started_at')
          .in('id', ids);
        if (startedError) {
          console.error('Error obteniendo started_at:', startedError);
        } else {
          (startedData || []).forEach((row: any) => {
            startedAtMap.set(row.id, row.started_at || null);
          });
        }
      }

      const prestacionesConStartedAt = (data || []).map((p: any) => ({
        ...p,
        started_at: startedAtMap.get(p.prestacion_id) || p.started_at || null,
      }));

      return { prestaciones: prestacionesConStartedAt };
    } catch (error: any) {
      console.error('Error obteniendo prestaciones del centro:', error);
      return { prestaciones: [], error: error?.message || 'Error desconocido' };
    }
  }

  // Validar múltiples prestaciones de un centro con una sola geolocalización
  async validarPrestacionesCentro(
    prestacionIds: string[],
    ubicacionLat: number,
    ubicacionLng: number,
    radioPermitidoMetros: number = 100
  ): Promise<{
    exito: boolean;
    mensaje: string;
    prestaciones_validadas?: number;
    distancia_metros?: number;
    centro_id?: string;
  }> {
    try {
      const isOnline = await connectivityService.isOnline();

      if (!isOnline) {
        const timestamp = new Date().toISOString();
        await this.guardarPrestacionOffline({
          prestacion_id: prestacionIds[0],
          prestacion_ids: prestacionIds,
          accion: 'centro_validar',
          ubicacion_lat: ubicacionLat,
          ubicacion_lng: ubicacionLng,
          notas: '',
          timestamp,
          distancia_metros: 0,
        });
        for (const id of prestacionIds) {
          await this.actualizarCacheTransporte(id, 'finalizar');
        }
        return {
          exito: true,
          mensaje: `${prestacionIds.length} prestación(es) guardada(s) sin conexión. Se sincronizarán automáticamente cuando haya internet.`,
          prestaciones_validadas: prestacionIds.length,
        };
      }

      console.log('📍 Validando prestaciones centro con:', {
        prestacionIds,
        ubicacionLat,
        ubicacionLng,
        radioPermitidoMetros
      });

      const deviceId = await deviceService.getDeviceId();
      const { data, error } = await supabase.rpc('validar_prestaciones_centro', {
        p_prestacion_ids: prestacionIds,
        p_ubicacion_lat: ubicacionLat,
        p_ubicacion_lng: ubicacionLng,
        p_device_id: deviceId,
        p_radio_permitido_metros: radioPermitidoMetros
      });

      console.log('📍 Resultado validación centro:', data);

      if (error) {
        console.error('Error validando prestaciones del centro:', error);
        return {
          exito: false,
          mensaje: error.message || 'Error al validar prestaciones'
        };
      }

      const resultado = data as {
        exito: boolean;
        mensaje: string;
        detalle?: any;
        prestaciones_validadas?: number;
        distancia_metros?: number;
        centro_id?: string;
      } | null;

      // Actualizar cache después de validación exitosa
      if (resultado?.exito) {
        await this.obtenerPrestacionesDelDia(undefined, true);
      }

      return resultado ?? { exito: false, mensaje: 'Respuesta inválida del servidor' };
    } catch (error: any) {
      console.error('Error validando prestaciones del centro:', error);
      return {
        exito: false,
        mensaje: error?.message || 'Error desconocido'
      };
    }
  }

  // Obtener centros con prestaciones pendientes en el rango permitido para validación grupal
  async obtenerCentrosConPrestacionesPendientes(): Promise<Array<{
    centro_id: string;
    centro_nombre: string;
    prestaciones_pendientes: number;
  }>> {
    try {
      const ahora = moment.tz(this.TIMEZONE);
      const inicioRango = ahora.clone().subtract(6, 'days').startOf('day').toDate();
      const finHoy = ahora.clone().endOf('day').toDate();
      const { pendientes } = await this.obtenerPrestacionesPorRango(inicioRango, finHoy);

      // Agrupar por centro
      const centrosMap = new Map<string, { nombre: string; count: number }>();

      for (const p of pendientes) {
        if (
          p.centro_id &&
          p.centro_nombre &&
          p.tipo_prestacion !== 'Transporte' &&
          (p.estado === 'pendiente' || p.estado === 'en_proceso')
        ) {
          const existing = centrosMap.get(p.centro_id);
          if (existing) {
            existing.count++;
          } else {
            centrosMap.set(p.centro_id, { nombre: p.centro_nombre, count: 1 });
          }
        }
      }

      return Array.from(centrosMap.entries()).map(([id, { nombre, count }]) => ({
        centro_id: id,
        centro_nombre: nombre,
        prestaciones_pendientes: count
      }));
    } catch (error) {
      console.error('Error obteniendo centros con prestaciones:', error);
      return [];
    }
  }

  // ==================== FIN VALIDACIÓN GRUPAL ====================

  // Obtener prestaciones pendientes del día anterior (programadas para ayer pero no completadas)
  // Nota: Estas prestaciones aún pueden completarse ya que tienen hasta 1 semana desde la fecha programada
  async obtenerPrestacionesPerdidasAyer(userId?: string): Promise<PrestacionCompleta[]> {
    try {
      const isOnline = await connectivityService.isOnline();
      
      // Solo funciona online, no hay cache para esto
      if (!isOnline) {
        return [];
      }

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;

      if (!currentUserId) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener rango de fechas del día anterior en hora Argentina
      const ahora = moment.tz(this.TIMEZONE);
      const ayer = ahora.clone().subtract(1, 'day');
      const inicioAyerArgentina = ayer.clone().startOf('day');
      const finAyerArgentina = ayer.clone().endOf('day');

      // Convertir a UTC para la consulta
      const inicioAyerUTC = inicioAyerArgentina.clone().utc().toISOString();
      const finAyerUTC = finAyerArgentina.clone().utc().toISOString();

      console.log(`📅 Consultando prestaciones pendientes de ayer:
        - Argentina: ${inicioAyerArgentina.format('YYYY-MM-DD HH:mm:ss')} a ${finAyerArgentina.format('YYYY-MM-DD HH:mm:ss')}
        - UTC: ${inicioAyerUTC} a ${finAyerUTC}`);

      // Query usando RPC para obtener coordenadas extraídas
      const { data: prestaciones, error } = await this.conTimeout(
        supabase.rpc('obtener_prestaciones_con_coordenadas_v2', {
          p_user_id: currentUserId,
          p_fecha_inicio: inicioAyerUTC,
          p_fecha_fin: finAyerUTC
        })
      );

      if (error) {
        console.error('Error obteniendo prestaciones pendientes de ayer:', error);
        throw error;
      }

      // Transformar datos y filtrar solo las pendientes (programadas para ayer pero no completadas)
      // Estas prestaciones aún pueden completarse (tienen hasta 1 semana desde la fecha programada)
      const prestacionesPerdidas: PrestacionCompleta[] = (prestaciones || [])
        .filter((p: any) => p.estado === 'pendiente') // Solo las que siguen pendientes
        .map((p: any) => {
          return {
            prestacion_id: p.id,
            descripcion: p.descripcion || `${p.tipo_prestacion} - ${p.paciente_nombre} ${p.paciente_apellido}`,
            fecha: p.fecha,
            monto: p.monto,
            paciente_nombre: `${p.paciente_nombre} ${p.paciente_apellido}`,
            paciente_direccion: p.paciente_direccion_completa,
            paciente_telefono: p.paciente_telefono,
            ubicacion_paciente_lat: p.paciente_lat || 0,
            ubicacion_paciente_lng: p.paciente_lng || 0,
            paciente_tiene_ubicacion_sugerida: Boolean(p.paciente_tiene_ubicacion_sugerida),
            obra_social: p.obra_social_nombre || '',
            estado: p.estado,
            tipo_prestacion: p.tipo_prestacion,
            notas: p.notas || undefined,
            paciente_id: p.paciente_id
          };
        });

      return prestacionesPerdidas;
    } catch (error) {
      console.error('Error obteniendo prestaciones pendientes de ayer:', error);
      return [];
    }
  }
}

export const prestacionService = new PrestacionService();

// Tipos derivados usando Awaited<ReturnType<>>
export type ObtenerPrestacionesResult = Awaited<ReturnType<typeof prestacionService.obtenerPrestacionesDelDia>>;
export type ObtenerPrestacionesRangoResult = Awaited<ReturnType<typeof prestacionService.obtenerPrestacionesPorRango>>;
export type ObtenerPrestacionesMesResult = Awaited<ReturnType<typeof prestacionService.obtenerPrestacionesDelMes>>;
export type ValidacionUbicacionResult = Awaited<ReturnType<typeof prestacionService.cerrarPrestacionConValidacion>>;
export type PrestacionesOfflineResult = Awaited<ReturnType<typeof prestacionService.obtenerPrestacionesOffline>>;
export type SincronizacionResult = Awaited<ReturnType<typeof prestacionService.sincronizarPrestacionesOffline>>;
export type SincronizacionCompletaResult = Awaited<ReturnType<typeof prestacionService.sincronizarTodo>>;