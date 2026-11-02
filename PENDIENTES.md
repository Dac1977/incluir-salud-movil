# Tareas pendientes de implementación

> Estado verificado contra el código y la DB el 23/09/2026.

---

## 0. IMPORTANTE: nada de esto está publicado todavía

Los cambios de las tareas 5, 6, 7 y los de esta sección están **solo en el working tree local** (`git status` los muestra como modificados, sin commit). Para que lleguen a los profesionales hay que:

1. `git add` + commit.
2. `eas update --channel production` (o el canal correspondiente) — son cambios JS/TS, compatibles con OTA, no requieren build nueva.

---

## 8. Timeout en consultas de lectura (pantalla en blanco con "internet sin crédito")

**Estado: ✅ IMPLEMENTADO (23/09/2026).**

**Caso real:** una usuaria con AT reportó que la app quedaba en blanco. El celular mostraba conexión activa en la captura, pero sin crédito el carrier no rechaza los paquetes — los "traga". `NetInfo.isInternetReachable` puede dar falso positivo (portal cautivo) y la app entra al camino online; el `await supabase.rpc(...)` queda colgado indefinidamente con `setLoading(true)` activo → pantalla en blanco sin límite de tiempo.

**Cambio:** agregado `conTimeout()` en `services/prestacionService.ts` (constructor de la clase) — corre la consulta con un límite de 15s vía `Promise.race`; si se excede, rechaza y el `catch` existente cae al fallback de cache ya implementado (no se agregó lógica de fallback nueva).

**Aplicado a las 4 lecturas que alimentan pantallas:** `obtenerPrestacionesDelDia`, `obtenerPrestacionesPorRango` (semana/mes/rango), `obtenerPrestacionesPendientesCentro`, `obtenerPrestacionesPerdidasAyer`.

**Deliberadamente NO aplicado a escrituras** (`cerrarPrestacionDomicilio`, `iniciarPrestacionDomicilio`, `cerrarPrestacionConValidacion`, `validarSeleccionadas`): si la escritura llegó al servidor pero la respuesta tardó más de 15s, cortar el `await` podría hacer que la app reintente o encole offline una operación que ya se aplicó → riesgo de duplicado. Queda pendiente evaluarlo con más cuidado (timeout más largo + verificación de estado antes de reintentar) si se repiten los reportes de colgado también al cerrar/iniciar.

---

## 9. Scroll en el diálogo de cierre con motivo (anticipado / fuera de rango)

**Estado: ✅ IMPLEMENTADO (23/09/2026).** El diálogo de "cerrar con motivo" (`cierreAnticipadoModalOpen` en `CompletarPrestacionModal.tsx`, usado tanto para duración insuficiente como para fuera de rango) ya tenía `KeyboardAvoidingView`; se le agregó `ScrollView` (con `keyboardShouldPersistTaps="handled"`) envolviendo el contenido para que en pantallas chicas con teclado abierto el botón "Cerrar con motivo" no quede inalcanzable.

---

## 10. Bugs encontrados con el caso de Geraldine Villanueva (11/09, Pablo Quiroga)

**Contexto:** un "Iniciar" tocado offline el 17/09 a medianoche sobre una prestación vencida del 11/09 sincronizó recién el 18/09 al mediodía, dejándola `en_proceso` sin salida.

**Resueltos manualmente en DB (23/09/2026):**
- Cron `cerrar_prestaciones_abiertas_23_59` cambiado de `=` a `<=` en la comparación de fecha — ahora cierra a las 23:59 cualquier `en_proceso` de AT/Kine con `started_at` de hoy **o anterior**, no solo las del mismo día.
- La prestación del 11/09 (`3cb2fda0...`) se pasó a `cancelada` con nota de auditoría.

**Pendientes de código (no implementados):**
- El sync offline de `iniciar_domicilio` aplica el cambio a `en_proceso` sin verificar el estado actual de la prestación en el servidor — si mientras estaba encolada la prestación fue cancelada/completada por otro medio (cron, backoffice), el sync la "resucita" a `en_proceso`. Fix: verificar `estado = 'pendiente'` antes de aplicar el `iniciar_domicilio` encolado.

**Descartado (31/10):** se había anotado como bug que `verificarLimiteCompletadasHoy` compara contra la fecha actual en vez de contra `prestacion.fecha` — **es el comportamiento correcto, no un bug**. La regla de negocio es "una completada por paciente por día calendario real", sin importar a qué día estaba programada: si hoy cerrás la de ayer de un paciente, debe bloquear la de hoy del mismo paciente. Cambiarlo rompería esa regla.

