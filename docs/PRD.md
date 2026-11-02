# Product Requirements Document (PRD) - Samabox V2

## 1. Visión y Propósito del Producto

**Samabox V2** es la evolución de la plataforma web integral de inicio de jornada (*Morning Kickoff Dashboard*) diseñada para profesionales de tecnología, líderes técnicos, analistas de ciberseguridad y desarrolladores.

En su versión 1, Samabox consolidó en una única interfaz interactiva el Daily Security Briefing, la agenda de reuniones y la gestión de tareas. Sin embargo, la saturación visual en una única pantalla y la necesidad de integrar calendarios existentes motivaron la **Evolución V2**, la cual introduce:
1. **Descompresión en Pantallas Dedicadas (SPA Multipantalla)**:
   - **Landing / Resumen (`#/summary`)**: Vista ejecutiva de arranque matutino con resúmenes concisos, número configurable `X` de noticias críticas y botones Call-To-Action (CTA) directos hacia las pantallas especializadas.
   - **Calendario Unificado (`#/calendar`)**: Gestión de compromisos locales y externos de múltiples cuentas (Google Calendar, Outlook, Apple Calendar, etc.) con diferenciación por color, recordatorios, detección automática de colisiones y **proyección interactiva de las tareas asignadas para esa fecha**.
   - **Planner de Tareas Kanban (`#/tasks`)**: Tablero estilo Trello/Planner con columnas de estado (`Pendiente`, `En Progreso`, `Completada`), soporte de interacción fluida (Drag & Drop nativo y controles accesibles por teclado/clic), Daily Focus y sincronización en tiempo real con el Calendario.
   - **Centro de Inteligencia y Noticias (`#/news`)**: Pantalla dedicada con listado exhaustivo de noticias de seguridad, filtrado por fuente, motor de búsqueda en tiempo real y análisis dual (Resumen a leer + Comentarios tácticos con IA o Fallback Heurístico).
2. **Conectividad de Múltiples Calendarios (Enfoque Híbrido iCal / RFC 5545)**:
   - **Suscripción Automática por URL iCal** (`https://...` y `webcal://...`): Con sincronización programada o bajo demanda.
   - **Carga Manual de Archivos `.ics`**: Para soporte offline total, entornos air-gapped o exportaciones puntuales sin dependencia de internet.
   - **Seguridad Robusta Anti-SSRF**: Validación estricta de esquemas, resolución de dominios y bloqueo de rangos de red privados/loopback/cloud-metadata.

---

## 2. Usuarios Objetivo y Casos de Uso

### 2.1 Perfiles de Usuario
- **Security Engineers & SecOps**: Requieren una pantalla dedicada (`#/news`) para analizar vectores de amenaza y vulnerabilidades (CVEs) en profundidad sin que la agenda o las tareas estorben la lectura táctica.
- **Tech Leads / Engineering Managers / CISOs**: Utilizan la pantalla de Calendario (`#/calendar`) para orquestar reuniones de múltiples cuentas (trabajo corporativo, proyectos abiertos, calendarios personales) detectando solapamientos y verificando qué tareas técnicas están planificadas para ese día.
- **Desarrolladores & DevOps**: Emplean el tablero Kanban (`#/tasks`) como su centro de productividad diaria, moviendo tarjetas con drag & drop entre estados y visualizando sus tareas reflejadas en su calendario matutino.

### 2.2 Escenarios Principales de Uso

#### Escenario A: Arranque Matutino Rápido (Landing / Resumen `#/summary`)
A las 08:30 AM, el usuario abre Samabox. Visualiza de un vistazo:
- Las 3 noticias de seguridad más críticas del día (o las `X` configuradas en su preferencia).
- El total de reuniones del día, si existe algún solapamiento de horarios y el botón CTA *"Ir a mi Calendario →"*.
- El progreso de sus tareas (ej. "3 de 7 tareas listas (43%)"), su *Daily Focus* y el botón CTA *"Abrir Planner de Tareas →"*.
- En menos de 60 segundos obtiene una panorámica completa antes de profundizar en cualquier módulo.

#### Escenario B: Coordinación de Calendarios y Tareas (`#/calendar`)
El usuario necesita revisar su día:
- Conecta la URL iCal de su calendario corporativo y sube un archivo `.ics` de una conferencia externa.
- Visualiza sus reuniones diferenciadas por color (ej. Azul: Corporativo, Naranja: Conferencia, Verde: Local).
- El sistema detecta una colisión a las 11:00 AM entre una reunión interna y una llamada de cliente.
- En el panel inferior o lateral observa las tareas asignadas para hoy ("Revisar PR de autenticación"), permitiéndole correlacionar su tiempo libre con sus compromisos pendientes.

