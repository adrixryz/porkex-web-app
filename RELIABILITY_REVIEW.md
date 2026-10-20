# Verificación de confiabilidad de Porkex

Fecha: 17 de octubre de 2026. Alcance: E01–E14 y F01–F09. N01–N06 excluidos.
Uso personal, un dispositivo activo; Vue, Express y Turso se conservan.

## Resultado y límites

Los 23 puntos tienen implementación y comprobaciones locales. No se hizo push,
despliegue ni modificación de Turso real. Las bases usadas por las pruebas son
temporales y el harness impide heredar una URL/token de Turso.

La ejecución local usó Windows y Node 26.1.0. Ambos workflows usan Node 24;
el del backend incluye Linux y Windows. Los workflows están configurados,
pero no se ejecutaron en GitHub durante este trabajo.

## Matriz de cierre

“OK local” expresa el alcance probado, no una validación del despliegue.
Los archivos de backend citados pertenecen a `../porkex-backend`.

| ID  | Cambio aplicado                                                                                                                              | Prueba/evidencia                                                                                                                                                                                       | Resultado                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| E01 | La cola se relee tras cada envío y se modifica solo su operación por ID.                                                                     | `outbox.spec.ts`: encolar mientras un envío está en curso conserva y envía ambas entradas.                                                                                                             | OK local                                                       |
| E02 | Escrituras pendientes y nuevas pasan por el mismo bloqueo de envío, en orden.                                                                | `api.spec.ts`: edición antigua antes de la nueva; navegador: dos pestañas con escrituras lentas, concurrencia máxima 1.                                                                                | OK local                                                       |
| E03 | El 202 requiere persistencia; fallos de almacenamiento mantienen el formulario abierto y muestran el error.                                  | Cola/API: cuota, JSON corrupto y falta de Web Locks; navegador: cuota agotada sin éxito falso; ambos formularios reutilizan clientId al reintentar.                                                    | OK local                                                       |
| E04 | Un 401 conserva pendientes; únicamente DELETE acepta 404 como completado. Los rechazos bloquean cambios posteriores.                         | Cola/API: 401, PUT/DELETE 404, rechazo y dependencias; navegador: bloqueo, cancelar descarte, descarte explícito y posterior DELETE.                                                                   | OK local                                                       |
| E05 | Zona IANA en peticiones; día local representado en UTC; compatibilidad sin cabecera con Lima y rechazo de zona inválida.                     | Backend `calendar-money`/`reliability`: Lima desde las 19:00, medianoche, DST y cabecera inválida; navegador confirma `America/Lima`.                                                                  | OK local                                                       |
| E06 | Confirmación común invalida cachés y revalida vistas, también después de reenvíos.                                                           | API: varios reenvíos emiten una revalidación; navegador e integración real: aparece el movimiento confirmado sin recargar el componente.                                                               | OK local                                                       |
| E07 | Web Locks separa exclusión de envío y cambios breves del almacenamiento, sin caducidad temporal.                                             | Cola: petición que supera la antigua duración del lease; navegador: dos pestañas y respuestas lentas sin envíos concurrentes.                                                                          | OK local                                                       |
| E08 | Cursor persistente de última ocurrencia; cambios hacia adelante; no se recrean ocurrencias borradas ni pausas.                               | Backend `recurring`/`reliability`: borrar, editar, cambiar calendario, pausar/reanudar, conservar nextDate y aplicar importes futuros.                                                                 | OK local                                                       |
| E09 | Cambiar tipo de categoría valida también las reglas asociadas.                                                                               | Backend `reliability`: categoría sin movimientos pero con regla futura incompatible devuelve 400.                                                                                                      | OK local                                                       |
| E10 | Validación estricta de fechas calendario e ISO.                                                                                              | Backend `calendar-money`/`reliability`: 31 de febrero, fecha no bisiesta, filtros inválidos, ISO válido con offset y bisiesto válido.                                                                  | OK local                                                       |
| E11 | Importes con tipo y precisión válidos; cálculos en centavos y límites existentes.                                                            | Backend `money`/`calendar-money`/`reliability`: booleanos, arrays, objetos, no finitos, precisión excesiva, cadenas y límites.                                                                         | OK local                                                       |
| E12 | Caché asociada a la consulta; otra consulta sin caché no conserva filas anteriores; datos fallidos quedan desactualizados.                   | `useAsyncData.spec.ts`: cambio de clave, respuestas tardías, sesión y desmontaje; navegador: cambiar filtros offline y consulta sin caché.                                                             | OK local                                                       |
| E13 | CRUD distingue confirmado de pendiente; contraseñas no entran en la cola.                                                                    | Revisión de todos los CRUD y helper compartido; API: contraseña offline no persistida; navegador/integración: mensaje pendiente y posterior confirmación.                                              | OK local                                                       |
| E14 | URL y filtros se restauran en ambos sentidos, incluidos valores ausentes; selectores/paginación usan push y búsqueda replace.                | Navegador: Atrás/Adelante en movimientos y rangos de Analytics, búsqueda y restablecimiento de valores ausentes.                                                                                       | OK local                                                       |
| F01 | Snapshot SQLite completo desde una transacción de lectura, verificado antes de publicar; restauración técnica y procesos hijos para Windows. | Backend `backup`: esquema, tipos SQL, NUL/BLOB, fechas, IDs, secuencias, índices/restricciones, restauración y errores; no sobrescribe el destino.                                                     | OK SQLite local; Turso real pendiente                          |
| F02 | Recuperación agrupada al volver/conectar; reintentos visibles 5/15/30/60 s; pausa sin autenticación; revisión de día/zona.                   | `recovery.spec.ts`: agrupación, esperas, reconexión, visibilidad, sesión, éxito y cambio de día; navegador: reconectar sin perder un borrador.                                                         | OK local                                                       |
| F03 | Worker en espera; aviso Update/Later y protección de formularios/escrituras; fallo de bundle ofrece actualizar.                              | `UpdateNotice`/`useUnsavedChanges`: formularios, peticiones y activación externa; navegador: worker real esperando, Later, actualización explícita y evento de bundle obsoleto.                        | OK PWA local y emulación; despliegue/Android físico pendientes |
| F04 | Lotes transaccionales, ejecución compartida por usuario/día y cabecera ready/pending/failed.                                                 | Backend `reliability`: lotes incompletos, próxima pasada, fallo inducido y rollback; pruebas concurrentes; navegador: aviso desaparece tras recuperar sin cerrar borrador.                             | OK local                                                       |
| F05 | Migraciones ordenadas con checksum, adopción validada y rollback; normalización explícita de almacenamiento UTC antiguo.                     | Backend `migrations`: base nueva/actual/variante sin FK, repetición, checksum alterado, drift desconocido, fallo de datos, fechas mixtas y filtros reales con Prisma. `db:check` coincide con modelos. | OK temporal; aplicación productiva pendiente                   |
| F06 | Registro cerrado por defecto, configuración pública y Sign Up condicionado.                                                                  | Backend `registration`: cerrado, cuenta existente y habilitación explícita; Login unitario y navegador con registro cerrado.                                                                           | OK local                                                       |
| F07 | Pruebas de regresión, navegador con API controlada, integración local real y CI Node 24 con lint/tipos/pruebas/build.                        | Suites backend/frontend, Chromium escritorio/Pixel 7, PWA de producción y SQLite temporal; workflows revisados.                                                                                        | OK local; CI remoto pendiente                                  |
| F08 | Harness sin npx/shell, preparación con migraciones, base temporal aislada, diagnóstico y limpieza al terminar procesos.                      | Backend `harness`: credenciales heredadas ignoradas y limpieza ante preparación fallida; 22 suites ejecutadas en Windows.                                                                              | OK Windows local; Linux por CI pendiente                       |
| F09 | nodemon retirado; watch nativo de Node con ts-node.                                                                                          | package/lock revisados; lint, tipos y build pasan; auditoría de dependencias de producción sin vulnerabilidades reportadas.                                                                            | OK local                                                       |

