# Samabox — Morning Kickoff Dashboard

> **Samabox** es un panel matutino unificado (*Morning Kickoff Dashboard*) diseñado para Tech Leads y equipos de SecOps. Centraliza en una sola vista responsiva la inteligencia diaria de ciberseguridad, la planificación y detección automática de solapamientos en la agenda, y la gestión focalizada de tareas del día (*Daily Focus*).

---

## 🏛️ Arquitectura del Sistema

Samabox sigue una **Arquitectura Limpia Modular (*Modular Clean Architecture*)** con **cero dependencias externas de producción**, aprovechando al máximo las capacidades nativas de **Node.js v22 LTS**:

```
samabox/
├── data/                      # Base de datos SQLite persistente (samabox.db)
├── docs/                      # PRD y especificaciones de arquitectura
├── src/
│   ├── adapters/              # Adaptadores de infraestructura
│   │   ├── db.js              # SQLite con DatabaseSync nativo de node:sqlite
│   │   ├── rss-adapter.js     # Parser XML RSS 2.0 / Atom con catálogo resiliente
│   │   └── llm-adapter.js     # Cliente OpenAI compatible con fallback heurístico local
│   ├── domain/                # Modelos de dominio e invariantes de negocio puras
│   │   ├── meeting.js         # Validación de reuniones y algoritmo de solapamientos
│   │   ├── task.js            # Matriz de priorización, estados y cálculo de estadísticas
│   │   └── briefing-item.js   # Invariantes y estructura de noticias de seguridad
│   ├── services/              # Servicios de aplicación y casos de uso
│   │   ├── agenda-service.js   # CRUD de agenda y resolución de colisiones
│   │   ├── task-service.js     # Gestión de tareas y Daily Focus
│   │   ├── briefing-service.js # Orquestación e ingesta diaria de noticias
│   │   └── dashboard-service.js# Consolidación del resumen matutino
│   ├── utils/                 # Utilidades transversales
│   │   └── sanitizer.js       # Sanitización estricta de HTML y URLs para RSS externo
│   ├── public/                # Frontend responsivo sin bundlers (Vanilla ES Modules)
│   │   ├── index.html         # Maquetación accesible de 3 columnas
│   │   ├── css/styles.css     # Variables CSS, diseño responsivo y temas claro/oscuro
│   │   └── js/                # Componentes puros (Briefing, Agenda, Tasks) y controlador
│   ├── app.js                 # Servidor HTTP modular nativo con hardening y rutas REST
│   ├── config.js              # Carga de variables de entorno con valores por defecto
│   └── server.js              # Punto de entrada y apagado grácil (graceful shutdown)
├── tests/                     # Suite completa de pruebas con node:test y TDD
│   ├── helpers/test-db.js     # Base de datos SQLite en memoria para tests aislados
│   ├── unit/                  # Pruebas unitarias de dominio, adaptadores y sanitización
│   └── integration/           # Pruebas de integración HTTP, API, hardening y E2E
├── .env.example               # Plantilla de configuración de variables de entorno
└── package.json               # Configuración del paquete y scripts nativos
```