#### Escenario C: Flujo de Trabajo en Tablero Kanban (`#/tasks`)
Durante la jornada, el usuario abre el Planner:
- Arrastra una tarea desde la columna `Pendiente` hasta `En Progreso`.
- Asigna la fecha de hoy y marca la estrella de `Daily Focus`.
- Al regresar a `#/calendar` o `#/summary`, la tarea se refleja inmediatamente en el bloque de la fecha seleccionada.

---

## 3. Alcance Funcional por Pantallas y Módulos

### Módulo 1: Navegación y Shell de la Aplicación (SPA Multipantalla)
- **Hash Router Nativo**: Enrutamiento ligero mediante el hash de la URL (`#/summary`, `#/calendar`, `#/tasks`, `#/news`) sin recarga de página y compatible con recarga directa del navegador.
- **Barra de Navegación Global**:
  - Enlaces de cambio de pantalla con estado activo visualmente destacado.
  - Selector de fecha contextual (por defecto el día actual).
  - Indicador de estado del sistema (Estado de base de datos y modo LLM Online vs Heurístico Local).

### Módulo 2: Landing / Resumen Ejecutivo (`#/summary`)
- **Widget de Noticias Resumidas**:
  - Exposición de un número configurable `X` de noticias (selector interactivo con opciones: 1, 3, 5; por defecto 3).
  - Cada tarjeta presenta el titular, fuente y extracto rápido.
  - Botón CTA: *"Ver todas las noticias de seguridad →"* que conmuta a `#/news`.
- **Widget de Calendario Ejecutivo**:
  - Listado de las próximas reuniones inmediatas.
  - Alerta prominente en caso de colisiones o solapamientos.
  - Botón CTA: *"Ver calendario completo y fuentes →"* que conmuta a `#/calendar`.
- **Widget de Tareas del Día**:
  - Barra de progreso métrico (completadas vs totales).
  - Destacado de la tarea designada como *Daily Focus*.
  - Botón CTA: *"Gestionar tablero de tareas →"* que conmuta a `#/tasks`.

### Módulo 3: Pantalla de Calendario Unificado (`#/calendar`)
- **Conectividad de Múltiples Fuentes (Enfoque Híbrido)**:
  - **Suscripciones URL iCal**: Soporte para protocolos `https://` y `webcal://`. Permite asignar nombre, color distintivo e intervalo de sincronización.
  - **Importación Manual de Archivos `.ics`**: Carga local de archivos iCal para respaldo offline y eventos locales sin requerir red.
  - **Eventos Locales Directos**: Capacidad de crear reuniones y recordatorios directamente en la aplicación.
- **Tipos de Entradas**:
  - **Reuniones (Meetings)**: Eventos con hora de inicio y fin (`HH:MM`).
  - **Recordatorios / Eventos de Día Completo (Reminders / All-Day)**: Eventos puntuales o hitos del día.
- **Detección Global de Solapamientos**:
  - Detección de colisiones cruzadas entre reuniones locales y de cualquier calendario conectado.
  - Marcado visual de conflictos y detalle de eventos implicados.
- **Proyección de Tareas en Calendario**:
  - Muestra automáticamente todas las tareas asignadas a la fecha activa con su estado actual (`Pendiente`, `En Progreso`, `Completada`).
  - Permite actualizar el estado de la tarea directamente desde la vista del calendario.

### Módulo 4: Pantalla de Tareas tipo Planner / Trello (`#/tasks`)
- **Tablero Kanban con 3 Columnas Fijas**:
  - 📌 **Pendiente**: Tareas por iniciar.
  - ⚡ **En Progreso**: Tareas en desarrollo activo.
  - ✅ **Completada**: Tareas finalizadas.
- **Interacción Avanzada y Accesible**:
  - **Drag & Drop Nativo HTML5**: Arrastrar tarjetas entre columnas para actualizar el estado instantáneamente.
  - **Controles Accesibles**: Botones de acción rápida en cada tarjeta para avanzar o retroceder de estado sin necesidad de mouse (adecuado para teclado y pantallas táctiles).
- **Metadata de Tarjeta**:
  - Título y fecha programada.
  - Selector de Prioridad (`Alta`, `Media`, `Baja`) con distintivo visual.
  - Selector de `Daily Focus` (icono de estrella interactivo).
  - Fecha de asignación: Al cambiar la fecha de una tarea, se actualiza automáticamente su proyección en el Calendario.

### Módulo 5: Pantalla de Noticias de Seguridad (`#/news`)
- **Listado Completo de Inteligencia de Amenazas**:
  - Visualización espaciosa de todas las noticias analizadas.
  - Estructura obligatoria: Titular y enlace original, bloque **"Resumen a leer"** y bloque **"Comentarios al respecto"**.
