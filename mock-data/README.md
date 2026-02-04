# Mock Data - Fábrica de Plásticos Repsol

Datos de ejemplo para desarrollo local, simulando una planta de producción de polímeros de Repsol.

## Archivos disponibles

### 1. `produccion_lotes.csv`
Registro de lotes de producción con información de:
- Identificador de lote
- Producto (HDPE, LDPE, PP, PET, EVA)
- Grados comerciales (ALCUDIA, ISPLEN, NOVAPET)
- Parámetros de proceso (temperatura, presión, humedad)
- Operador y turno

### 2. `control_calidad.csv`
Análisis de laboratorio con parámetros típicos de polímeros:
- MFI (Índice de fluidez)
- Densidad
- Propiedades mecánicas (tracción, elongación, flexión)
- Dureza Shore
- Cenizas y humedad
- Color (yellowness index)

### 3. `consumo_energia.csv`
Datos de consumo energético por línea:
- Potencia activa y reactiva
- Factor de potencia
- Tensión e intensidad
- Coste estimado por tarifa (Valle/Llano/Punta)

### 4. `materias_primas.csv`
Recepciones de materiales:
- Proveedores reales (SABIC, LyondellBasell, Borealis, etc.)
- Grados comerciales
- Control de humedad y temperatura
- Trazabilidad de lotes

### 5. `mantenimiento_equipos.csv`
Órdenes de mantenimiento:
- Preventivo, correctivo y predictivo
- Equipos: extrusoras, granuladoras, secadores, sistemas de enfriamiento
- Costes de mano de obra y repuestos

### 6. `emisiones_medioambiente.csv`
Datos de control ambiental:
- Emisiones a atmósfera (NOx, CO, COV, partículas)
- Vertidos (DQO, DBO5, sólidos suspendidos)
- Cumplimiento normativo

### 7. `inventario_producto_terminado.csv`
Stock de productos acabados:
- SKUs con grados comerciales
- Clientes principales
- Días de cobertura
- Alertas de stock bajo

### 8. `alarmas_proceso.csv`
Histórico de alarmas OT:
- Severidad (Info, Warning, Critical)
- Tiempos de reconocimiento y resolución
- Causa raíz y acciones tomadas

### 9. `sensores_tiempo_real.csv`
Snapshot de sensores de proceso:
- Temperaturas por zonas
- Presiones
- Velocidades
- Niveles de silos

## Productos simulados

| Familia | Grados | Aplicación |
|---------|--------|------------|
| HDPE | ALCUDIA 4810-B, 6020-L | Film, soplado |
| LDPE | ALCUDIA 2008-N, 2310-N | Packaging, agrícola |
| PP | ISPLEN PP040, PP070 G2M | Inyección, automoción |
| PET | NOVAPET CR, CB | Botellas |
| EVA | ALCUDIA EVA PA-440, PA-539 | Adhesivos, calzado |

## Uso en la plataforma

Estos archivos CSV pueden cargarse en workflows usando el nodo **Excel/CSV Input** para:
- Análisis de producción
- Control de calidad
- Optimización energética
- Gestión de mantenimiento
- Reporting medioambiental

## Notas

- Los datos son ficticios pero basados en rangos realistas de la industria petroquímica
- Los grados de producto corresponden a marcas comerciales reales de Repsol
- Los proveedores son empresas reales del sector
- Los parámetros de proceso están dentro de rangos típicos para cada tipo de polímero
