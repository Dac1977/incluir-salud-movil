import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase, getSessionWithTimeout } from '../lib/supabase';
import { Text } from '../components/ui/text';
import { choferService } from '../services/choferService';
import { deviceService } from '../services/deviceService';
import { connectivityService } from '../services/connectivityService';

const BACKUP_KEY = 'session_user_backup';

export default function IndexPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obtener sesión actual y manejar redirección
    const init = async () => {
      // getSession() puede intentar refrescar el JWT contra el servidor; sin conexión
      // esa llamada puede quedar colgada indefinidamente. Con timeout, si no responde a
      // tiempo la tratamos directamente como "sin conexión" y seguimos el flujo offline.
      const { session, timedOut } = await getSessionWithTimeout();

      if (session) {
        deviceService.registerDevice().catch(console.error);
        // Guardar backup para cold-start offline
        await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify({ user: session.user })).catch(() => {});
        const path = await choferService.getLandingRoute();
        router.replace(path);
        setLoading(false);
        return;
      }

      // Sin sesión (o no se pudo confirmar a tiempo) — verificar si estamos offline con backup previo
      const isOnline = timedOut ? false : await connectivityService.isOnline();
      if (!isOnline) {
        try {
          const raw = await AsyncStorage.getItem(BACKUP_KEY);
          if (raw) {
            // Hay backup → ir al dashboard en modo offline
            console.log(timedOut
              ? '📡 Timeout verificando sesión (sin conexión): redirigiendo al dashboard con backup'
              : '📡 Cold-start offline: redirigiendo al dashboard con backup');
            const path = await choferService.getLandingRoute();
            router.replace(path);
            setLoading(false);
            return;
          }
        } catch {}
      }

      // Sin sesión y sin backup → login
      router.replace('/login');
      setLoading(false);
    };

    init();

    // Escuchar cambios de autenticación durante esta pantalla
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        deviceService.registerDevice().catch(console.error);
        choferService.getLandingRoute().then((path) => router.replace(path));
      }
      // SIGNED_OUT se maneja en useSessionGuard dentro del dashboard
    });

    return () => subscription.unsubscribe();
  }, []);

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <View className="items-center px-8 gap-4">
          {/* Logo de Incluir Salud */}
          <Image
            source={require('../assets/incluir_salud_iconwebp.png')}
            className="w-24 h-24 mb-4"
            resizeMode="contain"
          />

          {/* Nombre de la app */}
          <Text variant="h1" className="text-blue-500 font-bold text-center">
            Incluir Salud
          </Text>

          {/* Subtítulo */}
          <Text variant="small" className="text-muted-foreground text-center">
            Plataforma de gestión médica
          </Text>

          {/* Texto de carga */}
          <Text variant="small" className="text-muted-foreground text-center mt-4">
            Verificando autenticación...
          </Text>
        </View>
      </View>
    );
  }

  // Esta página no debería renderizarse nunca después del loading
  // porque siempre redirige, pero por si acaso:
  return (
    <View className="flex-1 bg-background justify-center items-center">
      <View className="items-center px-8 gap-4">
        <Image
          source={require('../assets/incluir_salud_iconwebp.png')}
          className="w-24 h-24"
          resizeMode="contain"
        />
        <Text variant="h2" className="text-blue-500 font-bold text-center">
          Incluir Salud
        </Text>
        <Text variant="muted" className="text-muted-foreground">
          Redirigiendo...
        </Text>
      </View>
    </View>
  );
}