- **Filtros y Búsqueda**:
  - Filtro desplegable por fuente de ciberseguridad (The Hacker News, BleepingComputer, CISA Alerts, etc.).
  - Caja de búsqueda en vivo con filtrado instantáneo por palabras clave en título o contenido.
- **Acciones y Resiliencia**:
  - Botón de refresco manual forzado (`/api/briefing/refresh`).
  - Motor dual conmutador: Cloud LLM Adapter si existe `LLM_API_KEY`, o Heuristic Fallback Engine local sin conexión.

---

## 4. Requisitos No Funcionales (NFR)

1. **Rendimiento**:
   - Transición entre pantallas de la SPA en menos de 50 ms (sin recargas de red completas).
   - Parseo de archivos `.ics` de hasta 1,000 eventos en menos de 100 ms.
   - Tiempo de respuesta de endpoints REST en red local inferior a 100 ms.
2. **Seguridad y Protección SSRF**:
   - Bloqueo de URLs de suscripción iCal que apunten a direcciones loopback (`127.0.0.1`, `localhost`), rangos privados RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) o metadatos de proveedores cloud (`169.254.169.254`).
   - Sanitización contra inyecciones XSS en resúmenes, descripciones y títulos iCal importados.
3. **Resiliencia y Modo Offline**:
   - La importación manual de `.ics` debe funcionar sin conexión a internet.
   - Si una suscripción remota falla o no responde en 8 segundos, el sistema mantiene los eventos en caché local e informa el estado `error` en la metadata de la fuente.
4. **Cero Dependencias Externas (Pure Node.js v22 LTS)**:
   - Toda la solución backend (parser iCal RFC 5545, HTTP server, base de datos SQLite) debe ejecutarse utilizando módulos nativos de Node.js (`node:http`, `node:sqlite`, `node:dns`, `node:crypto`, `node:test`).
5. **Calidad y Cobertura de Pruebas**:
   - Preservación estricta de las 130 pruebas del baseline v1.
   - Cobertura de pruebas unitarias e integración superior al 85% para toda la nueva funcionalidad V2.

---

## 5. Historias de Usuario (US) y Criterios de Aceptación (AC)

### US-01: Pantalla Landing / Resumen Ejecutivo (`#/summary`)
**Como** profesional ocupado al iniciar mi mañana,  
**Quiero** ver un resumen conciso con las noticias clave, mis compromisos del día y el estado de mis tareas con accesos directos a cada módulo,  
**Para** orientarme en segundos sin abrumarme con pantallas saturadas.

#### Criterios de Aceptación:
- **AC-01.1**: Al acceder a la aplicación en `#/summary` (o ruta raíz `/`), el sistema presenta los tres bloques ejecutivos: Noticias, Calendario y Tareas.
- **AC-01.2**: El bloque de noticias muestra exactamente `X` noticias según la preferencia configurada (por defecto 3; seleccionable entre 1, 3 y 5) y dispone del botón CTA que navega a `#/news`.
- **AC-01.3**: El bloque de calendario muestra las próximas reuniones del día, resalta si existen solapamientos y ofrece un botón CTA que navega a `#/calendar`.
- **AC-01.4**: El bloque de tareas presenta el contador/porcentaje de avance, la tarea destacada como Daily Focus y un botón CTA que navega a `#/tasks`.
- **AC-01.5**: Las acciones realizadas en cualquier módulo actualizan los contadores métricos del resumen al regresar a esta vista.

---

### US-02: Conexión de Múltiples Cuentas de Calendario (Enfoque Híbrido iCal)
**Como** usuario con múltiples calendarios (corporativo, personal, eventos),  
**Quiero** conectar calendarios mediante URL iCal (.ics/webcal) y cargar archivos .ics manuales offline,  
**Para** consolidar todas mis citas en una sola agenda visualmente diferenciada por colores.

#### Criterios de Aceptación:
- **AC-02.1**: El usuario puede registrar una nueva fuente de calendario indicando: Nombre, Tipo (`subscription` o `manual_import`), URL (para suscripción) y un Color distintivo en formato hexadecimal.
- **AC-02.2**: Para fuentes tipo `subscription`, el sistema acepta esquemas `https://` y `webcal://`, normalizándolos y validando que no apunten a direcciones IP privadas o de metadatos (prevención SSRF).
- **AC-02.3**: El usuario puede subir manualmente un archivo `.ics` o pegar su contenido iCal, procesando de inmediato sus eventos sin requerir conexión a internet.
- **AC-02.4**: El sistema parsea correctamente los componentes `VEVENT` según RFC 5545, soportando line unfolding, `SUMMARY`, `LOCATION`, `DESCRIPTION`, `DTSTART`, `DTEND` y eventos de día completo (`VALUE=DATE`).
- **AC-02.5**: La sincronización es idempotente: resincronizar una fuente actualiza o preserva los eventos basados en su `UID` sin duplicarlos.
- **AC-02.6**: El usuario puede activar/desactivar la visibilidad de cualquier fuente, forzar la sincronización bajo demanda o eliminar la fuente junto con sus eventos asociados.

