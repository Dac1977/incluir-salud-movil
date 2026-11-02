import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment-timezone';
import { supabase } from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

export type JornadaResidencia = {
  id: string;
  user_id: string;
  centro_id: string;
  fecha: string;
  entrada_at: string;
  salida_at: string | null;
  estado: 'iniciada' | 'completada';
  ubicacion_entrada_lat: number | null;
  ubicacion_entrada_lng: number | null;
  created_at: string;
  updated_at: string;
};

type JornadaOffline = {
  id: string;
  centro_id: string;
  fecha: string;
  accion: 'iniciar' | 'finalizar';
  entrada_at?: string;
  salida_at?: string;
  ubicacion_lat?: number;
  ubicacion_lng?: number;
};

class JornadaService {
  private readonly OFFLINE_KEY = 'jornadas_offline';
  private readonly ACTIVA_KEY = 'jornada_activa_cache';

  private hoyAR(): string {
    return moment().tz(TIMEZONE).format('YYYY-MM-DD');
  }

  private async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable);
  }

  private async guardarOffline(item: JornadaOffline): Promise<void> {
    const raw = await AsyncStorage.getItem(this.OFFLINE_KEY);
    const lista: JornadaOffline[] = raw ? JSON.parse(raw) : [];
    lista.push(item);
    await AsyncStorage.setItem(this.OFFLINE_KEY, JSON.stringify(lista));
  }

  private async obtenerJornadaOfflinePendiente(centroId: string): Promise<JornadaResidencia | null> {
    try {
      const raw = await AsyncStorage.getItem(this.OFFLINE_KEY);
      if (!raw) return null;

      const lista: JornadaOffline[] = JSON.parse(raw);
      const hoy = this.hoyAR();

      // Buscar un 'iniciar' de hoy para este centro que no tenga 'finalizar' correspondiente
      const inicio = lista.find(
        item => item.accion === 'iniciar' && item.centro_id === centroId && item.fecha === hoy
      );
      if (!inicio) return null;

      const finalizado = lista.find(
        item => item.accion === 'finalizar' && item.id === inicio.id
      );
      if (finalizado) return null;

      const now = new Date().toISOString();
      return {
        id: inicio.id,
        user_id: '',
        centro_id: inicio.centro_id,
        fecha: inicio.fecha,
        entrada_at: inicio.entrada_at ?? now,
        salida_at: null,
        estado: 'iniciada',
        ubicacion_entrada_lat: inicio.ubicacion_lat ?? null,
        ubicacion_entrada_lng: inicio.ubicacion_lng ?? null,
        created_at: inicio.entrada_at ?? now,
        updated_at: inicio.entrada_at ?? now,
      };
    } catch {
      return null;
    }
  }

  private async guardarJornadaActiva(jornada: JornadaResidencia): Promise<void> {
    try {
      await AsyncStorage.setItem(this.ACTIVA_KEY, JSON.stringify(jornada));
    } catch {
      // No crítico
    }
  }

  private async obtenerJornadaActiva(centroId: string): Promise<JornadaResidencia | null> {
    try {
      const raw = await AsyncStorage.getItem(this.ACTIVA_KEY);
      if (!raw) return null;
      const jornada: JornadaResidencia = JSON.parse(raw);
      if (jornada.centro_id === centroId && jornada.fecha === this.hoyAR() && jornada.estado === 'iniciada') {
        return jornada;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async limpiarJornadaActiva(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.ACTIVA_KEY);
    } catch {
      // No crítico
    }
  }

  async obtenerJornadaActivaHoy(centroId: string): Promise<JornadaResidencia | null> {
    // 1) Jornada offline aún no sincronizada
    const jornadaOffline = await this.obtenerJornadaOfflinePendiente(centroId);
    if (jornadaOffline) return jornadaOffline;

    // 2) Si hay internet, traer del servidor y persistir en cache
    const isOnline = await this.isOnline();
    if (isOnline) {
      let userId: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id ?? null;
      } catch {
        userId = null;
      }

      if (userId) {
        try {
          const { data, error } = await supabase
            .from('jornadas_residencia')
            .select('*')
            .eq('user_id', userId)
            .eq('centro_id', centroId)
            .eq('fecha', this.hoyAR())
            .eq('estado', 'iniciada')
            .order('entrada_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) throw error;
          if (data) await this.guardarJornadaActiva(data as JornadaResidencia);
          return data as JornadaResidencia;
        } catch {
          // Si falla el server, caer al cache
        }
      }
    }

    // 3) Fallback offline: cache de la última jornada activa online
    return this.obtenerJornadaActiva(centroId);
  }

  async iniciarJornada(
    centroId: string,
    lat: number,
    lng: number
  ): Promise<{ exito: boolean; mensaje: string; jornada?: JornadaResidencia; offline?: boolean }> {
    try {
      // Verificar que no haya una jornada ya iniciada hoy
      const activa = await this.obtenerJornadaActivaHoy(centroId);
      if (activa) {
        return { exito: false, mensaje: 'Ya tenés una jornada iniciada en este centro hoy.' };
      }

      const now = new Date().toISOString();
      const online = await this.isOnline();

      // Obtener user_id para el insert
      let userId: string | undefined;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      } catch { /* se usará el default auth.uid() en la DB */ }
      if (!userId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          userId = session?.user?.id;
        } catch { /* se dejará sin user_id */ }
      }

      if (!online) {
        const idOffline = `offline_${Date.now()}`;
        await this.guardarOffline({
          id: idOffline,
          centro_id: centroId,
          fecha: this.hoyAR(),
          accion: 'iniciar',
          entrada_at: now,
          ubicacion_lat: lat,
          ubicacion_lng: lng,
        });
        const jornadaLocal: JornadaResidencia = {
          id: idOffline,
          user_id: '',
          centro_id: centroId,
          fecha: this.hoyAR(),
          entrada_at: now,
          salida_at: null,
          estado: 'iniciada',
          ubicacion_entrada_lat: lat,
          ubicacion_entrada_lng: lng,
          created_at: now,
          updated_at: now,
        };
        return { exito: true, mensaje: 'Jornada iniciada sin conexión. Se sincronizará automáticamente.', jornada: jornadaLocal, offline: true };
      }

      const { data, error } = await supabase
        .from('jornadas_residencia')
        .insert({
          ...(userId && { user_id: userId }),
          centro_id: centroId,
          fecha: this.hoyAR(),
          entrada_at: now,
          estado: 'iniciada',
          ubicacion_entrada_lat: lat,
          ubicacion_entrada_lng: lng,
        })
        .select()
        .single();

      if (error) throw error;

      await this.guardarJornadaActiva(data as JornadaResidencia);

      return { exito: true, mensaje: 'Jornada iniciada correctamente.', jornada: data as JornadaResidencia };
    } catch (error) {
      console.error('Error iniciando jornada:', error);
      return { exito: false, mensaje: 'No se pudo iniciar la jornada. Intentá nuevamente.' };
    }
  }

  async finalizarJornada(
    jornadaId: string,
    entrada_at?: string
  ): Promise<{ exito: boolean; mensaje: string; jornada?: JornadaResidencia }> {
    try {
      const now = new Date().toISOString();
      const online = await this.isOnline();
      const esOffline = jornadaId.startsWith('offline_');

      if (!online || esOffline) {
        await this.guardarOffline({
          id: jornadaId,
          centro_id: '',
          fecha: this.hoyAR(),
          accion: 'finalizar',
          entrada_at,
          salida_at: now,
        });
        const duracion = entrada_at
          ? moment(now).diff(moment(entrada_at), 'minutes')
          : 0;
        return {
          exito: true,
          mensaje: `Jornada finalizada sin conexión. Duración: ${this.formatearDuracion(duracion)}. Se sincronizará automáticamente.`,
        };
      }

      const { data, error } = await supabase
        .from('jornadas_residencia')
        .update({ salida_at: now, estado: 'completada', updated_at: now })
        .eq('id', jornadaId)
        .select()
        .single();

      if (error) throw error;

      await this.limpiarJornadaActiva();

      const duracion = moment(data.salida_at).diff(moment(data.entrada_at), 'minutes');

      return {
        exito: true,
        mensaje: `Jornada finalizada. Duración: ${this.formatearDuracion(duracion)}.`,
        jornada: data as JornadaResidencia,
      };
    } catch (error) {
      console.error('Error finalizando jornada:', error);
      return { exito: false, mensaje: 'No se pudo finalizar la jornada. Intentá nuevamente.' };
    }
  }

  async sincronizarJornadasOffline(): Promise<number> {
    try {
      const online = await this.isOnline();
      if (!online) return 0;

      const raw = await AsyncStorage.getItem(this.OFFLINE_KEY);
      if (!raw) return 0;

      const lista: JornadaOffline[] = JSON.parse(raw);
      const fallidas: JornadaOffline[] = [];
      let sincronizadas = 0;
      let jornadaDbId: string | null = null;

      let userId: string | undefined;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      } catch { /* offline: se sincronizará sin user_id */ }

      for (const item of lista) {
        try {
          if (item.accion === 'iniciar') {
            const { data, error } = await supabase
              .from('jornadas_residencia')
              .insert({
                ...(userId && { user_id: userId }),
                centro_id: item.centro_id,
                fecha: item.fecha,
                entrada_at: item.entrada_at,
                estado: 'iniciada',
                ubicacion_entrada_lat: item.ubicacion_lat ?? null,
                ubicacion_entrada_lng: item.ubicacion_lng ?? null,
              })
              .select('id')
              .single();
            if (error) throw error;
            jornadaDbId = data.id;
            sincronizadas++;
          } else if (item.accion === 'finalizar') {
            const targetId = jornadaDbId || item.id;
            if (targetId.startsWith('offline_')) {
              fallidas.push(item);
              continue;
            }
            const { error } = await supabase
              .from('jornadas_residencia')
              .update({ salida_at: item.salida_at, estado: 'completada', updated_at: new Date().toISOString() })
              .eq('id', targetId);
            if (error) throw error;
            jornadaDbId = null;
            sincronizadas++;
          }
        } catch (e) {
          console.error('Error sincronizando jornada offline:', e);
          fallidas.push(item);
        }
      }

      if (fallidas.length === 0) {
        await AsyncStorage.removeItem(this.OFFLINE_KEY);
      } else {
        await AsyncStorage.setItem(this.OFFLINE_KEY, JSON.stringify(fallidas));
      }

      return sincronizadas;
    } catch (e) {
      console.error('Error en sincronizarJornadasOffline:', e);
      return 0;
    }
  }

  async obtenerHorasJornadasMes(centroId: string): Promise<number> {
    try {
      const inicioMes = moment().tz(TIMEZONE).startOf('month').format('YYYY-MM-DD');
      const finMes = moment().tz(TIMEZONE).endOf('month').format('YYYY-MM-DD');

      const { data, error } = await supabase
        .from('jornadas_residencia')
        .select('entrada_at, salida_at')
        .eq('centro_id', centroId)
        .eq('estado', 'completada')
        .gte('fecha', inicioMes)
        .lte('fecha', finMes);

      if (error) throw error;

      let totalMinutos = 0;
      for (const j of data || []) {
        if (j.entrada_at && j.salida_at) {
          totalMinutos += moment(j.salida_at).diff(moment(j.entrada_at), 'minutes');
        }
      }
      return totalMinutos;
    } catch (error) {
      console.error('Error obteniendo horas del mes:', error);
      return 0;
    }
  }

  formatearDuracion(minutos: number): string {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  calcularTranscurrido(entrada_at: string): string {
    const mins = moment().diff(moment(entrada_at), 'minutes');
    return this.formatearDuracion(mins);
  }
}

export const jornadaService = new JornadaService();
