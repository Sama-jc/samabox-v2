# Samabox V2 — Morning Kickoff Dashboard & Tactical Planner

> **Samabox V2** es un panel matutino unificado (*Morning Kickoff Dashboard*) diseñado para Tech Leads y equipos de SecOps. Ofrece una arquitectura SPA multipantalla (*Resumen Ejecutivo*, *Calendario Unificado*, *Planner Kanban de Tareas* y *Daily Security Briefing*), integrando sincronización híbrida de calendarios RFC 5545 (iCal URL y archivos `.ics` offline) con mitigación anti-SSRF, detección de colisiones de agenda y proyección automática de tareas.

---

## 🏛️ Arquitectura del Sistema V2

Samabox sigue una **Arquitectura Limpia Modular (*Modular Clean Architecture*)** con **cero dependencias externas de producción**, aprovechando al máximo las capacidades nativas de **Node.js v22 LTS**:

```
samabox/
├── data/                      # Base de datos SQLite persistente (samabox.db)
├── docs/                      # PRD y especificaciones de arquitectura (ARCHITECTURE.md)
├── src/
│   ├── adapters/              # Adaptadores de infraestructura
│   │   ├── db.js              # SQLite con DatabaseSync nativo de node:sqlite y migraciones V2
│   │   ├── rss-adapter.js     # Parser XML RSS 2.0 / Atom con catálogo resiliente
│   │   └── llm-adapter.js     # Cliente OpenAI compatible con fallback heurístico local
│   ├── domain/                # Modelos de dominio e invariantes de negocio puras
│   │   ├── meeting.js         # Invariantes de reuniones, eventos all-day y algoritmo de colisiones
│   │   ├── calendar-source.js # Validaciones y tipos de fuentes de calendario
│   │   ├── ical-parser.js     # Motor nativo de parseo RFC 5545 (unfolding, VEVENT, marcas de tiempo)
│   │   ├── ssrf-guard.js      # Motor nativo de mitigación anti-SSRF y descarga segura de .ics
│   │   ├── task.js            # Matriz de priorización, estados y cálculo de estadísticas
│   │   └── briefing-item.js   # Invariantes y estructura de noticias de seguridad
│   ├── services/              # Servicios de aplicación y casos de uso
│   │   ├── agenda-service.js          # CRUD de agenda local y reuniones
│   │   ├── calendar-source-service.js # CRUD de cuentas, sincronización iCal e importación .ics offline
│   │   ├── unified-calendar-service.js# Calendario unificado, colisiones y proyección de tareas
│   │   ├── task-service.js            # Gestión de tareas y Daily Focus
│   │   ├── briefing-service.js        # Orquestación e ingesta diaria de noticias
│   │   └── dashboard-service.js       # Consolidación del resumen matutino con newsLimit
│   ├── utils/                 # Utilidades transversales
│   │   └── sanitizer.js       # Sanitización estricta de HTML y URLs para RSS externo
│   ├── public/                # Frontend responsivo SPA (Vanilla ES Modules sin empaquetadores)
│   │   ├── index.html         # Shell principal, barra de navegación accesible y contenedor dinámico
│   │   ├── css/styles.css     # Estilos responsivos, Kanban, modales, cronograma y temas claro/oscuro
│   │   └── js/
│   │       ├── router.js                  # Hash Router SPA nativo (#/summary, #/calendar, #/tasks, #/news)
│   │       ├── api.js                     # Cliente HTTP para todas las APIs de Samabox V2
│   │       ├── app.js                     # Controlador principal de interfaz y orquestación
│   │       └── components/                # Vistas y componentes modulares
│   │           ├── summary-view.js        # Landing de Resumen Ejecutivo con widgets y CTAs
│   │           ├── calendar-view.js       # Pantalla de Calendario con multi-cuenta y colisiones
│   │           ├── calendar-modal.js      # Modal gestor de calendarios (suscripción e importación)
│   │           ├── tasks-view.js          # Tablero Kanban con Drag & Drop HTML5 nativo
│   │           ├── news-view.js           # Pantalla completa de noticias con búsqueda en vivo
│   │           ├── briefing-view.js       # Renderizado de noticias y sanitizadores
│   │           ├── agenda-view.js         # Vista compacta de agenda
│   │           └── task-view.js           # Vista compacta de tareas
│   ├── app.js                 # Servidor HTTP modular nativo con hardening y rutas REST V2
│   ├── config.js              # Carga de variables de entorno con valores por defecto
│   └── server.js              # Punto de entrada y apagado grácil (graceful shutdown)
├── tests/                     # Suite completa de pruebas con node:test y TDD
│   ├── helpers/               # DB en memoria y fixtures iCal RFC 5545
│   ├── unit/                  # Pruebas unitarias de dominio, adaptadores, UI y parsers
│   └── integration/           # Pruebas de integración HTTP, API, hardening y E2E V1/V2
├── .env.example               # Plantilla de configuración de variables de entorno
└── package.json               # Configuración del paquete y scripts nativos
```

---

## 🖥️ Pantallas de la Arquitectura SPA (Hash Router)

1. **`#/summary` — Resumen Ejecutivo (Landing)**:
   - Widget de Noticias con selector desplegable de cantidad (`1`, `3` o `5` noticias).
   - Widget de Compromisos del Día con alerta de colisiones y botón CTA a `#/calendar`.
   - Widget de Planner con métricas de avance, Daily Focus y botón CTA a `#/tasks`.