---

### US-03: Pantalla de Calendario Unificado y Proyección de Tareas (`#/calendar`)
**Como** planificador de mi tiempo,  
**Quiero** visualizar en un cronograma todas las reuniones de mis fuentes conectadas con detección de colisiones y ver las tareas proyectadas para esa fecha,  
**Para** coordinar mis horas de trabajo y entregas sin sorpresas de agenda.

#### Criterios de Aceptación:
- **AC-03.1**: La pantalla `#/calendar` muestra los eventos ordenados por hora, coloreando la tarjeta o borde según el color asignado a su fuente de origen.
- **AC-03.2**: Si dos reuniones (locales o externas de cualquier cuenta) se solapan en su intervalo horario, ambas muestran un distintivo visible de colisión/conflicto de agenda.
- **AC-03.3**: Los recordatorios y eventos de día completo se visualizan en un carril o sección separada de eventos generales del día.
- **AC-03.4**: La vista proyecta una sección de **"Tareas asignadas para esta fecha"**, listando las tareas cuya fecha coincide con el día visualizado, indicando su prioridad y estado actual.
- **AC-03.5**: El usuario puede cambiar el estado de una tarea directamente desde la proyección del calendario y el cambio se refleja de inmediato.

---

### US-04: Tablero Kanban de Tareas tipo Planner / Trello (`#/tasks`)
**Como** desarrollador o líder técnico,  
**Quiero** gestionar mis tareas diarias en un tablero visual Kanban con columnas de estado y arrastre interactivo,  
**Para** organizar mi flujo de trabajo de forma ágil y natural.

#### Criterios de Aceptación:
- **AC-04.1**: La pantalla `#/tasks` presenta tres columnas principales: `Pendiente`, `En Progreso` y `Completada`.
- **AC-04.2**: El usuario puede arrastrar una tarjeta (Drag & Drop nativo) y soltarla en otra columna, actualizando su estado de inmediato en la base de datos y la interfaz.
- **AC-04.3**: Cada tarjeta cuenta con controles accesibles (botones "Mover a...") para que usuarios sin mouse o en dispositivos móviles puedan transicionar estados sin arrastrar.
- **AC-04.4**: El usuario puede crear nuevas tareas directamente en cualquiera de las columnas asignando título, prioridad (`Alta`, `Media`, `Baja`), fecha y foco diario (`Daily Focus`).
- **AC-04.5**: Si una tarea tiene fecha asignada (ej. hoy), al modificar su estado o fecha en el tablero Kanban, la información se actualiza de manera sincronizada en la proyección del Calendario (`#/calendar`) y en el Resumen (`#/summary`).

---

### US-05: Pantalla Dedicada de Noticias de Seguridad (`#/news`)
**Como** analista de seguridad,  
**Quiero** un espacio amplio dedicado a la lectura de inteligencia de ciberseguridad con búsqueda y filtros por fuente,  
**Para** evaluar amenazas y contramedidas técnicas con comodidad y sin distracciones.

#### Criterios de Aceptación:
- **AC-05.1**: La pantalla `#/news` muestra el listado completo de noticias de seguridad procesadas para la fecha seleccionada.
- **AC-05.2**: Cada noticia contiene de forma obligatoria y diferenciada el titular con enlace original, el bloque **"Resumen a leer"** y el bloque **"Comentarios al respecto"**.
- **AC-05.3**: Se incluye un control desplegable de filtro por fuente y una caja de búsqueda en tiempo real que filtra noticias por coincidencia de texto.
- **AC-05.4**: La pantalla incluye un botón de "Actualizar Noticias" que dispara la recolección fresca (`/api/briefing/refresh`) y muestra el estado de actualización.
- **AC-05.5**: En caso de ausencia de API Key o error de conexión, el sistema genera resúmenes y comentarios mediante el motor heurístico local sin interrumpir la experiencia.

---

## 6. Métricas de Éxito de la Evolución V2
- **Descompresión Cognitiva**: Reducción del scroll vertical y de la sobrecarga de información mediante navegación multipantalla SPA con tiempo de respuesta < 50 ms.
- **Interoperabilidad de Calendarios**: 100% de éxito en la importación y sincronización de calendarios RFC 5545 estándar (Google, Outlook, Apple).
- **Integridad y Regresión Cero**: 100% de las pruebas del baseline (130 tests) pasando exitosamente más las nuevas suites V2.
- **Resiliencia Operativa**: Funcionamiento completo de importación ICS y gestión de tareas en entornos totalmente offline.

