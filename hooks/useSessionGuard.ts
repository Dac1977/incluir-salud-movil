import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { supabase, getSessionWithTimeout } from '../lib/supabase';
import { connectivityService } from '../services/connectivityService';

const BACKUP_KEY = 'session_user_backup';

/**
 * Reemplaza el patrón repetido de getSession + onAuthStateChange en las pantallas.
 * Evita que un JWT vencido sin internet desloguee al usuario y lo mande al login.
 *
 * Casos cubiertos:
 * 1. Runtime offline SIGNED_OUT: JWT expira mientras la app está abierta sin internet
 *    → Mantiene la sesión en memoria (lastSession ref) y no redirige.
 * 2. Cold-start offline: app reiniciada con JWT expirado sin internet
 *    → Lee backup de AsyncStorage y reconstruye sesión mínima para no redirigir.
 */
export function useSessionGuard(onNoSession: () => void) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSession = useRef<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // getSession() puede intentar refrescar el JWT contra el servidor; sin conexión
      // esa llamada puede quedar colgada indefinidamente. Con timeout, si no responde a
      // tiempo la tratamos directamente como "sin conexión" y seguimos el flujo offline.
      const { session: current, timedOut } = await getSessionWithTimeout();

      if (cancelled) return;

      if (current) {
        lastSession.current = current;
        // Guardar backup del usuario para cold-start offline
        await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify({ user: current.user })).catch(() => {});
        setSession(current);
        setLoading(false);
        return;
      }

      // No hay sesión activa (o no se pudo confirmar a tiempo) — verificar si estamos offline con backup
      const isOnline = timedOut ? false : await connectivityService.isOnline();
      if (!isOnline) {
        try {
          const raw = await AsyncStorage.getItem(BACKUP_KEY);
          if (raw) {
            const { user } = JSON.parse(raw);
            // Reconstruir sesión mínima (sin JWT válido, pero suficiente para offline)
            const offlineSession = { user, access_token: '', token_type: 'bearer' } as unknown as Session;
            lastSession.current = offlineSession;
            setSession(offlineSession);
            setLoading(false);
            console.log(timedOut
              ? '📡 Timeout verificando sesión (sin conexión): sesión offline restaurada desde backup'
              : '📡 Sesión offline restaurada desde backup (JWT expirado sin internet)');
            return;
          }
        } catch {
          // Sin backup → redirigir al login
        }
      }

      // Online sin sesión, o offline sin backup → redirigir
      setLoading(false);
      onNoSession();
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        lastSession.current = session;
        await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify({ user: session.user })).catch(() => {});
        setSession(session);
        return;
      }

      if (event === 'SIGNED_OUT') {
        const isOnline = await connectivityService.isOnline();

        if (!isOnline && lastSession.current) {
          // JWT expiró sin internet — mantener sesión en memoria, no redirigir
          console.log('📡 SIGNED_OUT offline detectado — manteniendo sesión (JWT expirado sin internet)');
          return;
        }

        // Logout real o expiración con internet → limpiar backup y redirigir
        await AsyncStorage.removeItem(BACKUP_KEY).catch(() => {});
        setSession(null);
        onNoSession();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
