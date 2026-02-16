# Plataforma de agentes: qué puede hacer hoy y mejoras sutiles para CELSA

Documento de respuesta a los retos CELSA: qué puede cubrir la plataforma actual y qué mejoras sutiles permitirían ejecutar bien cada tipo de caso.

---

## 1. Qué puede hacer la plataforma hoy

### 1.1 Inteligencia (agentes + chats)

- **Agentes como templates compartidos**: instrucciones, entidades permitidas, carpetas de conocimiento (PDFs, docs), prompts por rol (orquestador, analista, especialista, síntesis).
- **Chats por contexto**: cada conversación puede asignarse a un agente (p. ej. “Conflictos laborales”, “Proceso compra”, “Auditor contratos”) y heredar normativa, políticas y documentación del agente.
- **Generar instrucciones con IA**: a partir de una descripción en lenguaje natural se generan instrucciones del agente; se pueden refinar y reutilizar en la librería.
- **Knowledge base**: entidades (datos estructurados), carpetas, documentos; los agentes pueden restringirse a entidades y carpetas concretas (p. ej. solo normativa laboral, solo manuales de máquinas).

### 1.2 Otros módulos

- **Workflows**: automatizaciones (nodos, integraciones); pueden orquestar pasos que luego un agente “guía” o valida.
- **Reporting / dashboards**: análisis y visualización; un agente puede apoyar la interpretación si tiene acceso a las mismas fuentes.
- **Conexiones**: integración con fuentes de datos; base para que los agentes hablen de datos “vivos” (no solo documentos).

Con esto, la plataforma ya puede abordar de forma **asistida** (humano en el centro) muchos de los casos CELSA: no sustituye sistemas, pero sí centraliza conocimiento, normativa y procesos en agentes que guían y estandarizan.

---

## 2. Mapeo rápido: casos CELSA ↔ plataforma

| Caso CELSA | Qué puede hacer la plataforma hoy | Gap principal |
|------------|-----------------------------------|----------------|
| **Asistente conflictos laborales** | Agente con normativa + políticas en Knowledge; instrucciones tipo “solo orientación, no sustituyes asesoría legal”. | Templates “legal/RRHH” y aviso claro de no-sustitución. |
| **Asistente proceso compra** | Agente con pasos del proceso, checklist y documentación en carpetas; guía y valida sin ejecutar. | Checklist/plantilla por tipo de proceso (flujo visible). |
| **Agente comprador** | Mismo agente con instrucciones más proactivas (sugerir opciones, comparar); mismo conocimiento. | Diferenciar “solo guía” vs “sugiere y compara” en templates. |
| **Auditor de Contratos** | Agente con cláusulas tipo, normativa y listas de obligatorios por origen; analiza texto de contrato vs reglas. | Plantilla “auditoría contractual” + campos “origen/normativa”. |
| **INDS Motor regulatorio** | Agente que “lee” informes/alertas ya generados por otro sistema; explicación y resumen. | Integración vía workflows/API para alimentar documentos o resúmenes. |
| **Gestión de averías** | Agente con manuales y documentación técnica en carpetas; diagnóstico guiado por preguntas. | Template “mantenimiento” + posible checklist por tipo de máquina. |
| **P2P, encargado obra, evaluación volumen/calidad, etc.** | Agente como interfaz de consulta sobre datos/documentos que la plataforma o workflows ya preparen. | Ver mejoras 2–5 abajo (datos, checklist, voz, visión). |

La plataforma sirve sobre todo como **capa de agente conversacional** sobre conocimiento y datos que vosotros definís (documentos, entidades, workflows). Los casos más “automáticos” (visión, telemetría, scouting masivo) requieren integraciones externas; la plataforma puede ser el **punto de consulta y decisión** una vez esos sistemas generan resultados.

---

## 3. Mejoras sutiles para que los casos se puedan hacer bien

Son cambios acotados en producto y UX, no rediseños completos.

### 3.1 Templates de agente por “tipo de caso”

- **Qué**: En la librería de agentes, además de “crear desde cero” o “generar con IA”, tener **plantillas por dominio**: Legal/RRHH, Compras (guía vs comprador), Auditoría contractual, Mantenimiento, Recepción/Logística, etc.
- **Por qué**: Cada plantilla trae instrucciones base, tono (ej. “no sustituyes asesoría legal”, “solo guías, no ejecutas”) y sugerencia de entidades/carpetas. Así CELSA no parte de una hoja en blanco para conflictos laborales o proceso de compra.
- **Sutil**: Son solo más opciones en el wizard de “Nuevo agente”, reutilizando el mismo modelo de agente.

### 3.2 Checklist / pasos del proceso en el agente

- **Qué**: En la ficha del agente, un campo opcional “Pasos del proceso” o “Checklist” (lista ordenada). El agente recibe en sistema: “Debes guiar al usuario por estos pasos; marca cuáles se han cubierto en esta conversación.”
- **Por qué**: Casos como “asistente proceso compra” o “auditor contratos” piden homogeneidad y que no se salte ningún paso; un checklist explícito reduce que el agente “invente” flujos.
- **Sutil**: Un texto estructurado (lista numerada o JSON) en el agente; el prompt builder ya lo inyecta en el contexto del LLM.

### 3.3 Aviso de “rol del agente” (no sustituye, solo asiste)