2. **`#/calendar` — Calendario Unificado**:
   - Cronograma consolidado de citas locales y externas con colores configurables por cuenta.
   - Carril superior para recordatorios y eventos de día completo (`all-day`).
   - Resaltado prominente de solapamientos horarios globales (`⚠️ Conflicto de horario`).
   - **Proyección de Tareas de la Fecha**: visualización y conmutación de estado en tiempo real.
   - Modal de cuentas para suscripciones por URL e importación manual offline de archivos `.ics`.
3. **`#/tasks` — Planner Táctico Kanban**:
   - Tablero de 3 columnas (`Pendiente`, `En Progreso`, `Completada`) con contadores.
   - Soporte **Drag & Drop nativo HTML5** para mover tarjetas entre columnas.
   - Controles accesibles para usuarios de teclado y móviles.
   - Sincronización bidireccional automática con la proyección de tareas en `#/calendar`.
4. **`#/news` — Daily Security Briefing**:
   - Pantalla espaciosa con buscador interactivo en tiempo real y filtro por fuente.
   - Bloques estructurados obligatorios: **"Resumen a leer"** y **"Comentarios al respecto"**.
   - Botón de refresco bajo demanda contra fuentes RSS/Atom de ciberseguridad.

---

## 🛡️ Motor Híbrido iCal y Mitigación Anti-SSRF

- **Parser RFC 5545 (`ical-parser.js`)**: Realiza unfolding de líneas, parseo de bloques `VEVENT`, normalización de marcas de tiempo UTC/locales y eventos de día completo (`VALUE=DATE`).
- **Guarda Anti-SSRF (`ssrf-guard.js`)**: Normaliza esquemas permitidos (`webcal://` -> `https://`, `https://`), resuelve hostnames vía DNS y descarta inmediatamente direcciones IPv4/IPv6 privadas (RFC 1918), loopback, link-local y cloud metadata (`169.254.169.254`), con timeout de 8 segundos y límite de 5MB.
- **Importación Offline**: Carga manual segura de archivos `.ics` directamente desde el navegador para entornos aislados o sin conexión exterior.

---

## ⚙️ Variables de Entorno

```bash
cp .env.example .env
```

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `PORT` | Puerto HTTP donde escuchará el servidor | `3000` |
| `HOST` | Interfaz de red de enlace | `0.0.0.0` |
| `NODE_ENV` | Entorno de ejecución (`development` / `production`) | `development` |
| `DB_PATH` | Ruta al archivo de base de datos SQLite | `./data/samabox.db` |
| `LLM_API_KEY` | Clave API compatible OpenAI (opcional; si se omite, usa motor heurístico) | *vacío* |
| `LLM_BASE_URL` | URL base del endpoint compatible OpenAI | `https://api.openai.com/v1` |
| `LLM_MODEL` | Nombre del modelo a utilizar | `gpt-4o-mini` |

---

## 🚀 Puesta en Marcha

```bash
# Iniciar el servidor
npm start
```
Disponible en [http://localhost:3000](http://localhost:3000).

---

## 🧪 Ejecución de Pruebas (TDD)

```bash
# Ejecutar suite completa (pruebas unitarias, APIs, hardening y E2E V1/V2)
npm test
```

---

## 📡 Endpoints de la API REST V2

### Calendario y Fuentes
- `GET /api/calendar/unified?date=YYYY-MM-DD`: Retorna reuniones locales y externas consolidadas, detección global de colisiones, carril de recordatorios y tareas proyectadas.
- `GET /api/calendars`: Lista las fuentes de calendario configuradas.
- `POST /api/calendars`: Registra una suscripción iCal remota (`name`, `url`, `color`, `type='subscription'`).
- `GET /api/calendars/:id` & `PATCH /api/calendars/:id`: Consulta y actualiza propiedades (nombre, color, habilitado/pausado).
- `DELETE /api/calendars/:id`: Elimina la fuente y sus eventos sincronizados (`ON DELETE CASCADE`).
- `POST /api/calendars/:id/sync`: Dispara la sincronización segura e idempotente por URL.
- `POST /api/calendars/import`: Importación manual de archivo `.ics` (`name`, `color`, `icsContent`).

### Resumen Ejecutivo y Salud
- `GET /api/dashboard/summary?date=YYYY-MM-DD&newsLimit=X`: Resumen ejecutivo matutino con métricas globales y límite configurable de noticias destacadas.
- `GET /api/health`: Monitor de salud operativa y estado de SQLite.

### Inteligencia y Agenda
- `GET /api/briefing?date=YYYY-MM-DD` & `POST /api/briefing/refresh`: Inteligencia de seguridad.
- `GET /api/meetings?date=YYYY-MM-DD` & `POST /api/meetings` & `PUT /api/meetings/:id` & `DELETE /api/meetings/:id`: Agenda de reuniones.
- `GET /api/tasks?date=YYYY-MM-DD` & `POST /api/tasks` & `PATCH /api/tasks/:id` & `DELETE /api/tasks/:id`: Planner de tareas.

---

## 🛡️ Licencia

Distribuido bajo la licencia MIT.
