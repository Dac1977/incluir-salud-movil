import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DateFilter,
    DateFilterType,
    DateRange,
} from '@/components/ui/date-filter';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Text } from '@/components/ui/text';
import { supabase } from '../../lib/supabase';
import { useSessionGuard } from '../../hooks/useSessionGuard';
import { useConnectivity } from '../../services/connectivityService';
import { choferService } from '../../services/choferService';
import { reporteService, type ReporteData, type PacienteReporte } from '@/services/reporteService';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { FileDown } from 'lucide-react-native';
import moment from 'moment-timezone';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    TouchableOpacity,
    View,
    Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';

const TIMEZONE =
    process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires';

export default function ReportesPage() {
    const insets = useSafeAreaInsets();
    const { session } = useSessionGuard(() => router.replace('/'));
    const [isChoferUser, setIsChoferUser] = useState(false);


    useEffect(() => {
        if (session) {
            choferService
                .isChofer()
                .then((isC) => {
                    setIsChoferUser(isC);
                    if (isC) router.replace('/(dashboard)/transporte');
                })
                .catch(() => setIsChoferUser(false));
        }
    }, [session]);

    if (isChoferUser) {
        return null;
    }

    // Filtro de fecha (por defecto: mes actual)
    const [dateFilter, setDateFilter] = useState<DateFilterType>('month');
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

    // Fechas para el reporte (inicializadas con el mes actual)
    const [fechaInicio, setFechaInicio] = useState<Date>(
        moment().tz(TIMEZONE).startOf('month').toDate()
    );
    const [fechaFin, setFechaFin] = useState<Date>(
        moment().tz(TIMEZONE).endOf('month').toDate()
    );

    const [estado, setEstado] = useState<
        'todos' | 'pendiente' | 'completada' | 'cancelada' | 'en_proceso'
    >('todos');
    const [pacienteIds, setPacienteIds] = useState<string[]>([]);
    const [pacientes, setPacientes] = useState<PacienteReporte[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const generatingPDFRef = useRef(false);
    const [reporteData, setReporteData] = useState<ReporteData | null>(null);
    const [reporteMesAnterior, setReporteMesAnterior] = useState<ReporteData | null>(null);
    const [vistaPreviaAbierta, setVistaPreviaAbierta] = useState(false);
    const [presetSeleccionado, setPresetSeleccionado] = useState<string | null>(null);

    // Estados para AlertDialog
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    // Actualizar fechas cuando cambia el filtro
    useEffect(() => {
        const now = moment().tz(TIMEZONE);

        switch (dateFilter) {
            case 'today':
                setFechaInicio(now.clone().startOf('day').toDate());
                setFechaFin(now.clone().endOf('day').toDate());
                break;
            case 'month':
                setFechaInicio(now.clone().startOf('month').toDate());
                setFechaFin(now.clone().endOf('month').toDate());
                break;
            case 'custom':
                if (customDateRange) {
                    setFechaInicio(customDateRange.start);
                    setFechaFin(customDateRange.end);
                }
                break;
        }
    }, [dateFilter, customDateRange]);

    const handleDateFilterChange = (filter: DateFilterType, range?: DateRange) => {
        setDateFilter(filter);
        setCustomDateRange(range);
    };

    // Cargar pacientes al montar el componente
    useEffect(() => {
        const cargarPacientes = async () => {
            try {
                const pacientesList = await reporteService.obtenerPacientes();
                setPacientes(pacientesList);
            } catch (error) {
                console.error('Error cargando pacientes:', error);
            }
        };
        cargarPacientes();
    }, []);


    const showAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertOpen(true);
    };

    const handleGenerarReporte = async () => {
        try {
            setIsLoading(true);
            const data = await reporteService.obtenerReportePropio(
                fechaInicio,
                fechaFin,
                estado,
                pacienteIds.length > 0 ? pacienteIds : undefined
            );
            setReporteData(data);

            // Si el filtro es "month", cargar también el mes anterior para comparación
            if (dateFilter === 'month') {
                try {
                    const inicioMesAnterior = moment(fechaInicio).tz(TIMEZONE).subtract(1, 'month').startOf('month').toDate();
                    const finMesAnterior = moment(fechaInicio).tz(TIMEZONE).subtract(1, 'month').endOf('month').toDate();
                    const dataAnterior = await reporteService.obtenerReportePropio(
                        inicioMesAnterior,
                        finMesAnterior,
                        estado,
                        pacienteIds.length > 0 ? pacienteIds : undefined
                    );
                    setReporteMesAnterior(dataAnterior);
                } catch (error) {
                    console.log('No se pudo cargar el mes anterior para comparación');
                    setReporteMesAnterior(null);
                }
            } else {
                setReporteMesAnterior(null);
            }

            if (data.prestaciones.length === 0) {
                showAlert(
                    'Sin resultados',
                    'No se encontraron prestaciones para el período seleccionado'
                );
            }
        } catch (error) {
            console.error('Error generando reporte:', error);
            showAlert(
                'Error',
                'No se pudo generar el reporte. Intenta nuevamente.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const aplicarPreset = (preset: string) => {
        const now = moment().tz(TIMEZONE);
        setPresetSeleccionado(preset);

        switch (preset) {
            case 'mes_actual_completadas':
                setDateFilter('month');
                setFechaInicio(now.clone().startOf('month').toDate());
                setFechaFin(now.clone().endOf('month').toDate());
                setEstado('completada');
                break;
            case 'mes_actual_pendientes':
                setDateFilter('month');
                setFechaInicio(now.clone().startOf('month').toDate());
                setFechaFin(now.clone().endOf('month').toDate());
                setEstado('pendiente');
                break;
            case 'mes_anterior_completadas':
                setDateFilter('custom');
                setFechaInicio(now.clone().subtract(1, 'month').startOf('month').toDate());
                setFechaFin(now.clone().subtract(1, 'month').endOf('month').toDate());
                setEstado('completada');
                break;
            case 'ultimos_3_meses':
                setDateFilter('custom');
                setFechaInicio(now.clone().subtract(3, 'months').startOf('month').toDate());
                setFechaFin(now.clone().endOf('month').toDate());
                setEstado('todos');
                break;
        }
    };

    // Calcular desglose por tipo
    const desglosePorTipo = useMemo(() => {
        if (!reporteData) return [];
        
        const desglose: { [key: string]: { cantidad: number; monto: number } } = {};
        
        reporteData.prestaciones.forEach(p => {
            if (p.estado !== 'cancelada') {
                if (!desglose[p.tipo_prestacion]) {
                    desglose[p.tipo_prestacion] = { cantidad: 0, monto: 0 };
                }
                desglose[p.tipo_prestacion].cantidad++;
                desglose[p.tipo_prestacion].monto += p.monto || 0;
            }
        });
        
        return Object.entries(desglose).map(([tipo, datos]) => ({
            tipo,
            ...datos
        }));
    }, [reporteData]);

    const formatearFecha = (fecha: Date) => {
        return moment(fecha).tz(TIMEZONE).format('DD/MM/YYYY');
    };

    const formatearMonto = (monto: number) => {
        const valor = (monto || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `$ ${valor}`;
    };

    const formatearDuracion = (minutos: number | null | undefined) => {
        if (minutos === null || minutos === undefined || minutos <= 0) return 'N/A';
        const h = Math.floor(minutos / 60);
        const m = Math.round(minutos % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const formatearHora = (iso: string | null | undefined) => {
        if (!iso) return '-';
        return moment(iso).tz(TIMEZONE).format('HH:mm');
    };

    const getFilterLabel = () => {
        switch (dateFilter) {
            case 'today':
                return 'Hoy';
            case 'month':
                return 'Este mes';
            case 'custom':
                if (customDateRange) {
                    return `${formatearFecha(customDateRange.start)} - ${formatearFecha(customDateRange.end)}`;
                }
                return 'Rango personalizado';
            default:
                return 'Este mes';
        }
    };

    const generarPDF = async () => {
        if (!reporteData) {
            showAlert('Error', 'No hay datos para generar el reporte');
            return;
        }

        try {
            if (generatingPDFRef.current) return;
            generatingPDFRef.current = true;
            setIsGeneratingPDF(true);
            const { prestador, prestaciones, totales } = reporteData;

            // Nota: Para incluir el logo en el PDF, se puede usar una URL pública
            // o convertir la imagen a base64. Por ahora usamos un placeholder.
            // El logo se puede agregar después desde una URL pública o base64.
            const logoHtml = `<div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">INCLUIR SALUD</div>
            </div>`;

            const filasTabla = prestaciones.map(p => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${moment(p.fecha).tz(TIMEZONE).format('DD/MM/YYYY')}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.completed_at ? moment(p.completed_at).tz(TIMEZONE).format('DD/MM/YYYY') : '-'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.tipo_prestacion.replace(/_/g, ' ').toUpperCase()}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.paciente?.documento || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.estado.toUpperCase()}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearHora(p.started_at)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearHora(p.completed_at)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatearDuracion(p.minutos)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatearMonto(p.monto)}</td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .logo-container { margin-bottom: 15px; }
                        .logo { max-width: 120px; max-height: 120px; margin: 0 auto; }
                        h1 { color: #1f2937; margin: 10px 0; }
                        h2 { color: #6b7280; font-size: 18px; margin: 5px 0; }
                        .section { margin: 20px 0; }
                        .section-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #374151; }
                        .info-row { margin: 5px 0; font-size: 12px; }
                        .info-label { font-weight: bold; display: inline-block; width: 100px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }
                        th { background-color: #3b82f6; color: white; padding: 10px; border: 1px solid #ddd; text-align: left; }
                        td { padding: 8px; border: 1px solid #ddd; }
                        .totales { margin-top: 20px; font-size: 13px; }
                        .totales-row { margin: 5px 0; }
                        .footer { margin-top: 30px; font-size: 10px; color: #6b7280; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${logoHtml}
                        <h1>REPORTE DE PRESTACIONES</h1>
                    </div>
                    <div class="section">
                        <div class="section-title">DATOS DEL PRESTADOR</div>
                        <div class="info-row"><span class="info-label">Nombre:</span> ${prestador.apellido}, ${prestador.nombre}</div>
                        <div class="info-row"><span class="info-label">Documento:</span> ${prestador.documento || 'N/A'}</div>
                        <div class="info-row"><span class="info-label">Email:</span> ${prestador.email || 'N/A'}</div>
                        <div class="info-row"><span class="info-label">Teléfono:</span> ${prestador.telefono || 'N/A'}</div>
                        <div class="info-row"><span class="info-label">Período:</span> ${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}</div>
                    </div>
                    <div class="section">
                        <div class="section-title">PRESTACIONES</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Realizada</th>
                                    <th>Tipo</th>
                                    <th>Paciente</th>
                                    <th>DNI Paciente</th>
                                    <th>Estado</th>
                                    <th>Inicio</th>
                                    <th>Fin</th>
                                    <th>Duración</th>
                                    <th>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasTabla}
                            </tbody>
                        </table>
                    </div>
                    <div class="totales">
                        <div class="totales-row"><strong>Total de Prestaciones:</strong> ${totales.cantidad}</div>
                        <div class="totales-row"><strong>Monto Total:</strong> ${formatearMonto(totales.monto)}</div>
                        <div class="totales-row"><strong>Total de Horas:</strong> ${formatearDuracion(totales.minutos)}</div>
                    </div>
                    <div class="footer">
                        Generado el ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')} por ${prestador.apellido}, ${prestador.nombre}
                    </div>
                </body>
                </html>
            `;

            // Generar el PDF
            const { uri } = await Print.printToFileAsync({ html });

            // Sanitizar nombre de archivo (elimina tildes y caracteres no válidos)
            const sanitize = (str: string) =>
                str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');

            const fileName = `Reporte_${sanitize(prestador.apellido)}_${sanitize(prestador.nombre)}_${formatearFecha(fechaInicio).replace(/\//g, '-')}_${formatearFecha(fechaFin).replace(/\//g, '-')}_${Date.now()}.pdf`;

            // Copiar al cache (necesario para Android 14 - expo-sharing requiere content:// URI)
            const newPath = `${FileSystem.cacheDirectory}${fileName}`;
            await FileSystem.copyAsync({ from: uri, to: newPath });

            // Compartir el PDF
            await Sharing.shareAsync(newPath, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
            });

            showAlert('Éxito', 'PDF generado correctamente');
        } catch (error) {
            console.error('Error generando PDF:', error);
            const msg = error instanceof Error ? error.message : String(error);
            showAlert('Error', `No se pudo generar el PDF: ${msg}`);
        } finally {
            generatingPDFRef.current = false;
            setIsGeneratingPDF(false);
        }
    };

    return (
        <ScrollView
            className="flex-1 bg-background"
            contentContainerStyle={{
                paddingBottom:
                    Platform.OS === 'android'
                        ? 70 + Math.max(insets.bottom, 0) + 20
                        : 90,
            }}
        >
            {/* Header */}
            <View className="p-6 pt-16 bg-card">
                <Text variant="h2">Reportes</Text>
                <Text variant="muted" className="mt-1">
                    Genera reportes de tus prestaciones
                </Text>
            </View>

            <View className="p-6 pt-4 gap-4">
                {/* Reporte de Residencia */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <Text>
                                Reporte de Residencia
                            </Text>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="outline"
                            className="w-full"
                            onPress={() => router.push('/(dashboard)/reporte-residencia')}
                        >
                            <Text>Generar reporte de residencia</Text>
                        </Button>
                    </CardContent>
                </Card>

                {/* Filtros */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <Text>
                                Filtros
                            </Text>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="gap-4">
                        {/* Filtro de Fecha */}
                        <View>
                            <Text variant="small" className="font-medium mb-2">
                                Período
                            </Text>
                            <DateFilter
                                selectedFilter={dateFilter}
                                customRange={customDateRange}
                                onFilterChange={handleDateFilterChange}
                            />
                            <Text variant="small" className="text-muted-foreground mt-2">
                                {`${getFilterLabel()}: ${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`}
                            </Text>
                        </View>

                        {/* Estado */}
                        <View>
                            <Text variant="small" className="font-medium mb-2">
                                Estado
                            </Text>
                            <Select
                                value={{ value: estado, label: estado }}
                                onValueChange={(option) => {
                                    if (option?.value) {
                                        setEstado(option.value as typeof estado);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue className='capitalize' placeholder="Seleccionar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem label="Todos" value="todos" />
                                    <SelectItem label="Pendientes" value="pendiente" />
                                    <SelectItem label="Completadas" value="completada" />
                                    <SelectItem label="Canceladas" value="cancelada" />
                                    <SelectItem label="En Proceso" value="en_proceso" />
                                </SelectContent>
                            </Select>
                        </View>

                        {/* Pacientes — multi-select */}
                        <View>
                            <View className="flex-row items-center justify-between mb-2">
                                <Text variant="small" className="font-medium">
                                    Pacientes
                                </Text>
                                {pacienteIds.length > 0 && (
                                    <TouchableOpacity onPress={() => setPacienteIds([])}>
                                        <Text variant="small" className="text-primary">
                                            Limpiar ({pacienteIds.length})
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <ScrollView
                                style={{ maxHeight: 180 }}
                                nestedScrollEnabled
                                className="border border-input rounded-md bg-background"
                            >
                                {pacientes.map((paciente, index) => {
                                    const seleccionado = pacienteIds.includes(paciente.id);
                                    return (
                                        <TouchableOpacity
                                            key={paciente.id}
                                            onPress={() => {
                                                setPacienteIds(prev =>
                                                    seleccionado
                                                        ? prev.filter(id => id !== paciente.id)
                                                        : [...prev, paciente.id]
                                                );
                                            }}
                                            className={`flex-row items-center gap-3 px-3 py-2.5 ${
                                                index < pacientes.length - 1 ? 'border-b border-border' : ''
                                            }`}
                                        >
                                            <Checkbox
                                                checked={seleccionado}
                                                onCheckedChange={() => {
                                                    setPacienteIds(prev =>
                                                        seleccionado
                                                            ? prev.filter(id => id !== paciente.id)
                                                            : [...prev, paciente.id]
                                                    );
                                                }}
                                            />
                                            <View className="flex-1">
                                                <Text variant="small" className="font-medium">
                                                    {paciente.apellido}, {paciente.nombre}
                                                </Text>
                                                <Text variant="small" className="text-muted-foreground">
                                                    DNI {paciente.documento}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                                {pacientes.length === 0 && (
                                    <View className="px-3 py-4">
                                        <Text variant="small" className="text-muted-foreground text-center">
                                            No hay pacientes
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                            {pacienteIds.length === 0 && (
                                <Text variant="small" className="text-muted-foreground mt-1">
                                    Ninguno seleccionado = todos
                                </Text>
                            )}
                        </View>

                        {/* Filtros Guardados (Presets) */}
                        <View>
                            <Text variant="small" className="font-medium mb-2">
                                Filtros Rápidos
                            </Text>
                            <View className="flex-row flex-wrap gap-2">
                                <Button
                                    variant={presetSeleccionado === 'mes_actual_completadas' ? 'default' : 'outline'}
                                    size="sm"
                                    onPress={() => aplicarPreset('mes_actual_completadas')}
                                >
                                    <Text className={presetSeleccionado === 'mes_actual_completadas' ? 'text-primary-foreground' : 'text-foreground'}>
                                        Mes Actual (Completadas)
                                    </Text>
                                </Button>
                                <Button
                                    variant={presetSeleccionado === 'mes_actual_pendientes' ? 'default' : 'outline'}
                                    size="sm"
                                    onPress={() => aplicarPreset('mes_actual_pendientes')}
                                >
                                    <Text className={presetSeleccionado === 'mes_actual_pendientes' ? 'text-primary-foreground' : 'text-foreground'}>
                                        Mes Actual (Pendientes)
                                    </Text>
                                </Button>
                                <Button
                                    variant={presetSeleccionado === 'mes_anterior_completadas' ? 'default' : 'outline'}
                                    size="sm"
                                    onPress={() => aplicarPreset('mes_anterior_completadas')}
                                >
                                    <Text className={presetSeleccionado === 'mes_anterior_completadas' ? 'text-primary-foreground' : 'text-foreground'}>
                                        Mes Anterior (Completadas)
                                    </Text>
                                </Button>
                                <Button
                                    variant={presetSeleccionado === 'ultimos_3_meses' ? 'default' : 'outline'}
                                    size="sm"
                                    onPress={() => aplicarPreset('ultimos_3_meses')}
                                >
                                    <Text className={presetSeleccionado === 'ultimos_3_meses' ? 'text-primary-foreground' : 'text-foreground'}>
                                        Últimos 3 Meses
                                    </Text>
                                </Button>
                            </View>
                        </View>

                        {/* Botón Generar */}
                        <Button
                            onPress={handleGenerarReporte}
                            disabled={isLoading}
                            className="mt-2"
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text className="text-primary-foreground font-semibold">
                                    Generar Reporte
                                </Text>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Resultados */}
                {reporteData && (
                    <>
                        {/* Información del Prestador */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>
                                        Datos del Prestador
                                    </Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-2">
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Nombre:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {`${reporteData.prestador.apellido}, ${reporteData.prestador.nombre}`}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Documento:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {reporteData.prestador.documento || 'N/A'}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Email:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {reporteData.prestador.email || 'N/A'}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Teléfono:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {reporteData.prestador.telefono || 'N/A'}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Período:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {`${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>

                        {/* Totales */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>
                                        Resumen
                                    </Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-2">
                                <View className="flex-row justify-between">
                                    <Text variant="small" className="font-semibold">
                                        Total de Prestaciones:
                                    </Text>
                                    <Text variant="large">{reporteData.totales.cantidad}</Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text variant="small" className="font-semibold">
                                        Monto Total:
                                    </Text>
                                    {!isChoferUser ? (
                                        <Text variant="large" className="font-bold text-green-600">
                                            {formatearMonto(reporteData.totales.monto)}
                                        </Text>
                                    ) : null}
                                </View>
                                <View className="flex-row justify-between">
                                    <Text variant="small" className="font-semibold">
                                        Total de Horas:
                                    </Text>
                                    <Text variant="large" className="font-bold text-blue-600">
                                        {formatearDuracion(reporteData.totales.minutos)}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>

                        {/* Comparación Mes Anterior */}
                        {reporteMesAnterior && dateFilter === 'month' && (
                            <Card className="bg-blue-50 border-blue-200">
                                <CardHeader>
                                    <CardTitle>
                                        <Text>
                                            Comparación con Mes Anterior
                                        </Text>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="gap-3">
                                    <View className="flex-row justify-between">
                                        <Text variant="small" className="font-semibold">
                                            Mes Actual:
                                        </Text>
                                        <Text variant="small">
                                            {reporteData.totales.cantidad} prestaciones - {formatearMonto(reporteData.totales.monto)}
                                        </Text>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Text variant="small" className="font-semibold">
                                            Mes Anterior:
                                        </Text>
                                        <Text variant="small">
                                            {reporteMesAnterior.totales.cantidad} prestaciones - {formatearMonto(reporteMesAnterior.totales.monto)}
                                        </Text>
                                    </View>
                                    <View className="pt-2 border-t border-blue-200">
                                        <View className="flex-row justify-between">
                                            <Text variant="small" className="font-semibold">
                                                Diferencia:
                                            </Text>
                                            <Text variant="small" className={reporteData.totales.monto >= reporteMesAnterior.totales.monto ? 'text-green-600' : 'text-red-600'}>
                                                {reporteData.totales.cantidad - reporteMesAnterior.totales.cantidad > 0 ? '+' : ''}
                                                {reporteData.totales.cantidad - reporteMesAnterior.totales.cantidad} prestaciones - 
                                                {reporteData.totales.monto >= reporteMesAnterior.totales.monto ? '+' : ''}
                                                {formatearMonto(reporteData.totales.monto - reporteMesAnterior.totales.monto)}
                                            </Text>
                                        </View>
                                    </View>
                                </CardContent>
                            </Card>
                        )}

                        {/* Desglose por Tipo */}
                        {desglosePorTipo.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        <Text>
                                            Desglose por Tipo de Prestación
                                        </Text>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="gap-2">
                                    {desglosePorTipo.map((item) => (
                                        <View key={item.tipo} className="flex-row justify-between items-center py-2 border-b border-border last:border-0">
                                            <View className="flex-1">
                                                <Text variant="small" className="font-semibold capitalize">
                                                    {item.tipo.replace(/_/g, ' ')}
                                                </Text>
                                                <Text variant="small" className="text-muted-foreground">
                                                    {item.cantidad} prestación{item.cantidad !== 1 ? 'es' : ''}
                                                </Text>
                                            </View>
                                            <Text variant="small" className="font-bold text-green-600">
                                                {formatearMonto(item.monto)}
                                            </Text>
                                        </View>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Vista Previa */}
                        <Collapsible open={vistaPreviaAbierta} onOpenChange={setVistaPreviaAbierta}>
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    <View className="flex-row items-center gap-2">
                                        {vistaPreviaAbierta ? (
                                            <ChevronUp size={16} className="text-foreground" />
                                        ) : (
                                            <ChevronDown size={16} className="text-foreground" />
                                        )}
                                        <Text className="text-foreground">
                                            {vistaPreviaAbierta ? 'Ocultar' : 'Mostrar'} Vista Previa
                                        </Text>
                                    </View>
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <Card className="mt-2">
                                    <CardHeader>
                                        <CardTitle>
                                            <Text>
                                                Vista Previa del Reporte
                                            </Text>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="gap-3">
                                        <View>
                                            <Text variant="small" className="font-semibold mb-2">
                                                Resumen:
                                            </Text>
                                            <Text variant="small" className="text-muted-foreground">
                                                • {reporteData.totales.cantidad} prestaciones en total
                                            </Text>
                                            <Text variant="small" className="text-muted-foreground">
                                                • Monto total: {formatearMonto(reporteData.totales.monto)}
                                            </Text>
                                            <Text variant="small" className="text-muted-foreground">
                                                • Total de horas: {formatearDuracion(reporteData.totales.minutos)}
                                            </Text>
                                            <Text variant="small" className="text-muted-foreground">
                                                • Período: {formatearFecha(fechaInicio)} - {formatearFecha(fechaFin)}
                                            </Text>
                                        </View>
                                        {desglosePorTipo.length > 0 && (
                                            <View>
                                                <Text variant="small" className="font-semibold mb-2">
                                                    Por Tipo:
                                                </Text>
                                                {desglosePorTipo.slice(0, 3).map((item) => (
                                                    <Text key={item.tipo} variant="small" className="text-muted-foreground">
                                                        • {item.tipo.replace(/_/g, ' ')}: {item.cantidad} - {formatearMonto(item.monto)}
                                                    </Text>
                                                ))}
                                                {desglosePorTipo.length > 3 && (
                                                    <Text variant="small" className="text-muted-foreground italic">
                                                        y {desglosePorTipo.length - 3} tipo{desglosePorTipo.length - 3 !== 1 ? 's' : ''} más...
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </CardContent>
                                </Card>
                            </CollapsibleContent>
                        </Collapsible>

                        {/* Botón de Descarga PDF */}
                        <Button
                            onPress={generarPDF}
                            variant="outline"
                            className="w-full"
                            disabled={isGeneratingPDF}
                        >
                            {isGeneratingPDF ? (
                                <View className="flex-row items-center gap-2">
                                    <ActivityIndicator size="small" />
                                    <Text variant="small">Generando PDF...</Text>
                                </View>
                            ) : (
                                <View className="flex-row items-center gap-2">
                                    <FileDown size={16} className="text-muted-foreground" />
                                    <Text variant="small">Descargar PDF</Text>
                                </View>
                            )}
                        </Button>

                        {/* Botón Excel comentado - Implementación futura
                        <Button
                            variant="outline"
                            className="flex-1"
                            disabled
                        >
                            <View className="flex-row items-center gap-2">
                                <Text variant="small">Excel (Próximamente)</Text>
                            </View>
                        </Button>
                        */}

                        {/* Lista de Prestaciones */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>
                                        Prestaciones ({reporteData.prestaciones.length})

                                    </Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-3">
                                {reporteData.prestaciones.map((prestacion) => (
                                    <View
                                        key={prestacion.id}
                                        className="p-3 bg-muted rounded-lg border border-border"
                                    >
                                        <View className="flex-row justify-between mb-2">
                                            <Text variant="small" className="font-semibold">
                                                {prestacion.tipo_prestacion
                                                    .replace(/_/g, ' ')
                                                    .toUpperCase()}
                                            </Text>
                                            <View>
                                                <Text variant="small" className="text-muted-foreground">
                                                    {moment(prestacion.fecha)
                                                        .tz(TIMEZONE)
                                                        .format('DD/MM/YYYY')}
                                                </Text>
                                                {prestacion.completed_at && (
                                                    <Text variant="small" className="text-muted-foreground">
                                                        Realizada: {moment(prestacion.completed_at)
                                                            .tz(TIMEZONE)
                                                            .format('DD/MM/YYYY')}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>

                                        {prestacion.paciente && (
                                            <View className="mb-1">
                                                <Text variant="small" className="text-foreground">
                                                    {`Paciente: ${prestacion.paciente.apellido}, ${prestacion.paciente.nombre}`}
                                                </Text>
                                                <Text variant="small" className="text-muted-foreground">
                                                    {`DNI: ${prestacion.paciente.documento}`}
                                                </Text>
                                            </View>
                                        )}

                                        <View className="flex-row justify-between items-center mt-2">
                                            <View
                                                className={`px-2 py-1 rounded ${prestacion.estado === 'completada'
                                                    ? 'bg-green-100'
                                                    : prestacion.estado === 'pendiente'
                                                        ? 'bg-yellow-100'
                                                        : prestacion.estado === 'cancelada'
                                                            ? 'bg-red-100'
                                                            : 'bg-blue-100'
                                                    }`}
                                            >
                                                <Text
                                                    variant="small"
                                                    className={`font-medium ${prestacion.estado === 'completada'
                                                        ? 'text-green-800'
                                                        : prestacion.estado === 'pendiente'
                                                            ? 'text-yellow-800'
                                                            : prestacion.estado === 'cancelada'
                                                                ? 'text-red-800'
                                                                : 'text-blue-800'
                                                        }`}
                                                >
                                                    {prestacion.estado.toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text
                                                variant="small"
                                                className="font-bold text-green-600"
                                            >
                                                {formatearMonto(prestacion.monto)}
                                            </Text>
                                        </View>
                                        <View className="flex-row justify-between items-center mt-2">
                                            <Text variant="small" className="text-muted-foreground">
                                                Duración:
                                            </Text>
                                            <Text variant="small" className="font-medium">
                                                {formatearDuracion(prestacion.minutos)}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </CardContent>
                        </Card>
                    </>
                )}
            </View>

            {/* AlertDialog para mensajes */}
            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
                        <AlertDialogDescription>{alertMessage}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onPress={() => setAlertOpen(false)}>
                            <Text>Aceptar</Text>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ScrollView>
    );
}
