import moment from 'moment-timezone';
import { supabase } from '../lib/supabase';

const TIMEZONE = process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires';

// Tipos para reportes
export interface Prestador {
    id: string;
    nombre: string;
    apellido: string;
    documento: string | null;
    email: string | null;
    telefono: string | null;
}

export interface PrestacionReporte {
    id: string;
    tipo_prestacion: 'consulta' | 'cirugia' | 'diagnostico' | 'emergencia' | 'control' | 'laboratorio';
    fecha: string;
    monto: number;
    descripcion: string | null;
    estado: 'pendiente' | 'completada' | 'cancelada' | 'en_proceso';
    started_at: string | null;
    completed_at: string | null;
    minutos: number | null;
    paciente: {
        nombre: string;
        apellido: string;
        documento: string;
    } | null;
}

export interface ReporteData {
    prestador: Prestador;
    prestaciones: PrestacionReporte[];
    totales: {
        cantidad: number;
        monto: number;
        minutos: number;
    };
}

export interface PacienteReporte {
    id: string;
    nombre: string;
    apellido: string;
    documento: string;
}

export interface CentroReporte {
    id: string;
    nombre: string;
}

export interface DiaResidenciaReporte {
    fecha: string;
    minutos: number;
}

export interface PrestacionResidenciaReporte {
    id: string;
    tipo_prestacion: string;
    fecha: string;
    monto: number;
    estado: 'pendiente' | 'completada' | 'cancelada' | 'en_proceso';
    started_at: string | null;
    completed_at: string | null;
    minutos: number | null;
    paciente: {
        nombre: string;
        apellido: string;
        documento: string;
    } | null;
}

export interface ResidenciaReporteData {
    centro: CentroReporte;
    pacientes: PacienteReporte[];
    dias: DiaResidenciaReporte[];
    totalMinutos: number;
    prestaciones: PrestacionResidenciaReporte[];
    totales: {
        cantidad: number;
        monto: number;
        minutos: number;
    };
}

class ReporteService {
    /**
     * Obtiene la lista de pacientes del usuario autenticado
     */
    async obtenerPacientes(): Promise<PacienteReporte[]> {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error('Usuario no autenticado');
            }

            // Obtener pacientes únicos de las prestaciones del usuario
            const { data: prestaciones, error: prestacionesError } = await supabase
                .from('prestaciones')
                .select(`
                    paciente_id,
                    pacientes (
                        id,
                        nombre,
                        apellido,
                        documento
                    )
                `)
                .eq('user_id', user.id)
                .not('paciente_id', 'is', null);

            if (prestacionesError) {
                throw prestacionesError;
            }

            // Extraer pacientes únicos
            const pacientesMap = new Map<string, PacienteReporte>();
            (prestaciones || []).forEach((p: any) => {
                if (p.pacientes && !pacientesMap.has(p.pacientes.id)) {
                    pacientesMap.set(p.pacientes.id, {
                        id: p.pacientes.id,
                        nombre: p.pacientes.nombre,
                        apellido: p.pacientes.apellido,
                        documento: p.pacientes.documento
                    });
                }
            });