---

## 1. Control de duración de prestaciones (domicilio)

**Estado: ✅ IMPLEMENTADO.** Se deja como referencia.

- Botón "Iniciar" con geo-validación en domiciliarias (`prestaciones.tsx` → `handleIniciarPrestacion` → `iniciarPrestacionDomicilio`), setea `started_at`.
- Cierre exige duración mínima: 30 min Kine / 40 min AT (`cerrarPrestacionDomicilio`), con opción de "cierre anticipado" con motivo (`forzarCierre`).
- Horas acumuladas del mes por paciente en el listado (`obtenerHorasAcumuladasMes`).
- No aplica a Transporte (flujo separado).

---

## 2. Jornadas en residencias (geriátricos)

**Estado: ✅ IMPLEMENTADO** — salvo el saldo de horas autorizadas (opcional, pendiente).

- Tabla `jornadas_residencia` existe en DB.
- `services/jornadaService.ts` completo: `iniciarJornada`, `finalizarJornada`, `obtenerJornadaActivaHoy`, `obtenerHorasJornadasMes`, sync offline.
- `validar-centro.tsx`: banner de jornada con tiempo transcurrido y horas del mes; al validar las prestaciones del centro también cierra la jornada.

**Pendiente (opcional):** saldo de horas — "usadas vs. autorizadas" por residencia. Requiere tabla `autorizaciones_residencia` (`user_id | centro_id | mes | año | horas_autorizadas`) que **no existe en DB**.

---

## 3. Manejo de sesión offline (JWT vencido sin internet)

**Estado: ✅ IMPLEMENTADO.** Se deja como referencia.

- `hooks/useSessionGuard.ts`: si llega `SIGNED_OUT` sin internet mantiene la sesión en memoria y no redirige al login; en cold-start offline reconstruye sesión desde backup en `AsyncStorage` (`session_user_backup`).

---

## 4. Ubicaciones en backoffice

**Estado: ✅ IMPLEMENTADO.** Se deja como referencia.

- `ubicacion_cierre` y `distancia_validacion` se guardan.
- `PrestacionesTable.tsx` (backoffice) ya las muestra: diálogo con distancia (m), lat/lng y link "Ver en Google Maps".

---

## 5. Bloquear prestaciones domiciliarias en paralelo (una sola `en_proceso` a la vez)

**Estado: ✅ IMPLEMENTADO (17/09/2026).** En `iniciarPrestacionDomicilio` el chequeo de `en_proceso` ahora es global por usuario (excluye `Transporte`); muestra el nombre del paciente de la prestación activa en el mensaje.

**Contexto (caso real verificado 16/09/2026):** la kinesióloga Noelia Manzanarez completó dos prestaciones domiciliarias de pacientes distintos en simultáneo — Costa (inició 11:47:20, cerró 12:18:59) y Ogas (inició 11:47:57, cerró 12:19:18), cerradas a ~16 m de distancia GPS. Las dos cumplieron el mínimo de 30 min corriendo en paralelo.

**Regla de negocio:** las prestaciones domiciliarias son individuales — no se puede hacer dos a la vez **aunque los pacientes validen en el mismo lugar**.

**Estado actual:** en `services/prestacionService.ts` → `iniciarPrestacionDomicilio` las validaciones de duplicado son solo **por paciente** (mismo `paciente_id`): no otra `en_proceso` del mismo paciente y no otra completada hoy del mismo paciente. Nada impide `en_proceso` paralelas de pacientes distintos.

**Cambio propuesto:**
- En `iniciarPrestacionDomicilio`, además del chequeo por paciente, verificar que el usuario no tenga **ninguna** prestación `en_proceso` (cualquier paciente). Si hay → `"Ya tenés una prestación en proceso. Cerrala antes de iniciar otra."`
- Solo aplica a domiciliarias. **No tocar el flujo de centros** (`validar_prestaciones_centro` valida en lote `pendiente`/`en_proceso` → `completada`, no usa `iniciarPrestacionDomicilio`) ni el de transporte (`iniciar_prestacion_transporte`, RPC separada).

