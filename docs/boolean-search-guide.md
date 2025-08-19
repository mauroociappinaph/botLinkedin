# Guía de Búsquedas Booleanas para LinkedIn Job Bot

## Introducción

Las búsquedas booleanas permiten crear consultas más precisas y específicas en LinkedIn utilizando operadores lógicos. Esta funcionalidad te ayuda a encontrar exactamente los trabajos que buscas, reduciendo el ruido y mejorando la relevancia de los resultados.

## Configuración Básica

Para habilitar las búsquedas booleanas, agrega la sección `booleanSearch` a tu configuración:

```json
{
  "search": {
    "keywords": ["fallback", "keywords"],
    "booleanSearch": {
      "enabled": true,
      "expression": "tu expresión booleana aquí",
      "fallbackKeywords": ["palabras", "clave", "respaldo"],
      "validateSyntax": true
    }
  }
}
```

### Parámetros de Configuración

- **`enabled`**: `true/false` - Activa o desactiva las búsquedas booleanas
- **`expression`**: `string` - La expresión booleana a utilizar
- **`fallbackKeywords`**: `array` - Palabras clave de respaldo si falla la expresión booleana
- **`validateSyntax`**: `boolean` - Valida la sintaxis antes de ejecutar (recomendado: `true`)

## Operadores Booleanos Soportados

### 1. AND (Y)
Encuentra resultados que contengan **todos** los términos especificados.

```
"React developer" AND remote
```
*Busca trabajos que contengan tanto "React developer" como "remote"*

### 2. OR (O)
Encuentra resultados que contengan **cualquiera** de los términos especificados.

```
JavaScript OR TypeScript OR Node.js
```
*Busca trabajos que contengan JavaScript, TypeScript o Node.js*

### 3. NOT (NO) / - (Menos)
Excluye resultados que contengan el término especificado.

```
developer NOT junior
developer -junior
```
*Busca "developer" pero excluye trabajos que contengan "junior"*

### 4. Frases Exactas ("")
Busca la frase exacta entre comillas.

```
"full stack developer"
```
*Busca exactamente la frase "full stack developer"*

### 5. Términos Requeridos (+)
Hace que un término sea obligatorio.

```
+remote +developer
```
*Tanto "remote" como "developer" deben aparecer en los resultados*

### 6. Agrupación con Paréntesis ()
Agrupa términos para controlar la precedencia de operadores.

```
(React OR Vue) AND (remote OR "work from home")
```
*Busca trabajos con React o Vue, Y que sean remotos o "work from home"*

## Ejemplos Prácticos

### Búsqueda Básica para Desarrollador Frontend
```json
{
  "expression": "\"Frontend developer\" AND (React OR Vue OR Angular) AND remote"
}
```

### Búsqueda para Desarrollador Full Stack Senior
```json
{
  "expression": "(\"full stack\" OR \"fullstack\") AND (senior OR lead) AND (JavaScript OR TypeScript) AND -junior"
}
```

### Búsqueda Específica para España
```json
{
  "expression": "developer AND (Madrid OR Barcelona OR \"remote Spain\") AND (React OR Node.js)"
}
```

### Búsqueda con Exclusiones Múltiples
```json
{
  "expression": "\"software engineer\" AND remote AND -intern AND -junior AND -student"
}
```

### Búsqueda por Stack Tecnológico
```json
{
  "expression": "\"React\" AND (\"Node.js\" OR \"Express\") AND (MongoDB OR PostgreSQL) AND remote"
}
```

### Búsqueda Multiidioma
```json
{
  "expression": "(\"desarrollador\" OR \"developer\") AND (\"remoto\" OR \"remote\") AND (React OR Vue)"
}
```

## Ejemplos Avanzados

### Búsqueda por Nivel de Experiencia
```json
{
  "expression": "developer AND (\"3+ years\" OR \"3-5 years\" OR \"mid level\" OR \"intermediate\") AND React"
}
```

### Búsqueda por Tipo de Empresa
```json
{
  "expression": "\"frontend developer\" AND (startup OR \"tech company\" OR fintech) AND remote"
}
```

### Búsqueda con Salario
```json
{
  "expression": "developer AND remote AND (\"50k\" OR \"€50,000\" OR \"competitive salary\")"
}
```

## Mejores Prácticas

### 1. Usa Frases Exactas para Términos Específicos
```
✅ "React developer"
❌ React developer
```

### 2. Combina Términos en Español e Inglés
```json
{
  "expression": "(\"desarrollador frontend\" OR \"frontend developer\") AND (\"remoto\" OR \"remote\")"
}
```

### 3. Excluye Términos No Deseados
```json
{
  "expression": "developer AND remote AND -intern AND -junior AND -student"
}
```

### 4. Usa Agrupación para Consultas Complejas
```json
{
  "expression": "(React OR Vue OR Angular) AND (\"senior developer\" OR \"lead developer\") AND (remote OR \"trabajo remoto\")"
}
```

### 5. Mantén las Expresiones Legibles
```json
{
  "expression": "\"full stack developer\" AND (Python OR Node.js) AND remote AND -junior"
}
```

## Limitaciones y Consideraciones

### Límites de LinkedIn
- **Longitud máxima**: 1000 caracteres por consulta
- **Términos máximos**: 50 términos por expresión
- **Longitud de frase**: 100 caracteres por frase entre comillas

### Rendimiento
- Expresiones muy complejas pueden ser más lentas
- Demasiados términos pueden reducir la efectividad
- LinkedIn puede limitar consultas muy específicas

### Fallback Automático
Si la expresión booleana falla, el bot automáticamente usará:
1. Las `fallbackKeywords` si están definidas
2. Las `keywords` regulares como respaldo final

## Validación de Sintaxis

El bot valida automáticamente:
- ✅ Paréntesis balanceados
- ✅ Secuencias de operadores válidas
- ✅ Frases entre comillas correctas
- ✅ Longitud de expresión y términos
- ⚠️ Términos reservados de LinkedIn

## Configuración Completa de Ejemplo

```json
{
  "search": {
    "keywords": [
      "software engineer",
      "developer",
      "remote work"
    ],
    "location": "España",
    "datePosted": "pastWeek",
    "remoteWork": true,
    "experienceLevel": ["entry", "associate", "mid"],
    "jobType": ["fullTime", "contract"],
    "booleanSearch": {
      "enabled": true,
      "expression": "(\"React developer\" OR \"Frontend developer\" OR \"Full stack developer\") AND (remote OR \"trabajo remoto\" OR \"work from home\") AND -junior AND -intern",
      "fallbackKeywords": [
        "React developer",
        "Frontend developer",
        "remote work"
      ],
      "validateSyntax": true
    }
  }
}
```

## Solución de Problemas

### Error: "Invalid boolean expression"
- Verifica que los paréntesis estén balanceados
- Asegúrate de que las comillas estén cerradas
- Revisa que no haya operadores consecutivos (ej: "AND OR")

### Error: "Expression too long"
- Reduce la longitud de la expresión
- Usa términos más cortos
- Elimina términos redundantes

### Pocos Resultados
- Usa más operadores OR
- Reduce el número de términos requeridos
- Elimina algunas exclusiones (NOT/-)

### Demasiados Resultados Irrelevantes
- Agrega más términos específicos con AND
- Usa frases exactas entre comillas
- Agrega más exclusiones con NOT/-

## Recursos Adicionales

- [Documentación oficial de LinkedIn sobre búsquedas](https://www.linkedin.com/help/linkedin/answer/75814)
- [Guía de operadores booleanos](https://www.linkedin.com/help/linkedin/answer/129387)
- Archivo de ejemplo: `config-boolean-example.json`