### Principios Fundamentales:
1. **Resiliencia Grácil (*Graceful Degradation*)**: Si la red externa, los feeds RSS o la API del LLM no están disponibles o tardan demasiado, el sistema conmuta automáticamente a un catálogo curado y a un motor heurístico de análisis SecOps en español, garantizando **siempre por lo menos 3 noticias diarias analizadas**.
2. **Hardening y Seguridad por Defecto**:
   - Cabeceras HTTP seguras en todas las respuestas (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
   - Límite estricto de tamaño de payload JSON (64KB con respuesta `413 Payload Too Large`).
   - Prevención estricta contra *Path Traversal* (`..`) en el servidor de archivos estáticos.
   - Sanitización robusta de contenido HTML y URLs procedentes de feeds externos.
3. **Cero Dependencias Pesadas**: 100% implementado con librerías nativas de Node.js v22 (`node:http`, `node:sqlite`, `node:test`, `node:assert/strict`).

---

## 📋 Requisitos Previos

- **Node.js** >= `v22.0.0` (LTS recomendado, compatible con `node:sqlite` nativo).
- **npm** >= `10.0.0`.

---

## ⚙️ Variables de Entorno

Copia el archivo de plantilla `.env.example` a `.env` si deseas personalizar la configuración:

```bash
cp .env.example .env
```

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `PORT` | Puerto HTTP donde escuchará el servidor | `3000` |
| `HOST` | Interfaz de red de enlace | `0.0.0.0` |
| `NODE_ENV` | Entorno de ejecución (`development` / `production`) | `development` |
| `DB_PATH` | Ruta al archivo de base de datos SQLite | `./data/samabox.db` |
| `LLM_API_KEY` | Clave API de OpenAI o compatible (opcional; si se omite, usa motor heurístico) | *vacío* |
| `LLM_BASE_URL` | URL base del endpoint compatible OpenAI | `https://api.openai.com/v1` |
| `LLM_MODEL` | Nombre del modelo a utilizar | `gpt-4o-mini` |

---

## 🚀 Puesta en Marcha

### Instalación
No requiere instalar paquetes pesados:
```bash
npm install
```

### Iniciar el Servidor
```bash
npm start
```
El panel estará disponible en [http://localhost:3000](http://localhost:3000).

---

## 🧪 Ejecución de Pruebas (TDD)

Toda la aplicación cuenta con cobertura exhaustiva de pruebas unitarias y de integración construidas con el corredor nativo de Node.js:

```bash
npm test
```

Para ejecutar una suite específica:
```bash
# Pruebas unitarias de dominio
node --no-warnings --test tests/unit/meeting-domain.test.js
node --no-warnings --test tests/unit/task-domain.test.js
node --no-warnings --test tests/unit/sanitizer.test.js

# Pruebas de integración de APIs
node --no-warnings --test tests/integration/agenda-api.test.js
node --no-warnings --test tests/integration/task-api.test.js
node --no-warnings --test tests/integration/briefing-api.test.js
node --no-warnings --test tests/integration/health-hardening.test.js

# Flujo matutino completo E2E
node --no-warnings --test tests/integration/e2e-morning-kickoff.test.js
```

---

## 📡 Endpoints de la API REST

### Salud y Estado del Sistema
- `GET /api/health`: Retorna estado general, verificación activa contra SQLite (`SELECT 1`), modo de análisis y timestamp.

### Resumen Matutino (Morning Kickoff)
- `GET /api/dashboard/summary?date=YYYY-MM-DD`: Consolida métricas del día (número de noticias, estadísticas de reuniones con detección de colisiones y avance porcentual de tareas).

### Inteligencia de Ciberseguridad (Security Briefing)
- `GET /api/briefing?date=YYYY-MM-DD`: Obtiene las noticias del día con **"Resumen a leer"** y **"Comentarios al respecto"**.
- `POST /api/briefing/refresh`: Fuerza la actualización e ingesta fresca de feeds RSS/Atom.

### Agenda de Reuniones
- `GET /api/meetings?date=YYYY-MM-DD`: Lista cronológica con flags `hasConflict: boolean` y `conflictingIds: string[]`.
- `POST /api/meetings`: Agenda una reunión (`title`, `date`, `startTime`, `endTime`, `location`, `notes`).
- `PUT /api/meetings/:id`: Actualiza datos y recalcula colisiones en tiempo real.
- `DELETE /api/meetings/:id`: Elimina la reunión.

### Gestión de Tareas
- `GET /api/tasks?date=YYYY-MM-DD&status=...&priority=...&isFocus=...`: Lista inteligente (Focus primero, luego por prioridad).
- `POST /api/tasks`: Crea tarea (`title`, `priority`, `isFocus`, `status`, `date`).
- `PATCH /api/tasks/:id`: Actualización parcial de estado o prioridad.
- `DELETE /api/tasks/:id`: Elimina la tarea.

---

## 🛡️ Licencia

Distribuido bajo la licencia MIT.
