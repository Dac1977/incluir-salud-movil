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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { reporteService, type CentroReporte, type ResidenciaReporteData } from '@/services/reporteService';
import { useSessionGuard } from '../../hooks/useSessionGuard';
import { FileDown } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import moment from 'moment-timezone';
import React, { useEffect, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

const TIMEZONE = process.env.EXPO_PUBLIC_TIMEZONE || 'America/Argentina/Buenos_Aires';

export default function ReporteResidenciaPage() {
    const insets = useSafeAreaInsets();
    useSessionGuard(() => router.replace('/'));

    const [dateFilter, setDateFilter] = useState<DateFilterType>('month');
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
    const [fechaInicio, setFechaInicio] = useState<Date>(
        moment().tz(TIMEZONE).startOf('month').toDate()
    );
    const [fechaFin, setFechaFin] = useState<Date>(
        moment().tz(TIMEZONE).endOf('month').toDate()
    );

    const [centros, setCentros] = useState<CentroReporte[]>([]);
    const [centroId, setCentroId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const generatingPDFRef = useRef(false);
    const [reporte, setReporte] = useState<ResidenciaReporteData | null>(null);

    const [alertOpen, setAlertOpen] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    useEffect(() => {
        const cargarCentros = async () => {
            try {
                const data = await reporteService.obtenerCentrosDelUsuario();
                setCentros(data);
            } catch (error) {
                console.error('Error cargando centros:', error);
            }
        };
        cargarCentros();
    }, []);

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

    const showAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertOpen(true);
    };

    const handleDateFilterChange = (filter: DateFilterType, range?: DateRange) => {
        setDateFilter(filter);
        setCustomDateRange(range);
    };

    const handleGenerarReporte = async () => {
        if (!centroId) {
            showAlert('Faltan datos', 'Seleccioná una residencia para generar el reporte');
            return;
        }

        try {
            setIsLoading(true);
            const data = await reporteService.obtenerReporteResidencia(centroId, fechaInicio, fechaFin);
            setReporte(data);
            if (data.prestaciones.length === 0 && data.pacientes.length === 0) {
                showAlert('Sin resultados', 'No se encontraron datos para el período seleccionado');
            }
        } catch (error) {
            console.error('Error generando reporte de residencia:', error);
            showAlert('Error', 'No se pudo generar el reporte. Intenta nuevamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatearFecha = (fecha: Date | string) => {
        return moment(fecha).tz(TIMEZONE).format('DD/MM/YYYY');
    };

    const formatearDuracion = (minutos: number | null | undefined) => {
        if (minutos === null || minutos === undefined || minutos <= 0) return '0m';
        const h = Math.floor(minutos / 60);
        const m = Math.round(minutos % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const formatearHora = (iso: string | null | undefined) => {
        if (!iso) return '-';
        return moment(iso).tz(TIMEZONE).format('HH:mm');
    };

    const generarPDF = async () => {
        if (!reporte) {
            showAlert('Error', 'No hay datos para generar el PDF');
            return;
        }

        try {
            if (generatingPDFRef.current) return;
            generatingPDFRef.current = true;
            setIsGeneratingPDF(true);

            const filasPacientes = reporte.pacientes.map(p => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.apellido}, ${p.nombre}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.documento || 'N/A'}</td>
                </tr>
            `).join('');

            const filasPrestaciones = reporte.prestaciones.map(p => `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearFecha(p.fecha)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.tipo_prestacion.replace(/_/g, ' ').toUpperCase()}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${p.estado.toUpperCase()}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearHora(p.started_at)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${formatearHora(p.completed_at)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatearDuracion(p.minutos)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${p.monto.toLocaleString('es-AR')}</td>
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
                        h1 { color: #1f2937; margin: 10px 0; }
                        .section { margin: 20px 0; }
                        .section-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; color: #374151; }
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
                        <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">INCLUIR SALUD</div>
                        <h1>REPORTE DE RESIDENCIA</h1>
                    </div>
                    <div class="section">
                        <div class="section-title">DATOS DE LA RESIDENCIA</div>
                        <div><strong>Residencia:</strong> ${reporte.centro.nombre}</div>
                        <div><strong>Período:</strong> ${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}</div>
                    </div>
                    <div class="section">
                        <div class="section-title">PACIENTES ATENDIDOS</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Paciente</th>
                                    <th>Documento</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasPacientes || '<tr><td colspan="2" style="text-align:center;">Sin pacientes</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    <div class="section">
                        <div class="section-title">PRESTACIONES</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Paciente</th>
                                    <th>Estado</th>
                                    <th>Inicio</th>
                                    <th>Fin</th>
                                    <th>Duración</th>
                                    <th>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasPrestaciones || '<tr><td colspan="8" style="text-align:center;">Sin prestaciones</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    <div class="totales">
                        <div class="totales-row"><strong>Total de Prestaciones:</strong> ${reporte.totales.cantidad}</div>
                        <div class="totales-row"><strong>Total de Horas:</strong> ${formatearDuracion(reporte.totales.minutos)}</div>
                        <div class="totales-row"><strong>Monto Total:</strong> $${reporte.totales.monto.toLocaleString('es-AR')}</div>
                    </div>
                    <div class="footer">
                        Generado el ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')}
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });

            const sanitize = (str: string) =>
                str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');

            const fileName = `Reporte_Residencia_${sanitize(reporte.centro.nombre)}_${formatearFecha(fechaInicio).replace(/\//g, '-')}_${formatearFecha(fechaFin).replace(/\//g, '-')}_${Date.now()}.pdf`;
            const newPath = `${FileSystem.cacheDirectory}${fileName}`;
            await FileSystem.copyAsync({ from: uri, to: newPath });

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

    const centroSeleccionado = centros.find(c => c.id === centroId);

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
            <View className="p-6 pt-16 bg-card">
                <Text variant="h2">Reporte de Residencia</Text>
                <Text variant="muted" className="mt-1">
                    Pacientes atendidos y horas trabajadas
                </Text>
            </View>

            <View className="p-6 pt-4 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <Text>Filtros</Text>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="gap-4">
                        <View>
                            <Text variant="small" className="font-medium mb-2">
                                Residencia
                            </Text>
                            <Select
                                value={centroSeleccionado ? { value: centroSeleccionado.id, label: centroSeleccionado.nombre } : undefined}
                                onValueChange={(option) => {
                                    setCentroId(option?.value || '');
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar residencia" />
                                </SelectTrigger>
                                <SelectContent>
                                    {centros.map((centro) => (
                                        <SelectItem
                                            key={centro.id}
                                            label={centro.nombre}
                                            value={centro.id}
                                        />
                                    ))}
                                </SelectContent>
                            </Select>
                        </View>

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
                                {`${formatearFecha(fechaInicio)} - ${formatearFecha(fechaFin)}`}
                            </Text>
                        </View>

                        <Button onPress={handleGenerarReporte} disabled={isLoading} className="mt-2">
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

                {reporte && (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>Datos de la Residencia</Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-2">
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Nombre:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {reporte.centro.nombre}
                                    </Text>
                                </View>
                                <View className="flex-row">
                                    <Text variant="small" className="font-semibold w-24">
                                        Período:
                                    </Text>
                                    <Text variant="small" className="flex-1">
                                        {formatearFecha(fechaInicio)} - {formatearFecha(fechaFin)}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>Totales del Período</Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-2">
                                <View className="flex-row justify-between">
                                    <Text variant="small" className="text-muted-foreground">
                                        Total de Prestaciones
                                    </Text>
                                    <Text variant="small" className="font-bold">
                                        {reporte.totales.cantidad}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text variant="small" className="text-muted-foreground">
                                        Total de Horas
                                    </Text>
                                    <Text variant="small" className="font-bold text-blue-600">
                                        {formatearDuracion(reporte.totales.minutos)}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text variant="small" className="text-muted-foreground">
                                        Monto Total
                                    </Text>
                                    <Text variant="small" className="font-bold text-blue-600">
                                        ${reporte.totales.monto.toLocaleString('es-AR')}
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>Pacientes Atendidos ({reporte.pacientes.length})</Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-3">
                                {reporte.pacientes.map((paciente) => (
                                    <View key={paciente.id} className="p-3 bg-muted rounded-lg border border-border">
                                        <Text variant="small" className="font-semibold">
                                            {paciente.apellido}, {paciente.nombre}
                                        </Text>
                                        <Text variant="small" className="text-muted-foreground">
                                            DNI: {paciente.documento || 'N/A'}
                                        </Text>
                                    </View>
                                ))}
                                {reporte.pacientes.length === 0 && (
                                    <Text variant="small" className="text-muted-foreground text-center">
                                        No hay pacientes atendidos en el período
                                    </Text>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <Text>Prestaciones ({reporte.prestaciones.length})</Text>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-3">
                                {reporte.prestaciones.map((p) => (
                                    <View key={p.id} className="p-3 bg-muted rounded-lg border border-border gap-1">
                                        <View className="flex-row justify-between">
                                            <Text variant="small" className="font-semibold">
                                                {p.paciente ? `${p.paciente.apellido}, ${p.paciente.nombre}` : 'N/A'}
                                            </Text>
                                            <Text variant="small" className="text-muted-foreground">
                                                {formatearFecha(p.fecha)}
                                            </Text>
                                        </View>
                                        <Text variant="small" className="text-muted-foreground capitalize">
                                            {p.tipo_prestacion.replace(/_/g, ' ')} · {p.estado}
                                        </Text>
                                        <View className="flex-row justify-between">
                                            <Text variant="small" className="text-muted-foreground">
                                                {formatearHora(p.started_at)} - {formatearHora(p.completed_at)} ({formatearDuracion(p.minutos)})
                                            </Text>
                                            <Text variant="small" className="font-bold text-blue-600">
                                                ${p.monto.toLocaleString('es-AR')}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                                {reporte.prestaciones.length === 0 && (
                                    <Text variant="small" className="text-muted-foreground text-center">
                                        No hay prestaciones registradas en el período
                                    </Text>
                                )}
                            </CardContent>
                        </Card>

                        <Button onPress={generarPDF} variant="outline" className="w-full" disabled={isGeneratingPDF}>
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
                    </>
                )}
            </View>

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
