import moment from 'moment-timezone';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Clock,
  DoorOpen,
  Loader2,
  LogOut,
  MapPin,
  Users,
  AlertCircle,
} from 'lucide-react-native';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Text } from '../../components/ui/text';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { useLocation } from '../../hooks/useLocation';
import { useConnectivity } from '../../services/connectivityService';
import { prestacionService, PrestacionCompleta } from '../../services/prestacionService';
import { jornadaService, JornadaResidencia } from '../../services/jornadaService';

type PrestacionCentro = {
  prestacion_id: string;
  paciente_id: string;
  paciente_nombre: string;
  paciente_apellido: string;
  fecha: string;
  estado: string;
  tipo_prestacion: string;
  started_at?: string | null;
  paciente_completo_hoy?: boolean;
};

export default function ValidarCentroPage() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ centroId: string; centroNombre: string }>();
  const { centroId, centroNombre } = params;

  const connectivity = useConnectivity();
  const { requestLocation } = useLocation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prestaciones, setPrestaciones] = useState<PrestacionCentro[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [validating, setValidating] = useState(false);
  const [suggestingCenterLocation, setSuggestingCenterLocation] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');

  const [jornadaActiva, setJornadaActiva] = useState<JornadaResidencia | null>(null);
  const [iniciandoJornada, setIniciandoJornada] = useState(false);
  const [finalizandoJornada, setFinalizandoJornada] = useState(false);
  const [horasJornadaMes, setHorasJornadaMes] = useState(0);
  const [transcurrido, setTranscurrido] = useState('');

  const [confirmCierreOpen, setConfirmCierreOpen] = useState(false);
  const [pendientesSinValidar, setPendientesSinValidar] = useState(0);
  const [accionConfirm, setAccionConfirm] = useState<'cerrarConValidar' | 'soloCerrar'>('cerrarConValidar');
  const [mensajeValidacionPendiente, setMensajeValidacionPendiente] = useState('');

  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalContext, setSuccessModalContext] = useState<'validacion' | 'sugerencia'>('validacion');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const prestacionesByDay = useMemo(() => {
    const groups: { [key: string]: PrestacionCentro[] } = {};
    prestaciones.forEach(p => {
      const day = moment.utc(p.fecha).tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD');
      if (!groups[day]) groups[day] = [];
      groups[day].push(p);
    });
    return groups;
  }, [prestaciones]);

  const availableDays = useMemo(() => {
    return Object.keys(prestacionesByDay).sort().reverse();
  }, [prestacionesByDay]);

  const prestacionesDelDia = useMemo(() => {
    return prestacionesByDay[selectedDay] || [];
  }, [prestacionesByDay, selectedDay]);

  const getDayLabel = (day: string) => {
    const today = moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD');
    const yesterday = moment().tz('America/Argentina/Buenos_Aires').subtract(1, 'day').format('YYYY-MM-DD');
    if (day === today) return 'Hoy';
    if (day === yesterday) return 'Ayer';
    return moment(day).format('DD/MM');
  };

  const handleDayChange = (day: string) => {
    setSelectedDay(day);
    const dayPrestaciones = prestacionesByDay[day] || [];
    setSelectedIds(new Set(dayPrestaciones.filter(p => !(p as any).paciente_completo_hoy && !p.started_at).map(p => p.prestacion_id)));
  };

  const loadJornada = useCallback(async () => {
    if (!centroId) return;
    try {
      const jornada = await jornadaService.obtenerJornadaActivaHoy(String(centroId));
      setJornadaActiva(jornada);
      const mins = await jornadaService.obtenerHorasJornadasMes(String(centroId));
      setHorasJornadaMes(mins);
    } catch (e) {
      console.log('Error cargando jornada:', e);
    }
  }, [centroId]);

  const loadPrestaciones = useCallback(async () => {
    if (!centroId) return;

    try {
      setLoading(true);
      const { prestaciones: data, error } = await prestacionService.obtenerPrestacionesPendientesCentro(centroId);

      if (error) {
        setErrorMessage(error);
        setErrorDetail(null);
        setErrorModalOpen(true);
        return;
      }

      setPrestaciones(data);

      // Seleccionar el día de hoy por defecto, o el más reciente
      const today = moment().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD');
      const groups: { [key: string]: PrestacionCentro[] } = {};
      data.forEach((p: PrestacionCentro) => {
        const day = moment.utc(p.fecha).tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD');
        if (!groups[day]) groups[day] = [];
        groups[day].push(p);
      });
      const days = Object.keys(groups).sort().reverse();
      const defaultDay = days.includes(today) ? today : (days[0] || '');
      setSelectedDay(defaultDay);
      const defaultPrestaciones = groups[defaultDay] || [];
      setSelectedIds(new Set(defaultPrestaciones.filter(p => !(p as any).paciente_completo_hoy && !p.started_at).map(p => p.prestacion_id)));
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error al cargar prestaciones');
      setErrorDetail(null);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  }, [centroId]);

  useEffect(() => {
    loadPrestaciones();
    loadJornada();
  }, [loadPrestaciones, loadJornada]);

  useEffect(() => {
    if (!jornadaActiva) { setTranscurrido(''); return; }
    const actualizar = () => setTranscurrido(jornadaService.calcularTranscurrido(jornadaActiva.entrada_at));
    actualizar();
    const interval = setInterval(actualizar, 30000);
    return () => clearInterval(interval);
  }, [jornadaActiva]);

  // Refrescar automáticamente al volver a enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      (async () => {
        await Promise.all([
          jornadaService.sincronizarJornadasOffline().catch(() => {}),
          prestacionService.sincronizarPrestacionesOffline().catch(() => {})
        ]);
        await Promise.all([loadPrestaciones(), loadJornada()]);
        setRefreshing(false);
      })();
    }, [loadPrestaciones, loadJornada])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      jornadaService.sincronizarJornadasOffline().catch(() => {}),
      prestacionService.sincronizarPrestacionesOffline().catch(() => {})
    ]);
    await Promise.all([loadPrestaciones(), loadJornada()]);
    setRefreshing(false);
  };

  const handleIniciarJornada = async () => {
    try {
      setIniciandoJornada(true);
      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verificá GPS y permisos.');
        setErrorDetail(null);
        setErrorModalOpen(true);
        return;
      }
      const resultado = await jornadaService.iniciarJornada(
        String(centroId),
        ubicacion.latitude,
        ubicacion.longitude
      );
      if (resultado.exito) {
        setJornadaActiva(resultado.jornada!);
        if (!resultado.offline) {
          setSuccessModalContext('validacion');
          setSuccessMessage(resultado.mensaje);
          setSuccessModalOpen(true);
        }
      } else {
        setErrorMessage(resultado.mensaje);
        setErrorDetail(null);
        setErrorModalOpen(true);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error al iniciar jornada');
      setErrorDetail(null);
      setErrorModalOpen(true);
    } finally {
      setIniciandoJornada(false);
    }
  };

  const validarSeleccionadas = async (): Promise<{ exito: boolean; mensaje: string; detalle?: any }> => {
    if (selectedIds.size === 0) {
      return { exito: false, mensaje: 'Seleccioná al menos una prestación para validar' };
    }

    const selectedPrestaciones = prestaciones.filter(p => selectedIds.has(p.prestacion_id) && !p.started_at);
    const bloqueadas = selectedPrestaciones.filter(p => (p as any).paciente_completo_hoy);

    if (selectedPrestaciones.length === 0) {
      return { exito: false, mensaje: 'No hay prestaciones seleccionables para validar en jornada' };
    }

    if (bloqueadas.length > 0) {
      const detalle = bloqueadas
        .map(p => `• ${p.paciente_apellido}, ${p.paciente_nombre}`)
        .join('\n');
      setSelectedIds(prev => {
        const next = new Set(prev);
        bloqueadas.forEach(p => next.delete(p.prestacion_id));
        return next;
      });
      return {
        exito: false,
        mensaje: 'Hay pacientes que ya alcanzaron su límite diario. Quítalos de la selección para continuar.',
        detalle
      };
    }

    const ubicacion = await requestLocation();
    if (!ubicacion) {
      return { exito: false, mensaje: 'No se pudo obtener tu ubicación. Verificá GPS y permisos.' };
    }

    console.log('📍 Ubicación del usuario:', {
      latitude: ubicacion.latitude,
      longitude: ubicacion.longitude,
      accuracy: ubicacion.accuracy
    });

    const result = await prestacionService.validarPrestacionesCentro(
      selectedPrestaciones.map(p => p.prestacion_id),
      ubicacion.latitude,
      ubicacion.longitude
    );

    return result;
  };

  // Prestaciones del día que podrían validarse pero no están seleccionadas
  const contarSinValidar = () =>
    prestacionesDelDia.filter(
      p => !selectedIds.has(p.prestacion_id) && !p.paciente_completo_hoy && !p.started_at
    ).length;

  const cerrarJornada = async (): Promise<{ ok: boolean; mensaje?: string }> => {
    if (!jornadaActiva) return { ok: true };
    const resultado = await jornadaService.finalizarJornada(jornadaActiva.id, jornadaActiva.entrada_at);
    if (resultado.exito) {
      setJornadaActiva(null);
      const mins = await jornadaService.obtenerHorasJornadasMes(String(centroId));
      setHorasJornadaMes(mins);
      return { ok: true, mensaje: resultado.mensaje };
    }
    setErrorMessage(resultado.mensaje);
    setErrorDetail(null);
    setErrorModalOpen(true);
    return { ok: false };
  };

  const handleFinalizarJornada = async () => {
    if (!jornadaActiva) return;
    // Si quedan prestaciones del día sin validar (deseleccionadas), pedir confirmación
    const sinValidar = contarSinValidar();
    if (sinValidar > 0) {
      setPendientesSinValidar(sinValidar);
      setAccionConfirm('cerrarConValidar');
      setConfirmCierreOpen(true);
      return;
    }
    await ejecutarFinalizarJornada();
  };

  const ejecutarFinalizarJornada = async () => {
    setFinalizandoJornada(true);
    try {
      if (selectedIds.size > 0) {
        const result = await validarSeleccionadas();
        if (!result.exito) {
          setErrorMessage(result.mensaje);
          setErrorDetail(result.detalle ? JSON.stringify(result.detalle, null, 2) : null);
          setErrorModalOpen(true);
          return;
        }
      }

      const { ok, mensaje } = await cerrarJornada();
      if (ok) {
        setSuccessModalContext('validacion');
        setSuccessMessage(mensaje || 'Jornada finalizada correctamente');
        setSuccessModalOpen(true);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error al finalizar jornada');
      setErrorDetail(null);
      setErrorModalOpen(true);
    } finally {
      setFinalizandoJornada(false);
    }
  };

  const handleConfirmCierre = async () => {
    setConfirmCierreOpen(false);
    if (accionConfirm === 'cerrarConValidar') {
      await ejecutarFinalizarJornada();
      return;
    }
    // 'soloCerrar': las seleccionadas ya se validaron — solo cerrar la jornada
    setValidating(true);
    try {
      const { ok, mensaje } = await cerrarJornada();
      if (ok) {
        setSuccessModalContext('validacion');
        setSuccessMessage(mensajeValidacionPendiente || mensaje || 'Jornada cerrada correctamente');
        setSuccessModalOpen(true);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleCancelCierre = () => {
    setConfirmCierreOpen(false);
    if (accionConfirm === 'soloCerrar') {
      // Las prestaciones ya se validaron — avisar igualmente y dejar la jornada abierta
      setSuccessModalContext('validacion');
      setSuccessMessage(`${mensajeValidacionPendiente} La jornada sigue abierta — podés validar el resto después.`);
      setSuccessModalOpen(true);
    }
  };

  const handleSugerirUbicacionCentro = async () => {
    if (!centroId) return;

    if (!connectivity.isConnected) {
      setErrorMessage('La sugerencia de ubicación requiere conexión a internet');
      setErrorDetail(null);
      setErrorModalOpen(true);
      return;
    }

    try {
      setSuggestingCenterLocation(true);

      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verificá GPS y permisos.');
        setErrorDetail(null);
        setErrorModalOpen(true);
        return;
      }

      const resultado = await prestacionService.sugerirUbicacionCentro(
        String(centroId),
        ubicacion.latitude,
        ubicacion.longitude,
        typeof ubicacion.accuracy === 'number' ? Math.round(ubicacion.accuracy) : null
      );

      if (resultado.exito) {
        setSuccessModalContext('sugerencia');
        setSuccessMessage(resultado.mensaje || 'Sugerencia de ubicación enviada para el centro');
        setSuccessModalOpen(true);
      } else {
        setErrorMessage(resultado.mensaje || 'No se pudo enviar la sugerencia de ubicación del centro');
        setErrorDetail(null);
        setErrorModalOpen(true);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'No se pudo enviar la sugerencia de ubicación del centro');
      setErrorDetail(null);
      setErrorModalOpen(true);
    } finally {
      setSuggestingCenterLocation(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(prestacionesDelDia.filter(p => !(p as any).paciente_completo_hoy && !p.started_at).map(p => p.prestacion_id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const handleValidar = async () => {
    if (selectedIds.size === 0) {
      setErrorMessage('Seleccioná al menos una prestación para validar');
      setErrorDetail(null);
      setErrorModalOpen(true);
      return;
    }

    const selectedPrestaciones = prestaciones.filter(p => selectedIds.has(p.prestacion_id) && !p.started_at);
    const bloqueadas = selectedPrestaciones.filter(p => (p as any).paciente_completo_hoy);

    if (selectedPrestaciones.length === 0) {
      setErrorMessage('No hay prestaciones seleccionables para validar en jornada');
      setErrorDetail('Las prestaciones seleccionadas fueron iniciadas individualmente o no están disponibles.');
      setErrorModalOpen(true);
      return;
    }

    if (bloqueadas.length > 0) {
      setErrorMessage('Hay pacientes que ya alcanzaron su límite diario. Quítalos de la selección para continuar.');
      setErrorDetail(
        bloqueadas
          .map(p => `• ${p.paciente_apellido}, ${p.paciente_nombre}`)
          .join('\n')
      );
      setSelectedIds(prev => {
        const next = new Set(prev);
        bloqueadas.forEach(p => next.delete(p.prestacion_id));
        return next;
      });
      setErrorModalOpen(true);
      return;
    }

    try {
      setValidating(true);

      // Obtener ubicación
      const ubicacion = await requestLocation();
      if (!ubicacion) {
        setErrorMessage('No se pudo obtener tu ubicación. Verificá GPS y permisos.');
        setErrorModalOpen(true);
        return;
      }

      console.log('📍 Ubicación del usuario:', {
        latitude: ubicacion.latitude,
        longitude: ubicacion.longitude,
        accuracy: ubicacion.accuracy
      });

      const result = await prestacionService.validarPrestacionesCentro(
        selectedPrestaciones.map(p => p.prestacion_id),
        ubicacion.latitude,
        ubicacion.longitude
      );

      if (result.exito) {
        // Al validar también se cierra la jornada — pero si quedan prestaciones
        // del día sin validar (deseleccionadas), pedir confirmación antes
        if (jornadaActiva) {
          const sinValidar = contarSinValidar();
          if (sinValidar > 0) {
            setMensajeValidacionPendiente(result.mensaje);
            setPendientesSinValidar(sinValidar);
            setAccionConfirm('soloCerrar');
            setConfirmCierreOpen(true);
            return;
          }
          const { ok } = await cerrarJornada();
          if (!ok) return;
        }
        setSuccessModalContext('validacion');
        setSuccessMessage(result.mensaje);
        setSuccessModalOpen(true);
      } else {
        setErrorMessage(result.mensaje);
        setErrorDetail((result as any).detalle ? JSON.stringify((result as any).detalle, null, 2) : null);
        setErrorModalOpen(true);
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error al validar prestaciones');
      setErrorDetail(null);
      setErrorModalOpen(true);
    } finally {
      setValidating(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    if (successModalContext === 'validacion') {
      router.back();
    }
  };

  if (!centroId) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <Text className="text-destructive">Centro no especificado</Text>
        <Button onPress={() => router.back()} className="mt-4">
          <Text className="text-primary-foreground">Volver</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onPress={() => router.back()}>
          <ArrowLeft size={24} className="text-foreground" />
        </Button>
        <View className="flex-1">
          <Text className="text-lg font-semibold">Validar en Centro</Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {centroNombre || 'Geriátrico'}
          </Text>
        </View>
        <Building2 size={24} className="text-muted-foreground" />
      </View>

      {/* Banner de jornada */}
      {jornadaActiva ? (
        <View className="bg-blue-100 px-4 py-3 flex-row items-center justify-between gap-2 border-b border-blue-200">
          <View className="flex-row items-center gap-2 flex-1">
            <Clock size={16} color="#2563eb" />
            <View>
              <Text className="text-blue-800 text-sm font-semibold">Jornada en curso: {transcurrido}</Text>
              {horasJornadaMes > 0 && (
                <Text className="text-blue-600 text-xs">Este mes: {jornadaService.formatearDuracion(horasJornadaMes)}</Text>
              )}
            </View>
          </View>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-400"
            onPress={handleFinalizarJornada}
            disabled={finalizandoJornada}
          >
            <View className="flex-row items-center gap-1">
              {finalizandoJornada ? <Loader2 size={14} color="#2563eb" /> : <LogOut size={14} color="#2563eb" />}
              <Text className="text-blue-700 text-xs font-medium">
                {finalizandoJornada ? 'Finalizando...' : 'Finalizar'}
              </Text>
            </View>
          </Button>
        </View>
      ) : (
        <View className="bg-amber-50 px-4 py-3 flex-row items-center justify-between gap-2 border-b border-amber-200">
          <View className="flex-row items-center gap-2 flex-1">
            <DoorOpen size={16} color="#d97706" />
            <View>
              <Text className="text-amber-800 text-sm font-semibold">Sin jornada iniciada</Text>
              {horasJornadaMes > 0 && (
                <Text className="text-amber-600 text-xs">Este mes: {jornadaService.formatearDuracion(horasJornadaMes)}</Text>
              )}
            </View>
          </View>
          <Button
            size="sm"
            className="bg-green-600"
            onPress={handleIniciarJornada}
            disabled={iniciandoJornada}
          >
            <View className="flex-row items-center gap-1">
              {iniciandoJornada ? <Loader2 size={14} color="#fff" /> : <DoorOpen size={14} color="#fff" />}
              <Text className="text-white text-xs font-medium">
                {iniciandoJornada ? 'Iniciando...' : 'Iniciar jornada'}
              </Text>
            </View>
          </Button>
        </View>
      )}

      {/* Offline warning */}
      {!connectivity.isConnected && (
        <View className="bg-amber-100 px-4 py-2 flex-row items-center gap-2">
          <AlertCircle size={16} className="text-amber-600" />
          <Text className="text-amber-800 text-sm flex-1">
            Sin conexión. Las acciones se guardarán y sincronizarán al reconectarte.
          </Text>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View className="gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </View>
        ) : prestaciones.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="items-center py-8">
              <CheckCircle size={48} className="text-green-500 mb-3" />
              <Text className="text-center text-muted-foreground">
                No hay prestaciones pendientes en este centro para hoy
              </Text>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Info card */}
            <Card className="mb-4 bg-blue-50 border-blue-200">
              <CardContent className="py-3">
                <View className="flex-row items-center gap-2">
                  <MapPin size={18} className="text-blue-600" />
                  <Text className="text-blue-800 text-sm flex-1">
                    Validá todas las prestaciones del centro con una sola geolocalización
                  </Text>
                </View>
              </CardContent>
            </Card>

            {/* Selector de días */}
            {availableDays.length > 1 && (
              <View className="mb-4">
                <Text className="text-sm font-medium text-muted-foreground mb-2">Seleccioná el día a validar:</Text>
                <View className="flex-row flex-wrap gap-2">
                  {availableDays.map(day => (
                    <Button
                      key={day}
                      variant={selectedDay === day ? 'default' : 'outline'}
                      size="sm"
                      onPress={() => handleDayChange(day)}
                    >
                      <View className="items-center">
                        <Text className={`text-sm font-medium ${selectedDay === day ? 'text-primary-foreground' : ''}`}>
                          {getDayLabel(day)}
                        </Text>
                        <Text className={`text-xs ${selectedDay === day ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {(prestacionesByDay[day] || []).length} prest.
                        </Text>
                      </View>
                    </Button>
                  ))}
                </View>
              </View>
            )}

            {/* Selection controls */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Users size={18} className="text-muted-foreground" />
                <Text className="text-sm text-muted-foreground">
                  {selectedIds.size} de {prestacionesDelDia.length} seleccionadas
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Button variant="outline" size="sm" onPress={selectAll}>
                  <Text className="text-sm">Todas</Text>
                </Button>
                <Button variant="outline" size="sm" onPress={selectNone}>
                  <Text className="text-sm">Ninguna</Text>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setSelectedIds(new Set(prestacionesDelDia.filter(p => !(p as any).paciente_completo_hoy && !p.started_at).map(p => p.prestacion_id)));
                  }}
                >
                  <Text className="text-sm">Disponibles</Text>
                </Button>
              </View>
            </View>

            {/* Prestaciones list */}
            <View className="gap-2">
              {prestacionesDelDia.map((p) => {
                const disabledByLimit = Boolean((p as any).paciente_completo_hoy);
                const iniciadaIndividual = Boolean(p.started_at);
                const isDisabled = disabledByLimit || iniciadaIndividual;
                const isSelected = selectedIds.has(p.prestacion_id);
                return (
                <Card
                  key={p.prestacion_id}
                  className={`${isSelected ? 'border-primary bg-primary/5' : ''} ${isDisabled ? 'opacity-70' : ''}`}
                >
                  <CardContent className="py-3">
                    <View className="flex-row items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={() => toggleSelection(p.prestacion_id)}
                      />
                      <View className="flex-1">
                        <Text className="font-medium">
                          {p.paciente_apellido}, {p.paciente_nombre}
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          {p.tipo_prestacion}
                        </Text>
                        {iniciadaIndividual && (
                          <View className="flex-row items-center gap-1 mt-1">
                            <AlertCircle size={12} className="text-blue-600" />
                            <Text className="text-xs text-blue-700">Iniciada individualmente. No se valida en jornada.</Text>
                          </View>
                        )}
                        {disabledByLimit && (
                          <View className="flex-row items-center gap-1 mt-1">
                            <AlertCircle size={12} className="text-amber-600" />
                            <Text className="text-xs text-amber-700">Ya se validó una prestación para este paciente hoy</Text>
                          </View>
                        )}
                      </View>
                      <Badge variant={p.estado === 'pendiente' ? 'secondary' : 'outline'}>
                        <Text className="text-xs">{p.estado}</Text>
                      </Badge>
                    </View>
                  </CardContent>
                </Card>
              );})}
            </View>

            {/* Botón de validación */}
            <View className="mt-6 mb-4">
              <Button
                onPress={handleValidar}
                disabled={validating || selectedIds.size === 0 || !jornadaActiva}
                className={`w-full active:bg-green-700 ${jornadaActiva ? 'bg-green-600' : 'bg-green-300'}`}
                size="lg"
              >
                {validating ? (
                  <View className="flex-row items-center gap-2">
                    <Loader2 size={20} color="#fff" />
                    <Text className="text-white font-semibold">Validando...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <CheckCircle size={20} color="#fff" />
                    <Text className="text-white font-semibold">
                      Validar {selectedIds.size} {selectedIds.size === 1 ? 'prestación' : 'prestaciones'}
                    </Text>
                  </View>
                )}
              </Button>

              <Button
                onPress={handleSugerirUbicacionCentro}
                disabled={suggestingCenterLocation}
                variant="outline"
                className="w-full mt-3"
              >
                {suggestingCenterLocation ? (
                  <View className="flex-row items-center gap-2">
                    <Loader2 size={18} className="text-foreground" />
                    <Text className="font-medium">Enviando sugerencia...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <MapPin size={18} className="text-foreground" />
                    <Text className="font-medium">Sugerir ubicación del centro</Text>
                  </View>
                )}
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      {/* Success Modal */}
      <AlertDialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <View className="flex-row items-center gap-2">
                <CheckCircle size={24} className="text-green-500" />
                <Text className="text-lg font-semibold">
                  {successModalContext === 'validacion' ? '¡Validación exitosa!' : 'Sugerencia enviada'}
                </Text>
              </View>
            </AlertDialogTitle>
            <AlertDialogDescription>{successMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={handleSuccessClose}>
              <Text className="text-primary-foreground">Aceptar</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación: quedan prestaciones sin validar */}
      <AlertDialog open={confirmCierreOpen} onOpenChange={setConfirmCierreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <View className="flex-row items-center gap-2">
                <AlertCircle size={24} className="text-amber-500" />
                <Text className="text-lg font-semibold">Prestaciones sin validar</Text>
              </View>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {`Quedan ${pendientesSinValidar} prestación(es) del día sin validar. Si cerrás la jornada van a quedar pendientes y se cancelan automáticamente a los 7 días.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={handleCancelCierre}>
              <Text>Volver</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleConfirmCierre}>
              <Text className="text-primary-foreground">Cerrar igual</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Modal */}
      <AlertDialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <View className="flex-row items-center gap-2">
                <AlertCircle size={24} className="text-destructive" />
                <Text className="text-lg font-semibold">Error</Text>
              </View>
            </AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onPress={() => setErrorModalOpen(false)}>
              <Text className="text-primary-foreground">Aceptar</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
