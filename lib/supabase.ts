
import { Database } from '@/database.types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, processLock, Session } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

export const supabase = createClient<Database>(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_KEY!,
    {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            lock: processLock,
        },
    })

const GET_SESSION_TIMEOUT_MS = 5000

/**
 * supabase.auth.getSession() intenta refrescar el JWT contra el servidor cuando está
 * vencido. Ese refresh no tiene timeout propio: sin conexión (o con conectividad
 * "fantasma", wifi sin salida a internet, etc.) la promesa puede quedar colgada de forma
 * indefinida, dejando a la UI atascada en una pantalla de carga.
 *
 * Esta función le pone un límite de tiempo. Si se cumple, devuelve `timedOut: true` para
 * que el caller pueda tratarlo como "sin conexión" y seguir el flujo offline (sesión
 * cacheada), en vez de quedar esperando para siempre.
 */
export async function getSessionWithTimeout(
    timeoutMs: number = GET_SESSION_TIMEOUT_MS
): Promise<{ session: Session | null; timedOut: boolean }> {
    let timeoutHandle: ReturnType<typeof setTimeout>

    const timeout = new Promise<{ session: null; timedOut: true }>((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ session: null, timedOut: true }), timeoutMs)
    })

    const sessionPromise = supabase.auth.getSession().then(({ data: { session } }) => {
        clearTimeout(timeoutHandle)
        return { session, timedOut: false as const }
    })

    return Promise.race([sessionPromise, timeout])
}