            // Ordenar por apellido y nombre
            return Array.from(pacientesMap.values()).sort((a, b) => {
                const apellidoCompare = a.apellido.localeCompare(b.apellido);
                if (apellidoCompare !== 0) return apellidoCompare;
                return a.nombre.localeCompare(b.nombre);
            });
        } catch (error) {
            console.error('Error obteniendo pacientes:', error);
            throw error;
        }
    }
    /**
     * Obtiene el reporte de prestaciones del usuario autenticado
     */
    async obtenerReportePropio(
        fechaInicio: Date,
        fechaFin: Date,
        estado?: 'todos' | 'pendiente' | 'completada' | 'cancelada' | 'en_proceso',
        pacienteIds?: string[]
    ): Promise<ReporteData> {
        try {
            // 1. Obtener usuario autenticado
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error('Usuario no autenticado');
            }

            // 2. Obtener datos del prestador
            const { data: prestador, error: prestadorError } = await supabase
                .from('profiles')
                .select('id, nombre, apellido, documento, email, telefono')
                .eq('id', user.id)
                .single();

            if (prestadorError || !prestador) {
                throw new Error('No se pudo obtener información del prestador');
            }

            // 3. Convertir fechas a UTC
            const inicioArgentina = moment(fechaInicio).tz(TIMEZONE).startOf('day');
            const finArgentina = moment(fechaFin).tz(TIMEZONE).endOf('day');

            const inicioUTC = inicioArgentina.clone().utc().toISOString();
            const finUTC = finArgentina.clone().utc().toISOString();

            console.log(`📅 Consultando prestaciones para reporte:
        - Argentina: ${inicioArgentina.format('YYYY-MM-DD HH:mm:ss')} a ${finArgentina.format('YYYY-MM-DD HH:mm:ss')}
        - UTC: ${inicioUTC} a ${finUTC}`);

            // 4. Consultar prestaciones con filtros
            let query = supabase
                .from('prestaciones')
                .select(`
          id,
          tipo_prestacion,
          fecha,
          monto,
          descripcion,
          estado,
          started_at,
          completed_at,
          pacientes (
            nombre,
            apellido,
            documento
          )
        `)
                .eq('user_id', user.id)
                .gte('fecha', inicioUTC)
                .lte('fecha', finUTC)
                .order('fecha', { ascending: true });

            // Aplicar filtro de estado si no es "todos"
            if (estado && estado !== 'todos') {
                query = query.eq('estado', estado);
            }

            // Aplicar filtro de pacientes si se especifica
            if (pacienteIds && pacienteIds.length > 0) {
                query = query.in('paciente_id', pacienteIds);
            }

            const { data: prestaciones, error: prestacionesError } = await query;

            if (prestacionesError) {
                throw prestacionesError;
            }

            // 5. Transformar datos
            const prestacionesReporte: PrestacionReporte[] = (prestaciones || []).map((p: any) => {
                const minutos = p.started_at && p.completed_at
                    ? Math.round(moment(p.completed_at).diff(moment(p.started_at), 'minutes', true))
                    : null;
                return {
                    id: p.id,
                    tipo_prestacion: p.tipo_prestacion,
                    fecha: p.fecha,
                    monto: p.monto || 0,
                    descripcion: p.descripcion,
                    estado: p.estado,
                    started_at: p.started_at,
                    completed_at: p.completed_at,
                    minutos,
                    paciente: p.pacientes ? {
                        nombre: p.pacientes.nombre,
                        apellido: p.pacientes.apellido,
                        documento: p.pacientes.documento
                    } : null
                };
            });

            // 6. Calcular totales (excluyendo canceladas del monto)
            const prestacionesNoCanceladas = prestacionesReporte.filter(p => p.estado !== 'cancelada');
            const totales = {
                cantidad: prestacionesReporte.length,
                monto: prestacionesNoCanceladas.reduce((sum, p) => sum + (p.monto || 0), 0),
                minutos: prestacionesReporte.reduce((sum, p) => sum + (p.minutos || 0), 0)
            };

            return {
                prestador: {
                    id: prestador.id,
                    nombre: prestador.nombre,
                    apellido: prestador.apellido,
                    documento: prestador.documento,
                    email: prestador.email,
                    telefono: prestador.telefono
                },
                prestaciones: prestacionesReporte,
                totales
            };
        } catch (error) {
            console.error('Error obteniendo reporte:', error);
            throw error;
        }
    }

    /**
     * Obtiene los centros/residencias donde el usuario tiene jornadas o prestaciones
     */
    async obtenerCentrosDelUsuario(): Promise<CentroReporte[]> {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error('Usuario no autenticado');
            }

            const centroIds = new Set<string>();

            const { data: jornadas, error: jornadasError } = await supabase
                .from('jornadas_residencia')
                .select('centro_id')
                .eq('user_id', user.id)
                .not('centro_id', 'is', null);

            if (jornadasError) throw jornadasError;

            for (const j of (jornadas || []) as any[]) {
                if (j.centro_id) centroIds.add(j.centro_id);
            }

            const { data: prestaciones, error: prestacionesError } = await supabase
                .from('prestaciones')
                .select('centro_id')
                .eq('user_id', user.id)
                .not('centro_id', 'is', null);

            if (prestacionesError) throw prestacionesError;

            for (const p of (prestaciones || []) as any[]) {
                if (p.centro_id) centroIds.add(p.centro_id);
            }

            if (centroIds.size === 0) return [];

            const { data: centrosData, error: centrosError } = await supabase
                .from('centros')
                .select('id, nombre')
                .in('id', Array.from(centroIds));

            if (centrosError) throw centrosError;

            return (centrosData || [])
                .map((c: any) => ({ id: c.id, nombre: c.nombre }))
                .sort((a, b) => a.nombre.localeCompare(b.nombre));
        } catch (error) {
            console.error('Error obteniendo centros del usuario:', error);
            throw error;
        }
    }

    /**
     * Obtiene el reporte de residencia: pacientes atendidos, horas por día y total
     */
    async obtenerReporteResidencia(
        centroId: string,
        fechaInicio: Date,
        fechaFin: Date
    ): Promise<ResidenciaReporteData> {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                throw new Error('Usuario no autenticado');
            }

            const { data: centro, error: centroError } = await supabase
                .from('centros')
                .select('id, nombre')
                .eq('id', centroId)
                .single();

            if (centroError || !centro) {
                throw new Error('No se pudo obtener la residencia');
            }

            const inicioUTC = moment(fechaInicio).tz(TIMEZONE).startOf('day').utc().toISOString();
            const finUTC = moment(fechaFin).tz(TIMEZONE).endOf('day').utc().toISOString();
            const inicioStr = moment(fechaInicio).tz(TIMEZONE).format('YYYY-MM-DD');
            const finStr = moment(fechaFin).tz(TIMEZONE).format('YYYY-MM-DD');

            const { data: jornadas, error: jornadasError } = await supabase
                .from('jornadas_residencia')
                .select('fecha, entrada_at, salida_at')
                .eq('user_id', user.id)
                .eq('centro_id', centroId)
                .eq('estado', 'completada')
                .gte('fecha', inicioStr)
                .lte('fecha', finStr)
                .order('fecha', { ascending: true });

            if (jornadasError) throw jornadasError;

            const diasMap = new Map<string, number>();
            let totalMinutos = 0;
            for (const j of (jornadas || []) as any[]) {
                if (j.entrada_at && j.salida_at) {
                    const minutos = moment(j.salida_at).diff(moment(j.entrada_at), 'minutes');
                    const fechaKey = moment(j.fecha).format('YYYY-MM-DD');
                    diasMap.set(fechaKey, (diasMap.get(fechaKey) || 0) + minutos);
                    totalMinutos += minutos;
                }
            }

            const dias = Array.from(diasMap.entries())
                .map(([fecha, minutos]) => ({ fecha, minutos }))
                .sort((a, b) => a.fecha.localeCompare(b.fecha));

            const { data: prestaciones, error: prestacionesError } = await supabase
                .from('prestaciones')
                .select(`
                    id,
                    tipo_prestacion,
                    fecha,
                    monto,
                    estado,
                    started_at,
                    completed_at,
                    paciente_id,
                    pacientes (
                        id,
                        nombre,
                        apellido,
                        documento
                    )
                `)
                .eq('user_id', user.id)
                .eq('centro_id', centroId)
                .gte('fecha', inicioUTC)
                .lte('fecha', finUTC)
                .not('paciente_id', 'is', null)
                .order('fecha', { ascending: true });

            if (prestacionesError) throw prestacionesError;

            const pacientesMap = new Map<string, PacienteReporte>();
            const prestacionesReporte: PrestacionResidenciaReporte[] = (prestaciones || []).map((p: any) => {
                const pac = p.pacientes;
                if (pac && !pacientesMap.has(pac.id)) {
                    pacientesMap.set(pac.id, {
                        id: pac.id,
                        nombre: pac.nombre,
                        apellido: pac.apellido,
                        documento: pac.documento
                    });
                }

                const minutos = p.started_at && p.completed_at
                    ? Math.round(moment(p.completed_at).diff(moment(p.started_at), 'minutes', true))
                    : null;

                return {
                    id: p.id,
                    tipo_prestacion: p.tipo_prestacion,
                    fecha: p.fecha,
                    monto: p.monto || 0,
                    estado: p.estado,
                    started_at: p.started_at,
                    completed_at: p.completed_at,
                    minutos,
                    paciente: pac ? {
                        nombre: pac.nombre,
                        apellido: pac.apellido,
                        documento: pac.documento
                    } : null
                };
            });

            const pacientes = Array.from(pacientesMap.values()).sort((a, b) => {
                const cmp = a.apellido.localeCompare(b.apellido);
                if (cmp !== 0) return cmp;
                return a.nombre.localeCompare(b.nombre);
            });

            const prestacionesNoCanceladas = prestacionesReporte.filter(p => p.estado !== 'cancelada');
            const totales = {
                cantidad: prestacionesReporte.length,
                monto: prestacionesNoCanceladas.reduce((sum, p) => sum + (p.monto || 0), 0),
                minutos: prestacionesReporte.reduce((sum, p) => sum + (p.minutos || 0), 0)
            };

            return {
                centro: { id: centro.id, nombre: centro.nombre },
                pacientes,
                dias,
                totalMinutos,
                prestaciones: prestacionesReporte,
                totales
            };
        } catch (error) {
            console.error('Error obteniendo reporte de residencia:', error);
            throw error;
        }
    }
}

export const reporteService = new ReporteService();
