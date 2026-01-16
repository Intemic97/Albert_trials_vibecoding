# 🐍 Guía del Nodo de Python

El nodo de Python te permite ejecutar código Python personalizado dentro de tus workflows.

## 📝 Sintaxis Básica

Tu código Python debe definir una función llamada `process` que recibe los datos de entrada y retorna los datos de salida:

```python
def process(data):
    # Tu lógica aquí
    result = # ... procesar data ...
    return result
```

## ✅ Ejemplo 1: Transformación Simple

```python
def process(data):
    """Duplicar todos los números en un diccionario"""
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if isinstance(value, (int, float)):
                result[key] = value * 2
            else:
                result[key] = value
        return result
    return data
```

**Input:**
```json
{"a": 10, "b": 20, "c": "hello"}
```

**Output:**
```json
{"a": 20, "b": 40, "c": "hello"}
```

## ✅ Ejemplo 2: Filtrado de Listas

```python
def process(data):
    """Filtrar números pares y elevarlos al cuadrado"""
    if isinstance(data, list):
        return [x * x for x in data if x % 2 == 0]
    return data
```

**Input:**
```json
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

**Output:**
```json
[4, 16, 36, 64, 100]
```

## ✅ Ejemplo 3: Procesamiento de Texto

```python
def process(data):
    """Transformar texto a mayúsculas y agregar metadatos"""
    if isinstance(data, dict) and 'text' in data:
        text = data['text']
        return {
            'original': text,
            'uppercase': text.upper(),
            'lowercase': text.lower(),
            'word_count': len(text.split()),
            'char_count': len(text)
        }
    return data
```

**Input:**
```json
{"text": "Hello World from Python"}
```

**Output:**
```json
{
  "original": "Hello World from Python",
  "uppercase": "HELLO WORLD FROM PYTHON",
  "lowercase": "hello world from python",
  "word_count": 4,
  "char_count": 23
}
```

## ✅ Ejemplo 4: Trabajo con Arrays de Objetos

```python
def process(data):
    """Calcular totales y promedios"""
    if isinstance(data, list):
        total = sum(item.get('value', 0) for item in data)
        count = len(data)
        average = total / count if count > 0 else 0
        
        return {
            'items': data,
            'summary': {
                'total': total,
                'count': count,
                'average': average
            }
        }
    return data
```

**Input:**
```json
[
  {"name": "Item 1", "value": 100},
  {"name": "Item 2", "value": 200},
  {"name": "Item 3", "value": 150}
]
```

**Output:**
```json
{
  "items": [...],
  "summary": {
    "total": 450,
    "count": 3,
    "average": 150
  }
}
```

## ✅ Ejemplo 5: Combinación de Datos

```python
def process(data):
    """Combinar datos de múltiples fuentes"""
    # data puede venir de nodos anteriores conectados
    if isinstance(data, dict):
        # Extraer campos específicos
        name = data.get('name', 'Unknown')
        age = data.get('age', 0)
        city = data.get('city', 'Unknown')
        
        # Crear un perfil formateado
        return {
            'profile': f"{name}, {age} años, vive en {city}",
            'is_adult': age >= 18,
            'metadata': {
                'processed': True,
                'source': 'python_node'
            }
        }
    return data
```

## 📦 Módulos Disponibles

Tu código tiene acceso a los siguientes módulos de Python:

- ✅ **Básicos**: `abs`, `all`, `any`, `bool`, `dict`, `enumerate`, `filter`, `float`, `int`, etc.
- ✅ **json**: Para manipulación de JSON
- ✅ **math**: Operaciones matemáticas (`math.sqrt`, `math.sin`, etc.)
- ✅ **re**: Expresiones regulares
- ✅ **datetime**: Manejo de fechas y horas
- ✅ **collections**: Estructuras de datos (`Counter`, `defaultdict`, etc.)
- ✅ **itertools**: Herramientas de iteración

### Ejemplo con módulos:

```python
def process(data):
    import math
    import datetime
    import re
    
    if isinstance(data, dict):
        # Operaciones matemáticas
        if 'radius' in data:
            area = math.pi * (data['radius'] ** 2)
        
        # Fecha actual
        now = datetime.datetime.now()
        
        # Validar email con regex
        email = data.get('email', '')
        is_valid_email = bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email))
        
        return {
            'area': area if 'radius' in data else None,
            'processed_at': now.isoformat(),
            'email_valid': is_valid_email
        }
    
    return data