**Notas / edge cases:**
- Una prestación de centro iniciada individualmente (sin jornada activa) cuenta como "la activa" y bloquea iniciar otra — se resuelve cerrándola o validándola en centro.
- Si queda una `en_proceso` colgada (crash de la app), el AT no puede iniciar otra hasta resolverla. Salvavidas existentes: cierre anticipado (`forzarCierre`), cierre fuera de rango (tarea 6) y el cron `cerrar_prestaciones_abiertas_23_59` que cierra las `en_proceso` de AT/Kine a las 23:59 del mismo día.
- Los chequeos solo corren online (`if (isOnline && ...)`); offline se mantiene como hoy (sin validación). Opcional: chequear también contra el cache local.
- Decidir si el chequeo debe ignorar prestaciones de tipo `Transporte` `en_proceso` del mismo usuario (hoy los transportes los hacen choferes, pero por las dudas).

---

## 6. Cerrar prestación domiciliaria fuera del radio permitido (con motivo)

**Estado: ✅ IMPLEMENTADO (17/09/2026).** `cerrarPrestacionDomicilio` devuelve `FUERA_DE_RANGO|{dist}` cuando la kine está a >50 m; con `forzarCierre` se omite el chequeo pero se guarda `distancia_validacion` real y `notas` con `[CIERRE FUERA DE RANGO]` (online y en el sync offline). El modal reusa el diálogo de motivo con variante "Fuera del domicilio".

**Decisión (17/09/2026):** autoservicio — el profesional cierra con motivo obligatorio y queda `completada`; desde el backoffice se revisa después si corresponde dejarla completada o revertirla.

**Problema:** hoy solo **Kinesiología** valida ubicación al cerrar (≤50 m del domicilio del paciente o de su `ubicacion_sugerida`, en `cerrarPrestacionDomicilio`, `services/prestacionService.ts` ~línea 1272). Si está fuera de rango **no tiene salida**: el "cierre anticipado" (`forzarCierre`) solo saltea la duración mínima, NO el chequeo de ubicación. La prestación queda `en_proceso` hasta las 23:59 (cron `cerrar_prestaciones_abiertas_23_59`). Combinado con la tarea 5, una `en_proceso` trancada le bloquea el resto del día.
- AT no tiene este problema: `cerrarPrestacionDomicilio` no chequea ubicación para AT y el RPC `cerrar_prestacion_con_validacion` tampoco le exige distancia (`v_es_at` saltea el chequeo).

**Cambios en `services/prestacionService.ts` → `cerrarPrestacionDomicilio`:**
- Cuando el chequeo de ubicación Kine falle, devolver código `FUERA_DE_RANGO|{distancia}` (mismo patrón que `DURACION_INSUFICIENTE|{mins}|{min}`).
- Hacer el bloque `if (esKine)` de ubicación condicional a `!forzarCierre` (igual que la duración).
- Con `forzarCierre`, guardar evidencia auditable:
  - `ubicacion_cierre` real (ya se guarda)
  - `distancia_validacion` = distancia real (hoy este camino NO la setea; el RPC sí)
  - prefijo `[CIERRE FUERA DE RANGO] {motivo}` en `notas` — distinto de `[CIERRE ANTICIPADO]` (que es por duración) para poder filtrarlas.

**Cambios en `components/CompletarPrestacionModal.tsx`:**
- Manejar `FUERA_DE_RANGO|...` → abrir el mismo diálogo de motivo obligatorio que usa cierre anticipado (reusar `cierreAnticipadoModalOpen`/`handleConfirmarCierreAnticipado`), con texto acorde: "Estás a X m del domicilio. ¿Cerrar de todas formas? Indicá el motivo."
- El motivo ya es obligatorio (`disabled={!motivoCierreAnticipado.trim()}`).

**Revisión desde backoffice:** ver item "Filtro de cierres excepcionales" en el `PENDIENTES.md` del backoffice.

**Edge cases:**
- Offline: la cola `cerrar_domicilio` ya guarda `notas` — el prefijo viaja igual al sincronizar.
- El límite de 1 completada por paciente por día (`verificarLimiteCompletadasHoy`) se sigue aplicando — no se saltea con `forzarCierre`.
- El flujo estándar (pendiente → completada vía RPC) también exige 50 m para Kine sin override, pero una `pendiente` no bloquea nada — queda para evaluar si se extiende ahí también.

---

## 7. Avisar al finalizar jornada si quedan prestaciones sin validar

**Estado: ✅ IMPLEMENTADO (17/09/2026).** En `validar-centro.tsx`, tanto "Finalizar jornada" como el cierre automático post-validación piden confirmación si quedan prestaciones del día seleccionables sin validar: "Quedan X sin validar... se cancelan a los 7 días" → "Volver" / "Cerrar igual".

