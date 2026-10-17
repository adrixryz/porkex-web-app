# Verificación de nuevas funcionalidades

Implementación local del 17 de octubre de 2026. Alcance: uso personal, un dispositivo activo, UTC interno y días calendario según la zona del dispositivo. No se realizó push, despliegue ni modificación de Turso real.

## Matriz de cierre

| Requisito | Cambio aplicado | Evidencia | Resultado local |
|---|---|---|---|
| Deshacer al borrar | Snackbar global **Deshacer** durante 8 segundos; varios borrados se agrupan y renuevan la ventana. Se conserva el ID original. | `undoDelete.spec.ts`; navegador: cancelar, navegar, recargar, expirar y publicar una sola vez. | Aprobado |
| Borrado duradero y offline | Registro separado del outbox, persistencia antes de ocultar, transferencia idempotente, Web Locks, aislamiento por cuenta y protección durante escrituras. | Unitarias: cuota al programar/publicar, reintento, cuenta distinta. Navegador: deshacer desde otra pestaña; integración con SQLite real. | Aprobado |
| Saltar próxima ocurrencia | Acción ligada a regla y fecha exacta, registro persistente y avance una sola vez; no cambia la plantilla. | `occurrences.test.mjs`: reintento, histórico borrado, reprogramación anterior y regreso a la fecha saltada; navegador e integración. | Aprobado |
| Editar solo la próxima | Importe, categoría del mismo tipo, Comment y 0–5 tags; fecha bloqueada, indicador de excepción y conservación de la plantilla. | `TransactionDialog.spec.ts`, `occurrences.test.mjs`, navegador e integración real. | Aprobado |
| Conflictos y materialización | Un destino cambiado devuelve conflicto; excepciones se aplican transaccionalmente al generar el movimiento. Editar/borrar el movimiento procesado no lo recrea. | Pruebas de ocurrencias: materialización real, replay procesado y movimiento eliminado. | Aprobado |
| Year vs year | Año elegido frente al anterior, totales de ingresos/gastos/balance y gráfico mensual. Año actual: mismo tramo calendario transcurrido. | `comparison.test.mjs`: API, años bisiestos, centavos, aislamiento y períodos futuros; gráfico con datos en integración. | Aprobado |
| Week vs week | Semana elegida frente a la anterior, inicio de semana configurado, gráfico diario y tramo transcurrido equivalente. | Pruebas de comparación: cambio de año y comienzos de semana. Navegador: selector e historial. | Aprobado |
| Comparativas vacías y navegación | Bases cero explícitas, sin porcentajes infinitos; filtros propios conservan months/days y funcionan con Atrás/Adelante. | Pruebas unitarias/backend y navegador con API controlada. | Aprobado |
| Description → Comment opcional | Interfaz actualizada; crear/editar sin comentario. Compatibilidad con description en API, base e instrucciones pendientes antiguas. | `tags.test.mjs`, pruebas de formulario, navegador offline e integración real. | Aprobado |
| Catálogo de tags | Nombres de 1–20 caracteres Unicode, orden manual, nombres equivalentes sin duplicación, referencias estables para reintentos offline. | `tags.test.mjs`: validaciones, aliases, pertenencia, orden y reintentos; navegador offline. | Aprobado |
| Selección de tags | Píldoras seleccionables/deseleccionables, sin X; máximo cinco por movimiento, incluyendo próximas ocurrencias editadas. | `TagPicker.spec.ts`; validaciones backend; navegador e integración. | Aprobado |
| Edit tags | Modal anidado con lápiz: agregar con Enter/teclado móvil, renombrar, borrar globalmente con confirmación. Conserva el formulario del movimiento. | Navegador: CRUD completo sin perder borrador; eliminación global conserva movimientos. | Aprobado |
| Orden manual de tags | Mantener presionado el jalador y arrastrar; teclado con flechas como alternativa. Guarda el orden y lo aplica al catálogo/píldoras. | API: orden persistido; navegador: arrastre con mouse y eventos táctiles CDP en emulación Android. | Aprobado |
| Modales de income/expense | Amount y Date en primera fila; categoría con color, Comment y tags en filas siguientes. Tags envuelven sin desbordamiento y Edit tags queda al final. | Formulario y capturas revisadas a 320 px; pruebas de límites de los campos y CRUD. | Aprobado |
| Tabla Transactions | Date, Category, Tags, Comment, Amount y Actions; anchos fijos y comentario truncado para conservar importe y acciones visibles. | Navegador: columnas y visibilidad a 1280 px; revisión visual. | Aprobado |
| Resumen móvil y Dashboard | Componente compartido: icono con color de categoría, categoría blanca, fecha y tags pequeños grises; Comment entre metadatos e importe rojo/verde. Exceso en +N desplegable. | Pruebas responsive y revisión de capturas; componente compartido `TransactionSummary.vue`. | Aprobado |
| Filtros responsive | Selectores en rejilla adaptable; grupos All/Expense/Income y períodos sin solaparse. | Geometría y ancho del documento a 320, 360, 390, 768 y 1280 px en ambos proyectos de navegador. | Aprobado |
| Esquema y respaldo | Migraciones nuevas 004/005 sin alterar las previas; catálogo, aliases, relaciones y excepciones incluidos en respaldo recuperable. | `db:check`, suite de migraciones y `financial-workflow.test.mjs`: respaldo, verificación y lectura de recuperación mediante Prisma. | Aprobado |

## Comprobaciones reproducibles

Backend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:check`. Las **26 suites** pasaron, incluyendo tags, ocurrencias, comparaciones, migraciones, respaldo y regresiones previas.

Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. **222 pruebas** unitarias pasaron. `npm run test:browser` cubre **38 pruebas** con API controlada, repartidas entre Chromium de escritorio y emulación Pixel 7. `npm run test:integration` cubre **4 pruebas** contra Express real y SQLite temporal: replay offline y el flujo combinado de nuevas funcionalidades, en ambos perfiles.

Los harnesses fuerzan bases temporales, eliminan credenciales Turso heredadas y restringen el proxy de integración a localhost. Las capturas y trazas quedan en `test-results/`, ignorado por Git. La revisión visual usa capturas renderizadas; no se limita a comprobar el HTML.

## Commits

| Repositorio | Hash | Título |
|---|---|---|
| Backend | `a38ebf6` | `feat: tags and optional comments` |
| Backend | `80b7631` | `feat: recurring occurrence actions` |
| Backend | `2d5f64e` | `feat: analytics comparisons` |
| Backend | `dc269b3` | `test: verify financial workflows` |
| Backend | `2200269` | `fix: keep future skips date-specific` |
| Frontend | `6ba71da` | `feat: tag editor and transaction layout` |
| Frontend | `3fd0a72` | `feat: undo transaction deletes` |
| Frontend | `2bc871d` | `feat: edit or skip next occurrence` |
| Frontend | `d842741` | `feat: comparison charts` |
| Frontend | Consultar `git log -1` | `test: cover new personal workflows` (contiene este informe) |

El commit adicional del backend corrige la interacción entre saltar una fecha futura y cambiar después el calendario; incluye su regresión.

## Pendiente fuera del entorno local

- Android físico/PWA instalada y Edge real: la emulación Chromium no sustituye esas comprobaciones.
- Instalación desplegada en Render/Turso y migraciones 004/005 sobre datos reales. Antes de aplicarlas: respaldo verificado y revisión de los commits. No se ejecutaron aquí.
- Ejecución remota de CI con Node 24. Las comprobaciones locales usaron Node 26.1.0; los workflows conservan Node 24.

Estas comprobaciones pendientes no se consideran validadas por las pruebas locales.