```

## 🚫 Restricciones de Seguridad

Por seguridad, las siguientes operaciones **NO están permitidas**:

- ❌ Acceso a archivos (`open`, `file`, `read`, `write`)
- ❌ Imports arbitrarios (`__import__`, `import sys`)
- ❌ Ejecución de comandos del sistema (`os.system`, `subprocess`)
- ❌ Acceso a la red (excepto a través de nodos específicos)
- ❌ Modificación del entorno de ejecución

## ⏱️ Límites

- **Timeout**: 30 segundos máximo de ejecución
- **Memoria**: Limitada por el sistema

## 🐛 Manejo de Errores

Si tu código genera un error, el nodo fallará y el error se registrará:

```python
def process(data):
    # ❌ Esto causará un error si 'value' no existe
    return data['value'] * 2
    
    # ✅ Mejor: verificar primero
    if isinstance(data, dict) and 'value' in data:
        return data['value'] * 2
    return 0
```

## 🧪 Probar tu Código

Puedes probar tu nodo de Python con el script de test:

```bash
cd server/prefect-worker
py test_python_node.py
```

## 💡 Tips y Mejores Prácticas

1. **Siempre verifica los tipos de datos**
   ```python
   if isinstance(data, dict):
       # ...
   ```

2. **Maneja casos edge**
   ```python
   value = data.get('key', default_value)
   ```

3. **Retorna datos estructurados**
   ```python
   return {
       'result': processed_data,
       'metadata': {'count': len(data)}
   }
   ```

4. **Documenta tu código**
   ```python
   def process(data):
       """
       Procesa datos de usuarios y calcula estadísticas.
       
       Input: Lista de usuarios con 'age' y 'city'
       Output: Diccionario con estadísticas agregadas
       """
       # ...
   ```

5. **Prueba con datos reales**
   - Usa el endpoint de "Ejecutar nodo" en el frontend
   - Revisa los logs en caso de error

## 🔗 Integración con Otros Nodos

El output de tu nodo de Python se puede conectar a:

- **Output Node**: Para ver el resultado final
- **LLM Node**: Para procesar el resultado con IA
- **HTTP Node**: Para enviar el resultado a una API
- **Condition Node**: Para tomar decisiones basadas en el resultado
- **Otro Python Node**: Para procesamiento en múltiples etapas

## 📊 Ejemplo Completo: Pipeline de Datos

```python
def process(data):
    """
    Pipeline completo de procesamiento de datos
    """
    import datetime
    
    # 1. Validar input
    if not isinstance(data, list):
        return {'error': 'Expected list of records'}
    
    # 2. Filtrar datos válidos
    valid_records = [
        r for r in data 
        if isinstance(r, dict) and 'value' in r and r['value'] > 0
    ]
    
    # 3. Transformar
    transformed = [
        {
            **record,
            'value_squared': record['value'] ** 2,
            'category': 'high' if record['value'] > 100 else 'low'
        }
        for record in valid_records
    ]
    
    # 4. Calcular estadísticas
    values = [r['value'] for r in valid_records]
    total = sum(values)
    avg = total / len(values) if values else 0
    
    # 5. Retornar resultado estructurado
    return {
        'records': transformed,
        'statistics': {
            'total_count': len(data),
            'valid_count': len(valid_records),
            'invalid_count': len(data) - len(valid_records),
            'sum': total,
            'average': avg,
            'max': max(values) if values else 0,
            'min': min(values) if values else 0
        },
        'metadata': {
            'processed_at': datetime.datetime.now().isoformat(),
            'processor': 'python_node_v1'
        }
    }
```

## 🎯 Casos de Uso Comunes

1. **Transformación de datos**: Cambiar formato, calcular campos derivados
2. **Validación**: Verificar que los datos cumplan ciertos criterios
3. **Filtrado**: Seleccionar registros según condiciones complejas
4. **Agregación**: Calcular sumas, promedios, estadísticas
5. **Enriquecimiento**: Agregar campos calculados o metadatos
6. **Normalización**: Estandarizar formatos de datos

¡Disfruta programando tus workflows! 🚀