**Contexto (casos reales):**
- **Tommasiello 04/09:** cerró la jornada en "Revivir" pero las 7 prestaciones quedaron `pendiente` → el cron `cancelar_prestaciones_vencidas` las canceló el 12/09.
- **Erika Ceballos 16/09:** cerró la jornada en Futakeche (2) a las 21:28 pero las 3 prestaciones quedaron `pendiente` (corregidas manualmente desde la DB el 17/09).

**Causa:** en `app/(dashboard)/validar-centro.tsx` → `handleFinalizarJornada`, la validación de prestaciones solo corre `if (selectedIds.size > 0)`. Si el AT finaliza con la selección vacía (las destildó o la lista no cargó), la jornada se cierra igual y las prestaciones quedan `pendiente` **sin ningún aviso**.

**Cambio propuesto:**
- Al tocar "Finalizar jornada", contar las prestaciones del día en `pendiente`/`en_proceso` que **no** están seleccionadas.
- Si hay → confirmación: "Quedan X prestaciones sin validar. Si cerrás la jornada van a quedar pendientes y se cancelan a los 7 días." Opciones: "Volver y validarlas" / "Cerrar igual".
- Offline: revisar también que `sincronizarPrestacionesOffline` no pueda sincronizar el cierre de jornada sin su `centro_validar` correspondiente (jornada y validación viajan en colas separadas — caso Tommasiello, donde la jornada sincronizó y la validación no).

**Edge cases:**
- Si las destildó a propósito (paciente ausente), el aviso aparece igual pero se puede confirmar el cierre.

---

## 11. Sistema de tickets de soporte (reemplaza el botón "Llamar")

**Estado: ⏳ Pendiente — diseño definido, falta implementar.**

**Problema actual:** en `CompletarPrestacionModal.tsx`, el botón "Contactar Soporte" (`handleContactSupport` → modal → `handleCall`) usa `Linking.openURL('tel:+5491123456789')` — abre el marcador del teléfono para **llamar**, con un número que además parece un placeholder. No se quiere que el soporte sea telefónico.

**Decisión:** reemplazar por un sistema de tickets propio (no WhatsApp, no email como canal del profesional) — el profesional escribe una consulta desde la app, queda registrada y visible/gestionable desde el backoffice.

### Modelo de datos (DB)

- Tabla `tickets_soporte`: `id`, `user_id` (quién reporta), `categoria`/`asunto`, `mensaje`, `estado` (`abierto` / `en_proceso` / `resuelto` / `cerrado`), `leido` (boolean, para el contador de no leídos), `prestacion_id`/`jornada_id` (nullable, para adjuntar contexto si se reporta desde una pantalla puntual), `created_at`, `updated_at`.
- Opcional a futuro: tabla `tickets_mensajes` si se quiere que sea una conversación en vez de un mensaje único.
- RLS: el profesional solo ve/crea sus propios tickets; el backoffice (admin) ve todos.

### App móvil

- Reemplazar el modal de "Contactar Soporte": en vez de "Llamar"/"Cancelar", un formulario (categoría + texto) que inserta en `tickets_soporte`.
- Si se abre desde el modal de completar prestación, adjuntar automáticamente `prestacion_id` como contexto.
- Confirmación visual al enviar ("Tu consulta fue enviada").
- Debe funcionar offline: encolar en AsyncStorage y sincronizar cuando vuelva la conexión (mismo patrón que las demás acciones offline).
- Opcional: pantalla "Mis consultas" para que el profesional vea el estado de lo que reportó.

### Backoffice

- Nueva sección "Tickets de soporte": listado con filtro por estado/usuario/fecha, vista de detalle, cambio de estado, marcar como leído.
- **Notificación al equipo (decidido):**
  1. **Email automático** cuando se crea un ticket nuevo — vía Supabase database webhook/trigger que llama a una función (ej. Edge Function) que dispara el email con un proveedor (Resend/SendGrid u otro que ya usen, verificar si hay uno integrado).
  2. **Contador de no leídos en el backoffice**: al entrar, mostrar un badge/apartado con la cantidad de tickets con `leido = false` (o `estado = 'abierto'`), visible en el layout principal o dashboard — mismo patrón que un contador de notificaciones.

### Tamaño

Comparable a la tarea de "subtipos de prestación" — no es un cambio chico: tabla nueva + RLS, flujo nuevo en la app (con manejo offline), sección CRUD nueva en backoffice, y la función/trigger de email. Factible, pero es su propio feature.