- **Qué**: Al elegir template “Legal/RRHH” o “Auditoría”, que la UI muestre un aviso corto (ej. “Este agente es de apoyo; no sustituye asesoría legal ni decisiones formales”) y que ese aviso se incluya automáticamente en las instrucciones del agente.
- **Por qué**: Reduce riesgo legal y de malentendidos (especialmente conflictos laborales, contratos).
- **Sutil**: Texto fijo por tipo de template + checkbox “Incluir aviso de no sustitución” en el asistente.

### 3.4 Origen y normativa aplicable (auditor contratos)

- **Qué**: En agentes tipo “Auditoría contractual”, campos opcionales: “Origen/Normativa aplicable”, “Cláusulas obligatorias (resumen)”. Se guardan en el agente y se pasan al contexto del LLM.
- **Por qué**: El caso CELSA pide verificación por origen y normativa; hoy eso puede ir en instrucciones, pero con campos dedicados se mantiene ordenado y actualizable.
- **Sutil**: 2–3 campos más en el modelo `copilot_agents` (o un JSON “metadata”) y mostrarlos en el modal de configuración del agente.

### 3.5 “Fuentes de verdad” y actualización de conocimiento

- **Qué**: En cada carpeta de conocimiento (o en el agente), indicar “Última revisión recomendada” (fecha) y, si hay integración con repositorio/normativa, “Actualizado desde [sistema]”. No hace falta aún actualización automática; solo que la plataforma deje claro qué está considerado “vigente”.
- **Por qué**: INDS y auditor de contratos dependen de que el agente trabaje sobre normativa y documentación al día; esto prepara el terreno para flujos de actualización posterior.
- **Sutil**: Campo “última revisión” o “fuente” en carpetas/agente y mostrarlo en la UI.

### 3.6 Mejor uso de entidades en el prompt

- **Qué**: Que el builder de prompt del agente, cuando hay `allowedEntities`, incluya no solo “puedes usar estas entidades” sino “nombre de la entidad + 1 línea de para qué sirve” (a partir de nombre/descripción de la entidad).
- **Por qué**: Casos como compras, recepción o facturación mejoran si el LLM entiende qué es cada entidad (pedidos, albaranes, proveedores) sin depender solo del nombre.
- **Sutil**: En el backend, al construir el contexto del agente, añadir una línea por entidad permitida con su descripción si existe.

### 3.7 Un agente, varios “modos” (guía vs proactivo)

- **Qué**: En las instrucciones del agente, un selector o etiqueta: “Modo: Solo guía / Guía y sugiere / Más autónomo (siempre humano responsable)”. No cambiar lógica; solo que la plantilla de instrucciones base cambie según ese modo.
- **Por qué**: Diferencia clara entre “asistente proceso compra” (solo guía) y “agente comprador” (más iniciativa), reutilizando el mismo template de compras.
- **Sutil**: Un desplegable que rellene un párrafo fijo en instrucciones; sin nuevo modelo de datos si no hace falta.

### 3.8 Integración con resultados de otros sistemas (INDS, telemetría, visión)

- **Qué**: Que un workflow (o una API) pueda “escribir” un documento o registro que cuenta como “conocimiento” del agente (p. ej. “Resumen regulatorio de la semana”, “Alertas de telemetría”). El agente solo lee; la plataforma no hace el scraping ni el análisis pesado.
- **Por qué**: INDS, análisis de telemetría o monitor competitivo pueden vivir fuera; la plataforma se convierte en el lugar donde se consulta y se decide con ese resultado.
- **Sutil**: Permitir “carpeta o documento generado por workflow/API” como fuente del agente, con permisos y nombre claro.

### 3.9 Nombres y descripciones que orienten a CELSA

- **Qué**: En ejemplos y plantillas por defecto, usar nombres/descripciones alineados con los casos CELSA: “Asistente conflictos laborales”, “Asistente proceso de compra”, “Auditor de contratos”, “Asistente mantenimiento y averías”, etc., con 1 línea de descripción.
- **Por qué**: Que el cliente vea desde el primer uso que la plataforma está pensada para estos casos.
- **Sutil**: Cambio de copy y de seeds/templates, sin tocar lógica.

### 3.10 Trazabilidad de “qué agente respondió” en cada chat

- **Qué**: En cada mensaje o en el resumen del chat, dejar claro “Respondido con agente: [nombre]” (ya tenéis agente por chat; es sobre todo mostrarlo bien en la UI y en exportación).
- **Por qué**: Auditoría y cumplimiento (quién/dónde se dio una recomendación).
- **Sutil**: Mostrar el nombre (y si se quiere el id) del agente en el header del chat o en el historial exportado.

---

## 4. Resumen ejecutivo para CELSA

- La plataforma **ya puede** actuar como “plataforma de plataformas” para muchos agentes: un mismo lugar donde definir agentes por caso (conflictos laborales, compras, auditoría contratos, mantenimiento, etc.), con conocimiento centralizado (normativa, políticas, manuales) y chats que heredan ese contexto.
- No sustituye sistemas de visión, telemetría o scouting; puede ser la **capa de consulta y decisión** sobre los resultados que esos sistemas generen.
- Las **mejoras sutiles** propuestas (templates por dominio, checklist de proceso, aviso de no sustitución, campos de normativa/origen, “modo” del agente, integración vía workflows para conocimiento generado) hacen que cada uno de los 5 primeros retos (y varios del resto) se puedan implementar y operar con menos fricción y más control.

Si queréis, el siguiente paso puede ser priorizar 2–3 de estas mejoras e implementarlas en el repo (por ejemplo: templates por tipo de caso + checklist + aviso legal).