## Comandos y evidencias

Backend:

```text
npm test                 22/22 suites
npm run lint             OK
npm run typecheck        OK
npm run db:check         OK; no conecta a la base configurada
npm run build            OK
npm audit --omit=dev     0 vulnerabilidades reportadas
```

Frontend:

```text
npm test -- --maxWorkers=2   213 pruebas unitarias
npm run lint                OK
npm run typecheck           OK; incluye pruebas de navegador
npm run build               OK; genera manifest y service worker
npm run test:browser        24 pruebas: 12 escritorio + 12 emulación Android
npm run test:integration    2 pruebas con backend real + SQLite temporal
```

Las pruebas del worker usan el build de producción servido en localhost y un
cambio controlado de versión de `sw.js`. La recuperación de bundles obsoletos
se comprueba mediante su evento de fallo; esto no simula un despliegue real
que elimine assets. La emulación Android usa Chromium en Windows, sin instalar
la aplicación en un teléfono físico. Edge no se ejecutó por separado.

## Commits locales

Backend, en orden:

| Hash      | Título                                 |
| --------- | -------------------------------------- |
| `622fe1c` | fix: reliable database backups         |
| `eea931b` | fix: versioned schema migrations       |
| `bdcfdf1` | fix: validation and recurring dates    |
| `1211dc1` | fix: disable public registration       |
| `758a898` | fix: handle legacy recurring dates     |
| `4b22b57` | fix: normalize legacy UTC date storage |
| `88cf781` | chore: simplify dev and test setup     |

Frontend, en orden:

| Hash             | Título                                                    |
| ---------------- | --------------------------------------------------------- |
| `9094e9d`        | fix: reliable offline writes                              |
| `912de3c`        | fix: cache refresh and filter history                     |
| `5074bd7`        | fix: respect registration settings                        |
| `aea6811`        | fix: safe PWA updates                                     |
| Ver `git log -1` | test: cover offline and PWA recovery; incluye esta matriz |

Las dos correcciones adicionales del backend cubren la mezcla real de INTEGER
y TEXT en fechas heredadas: comparaciones de recurrentes y normalización UTC
transaccional. No se simplificó la validación de esquema para ocultar variantes
desconocidas: se rechazan antes de modificar datos.

## Comprobaciones posteriores a la revisión

- Despliegue: obtener y verificar respaldo antes de aplicar migraciones; seguir
  el procedimiento del README del backend. Aquí no se ejecutó contra Turso.
- Verificar CORS/cabeceras, conexión real Render–Turso y restauración del respaldo
  de la cuenta en una base de reemplazo, sin reemplazar la base activa sin revisión.
- Android físico: instalación, actualización tras despliegue y recuperación al
  volver desde segundo plano; repetir en Edge de PC si es un cliente habitual.
- Ejecutar los workflows Node 24 cuando decidas hacer push.
