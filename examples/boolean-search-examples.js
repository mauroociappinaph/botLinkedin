#!/usr/bin/env node

/**
 * Ejemplos de uso de búsquedas booleanas para LinkedIn Job Bot
 *
 * Este script demuestra diferentes configuraciones de búsqueda booleana
 * y cómo pueden mejorar la precisión de las búsquedas de trabajo.
 */

const { BooleanSearchBuilder } = require('../dist/search/BooleanSearchBuilder');
const { Logger, LogLevel } = require('../dist/utils/Logger');

// Configurar logger para los ejemplos
const logger = new Logger(LogLevel.INFO);
const builder = new BooleanSearchBuilder(logger);

console.log('🔍 Ejemplos de Búsquedas Booleanas para LinkedIn Job Bot\n');

// Ejemplos de configuraciones de búsqueda
const examples = [
  {
    name: '1. Búsqueda Básica - Desarrollador Frontend',
    config: {
      enabled: true,
      expression: '"Frontend developer" AND (React OR Vue OR Angular) AND remote',
      fallbackKeywords: ['Frontend developer', 'React', 'remote'],
      validateSyntax: true
    }
  },
  {
    name: '2. Búsqueda Avanzada - Full Stack Senior',
    config: {
      enabled: true,
      expression: '("full stack" OR "fullstack") AND (senior OR lead) AND (JavaScript OR TypeScript) AND -junior AND -intern',
      fallbackKeywords: ['full stack developer', 'senior', 'JavaScript'],
      validateSyntax: true
    }
  },
  {
    name: '3. Búsqueda Multiidioma - España',
    config: {
      enabled: true,
      expression: '("desarrollador" OR "developer") AND ("remoto" OR "remote") AND (React OR Vue) AND (Madrid OR Barcelona OR "trabajo remoto")',
      fallbackKeywords: ['desarrollador', 'developer', 'remoto', 'React'],
      validateSyntax: true
    }
  },
  {
    name: '4. Búsqueda por Stack Tecnológico',
    config: {
      enabled: true,
      expression: 'React AND ("Node.js" OR Express) AND (MongoDB OR PostgreSQL) AND remote AND -junior',
      fallbackKeywords: ['React', 'Node.js', 'remote'],
      validateSyntax: true
    }
  },
  {
    name: '5. Búsqueda con Exclusiones Múltiples',
    config: {
      enabled: true,
      expression: '"software engineer" AND remote AND -intern AND -junior AND -student AND -entry',
      fallbackKeywords: ['software engineer', 'remote'],
      validateSyntax: true
    }
  },
  {
    name: '6. Búsqueda por Tipo de Empresa',
    config: {
      enabled: true,
      expression: '"frontend developer" AND (startup OR "tech company" OR fintech OR "remote first") AND (React OR Vue)',
      fallbackKeywords: ['frontend developer', 'startup', 'React'],
      validateSyntax: true
    }
  }
];

// Función para mostrar resultados de validación
function showValidationResults(validation) {
  if (validation.isValid) {
    console.log('   ✅ Expresión válida');
    console.log(`   📊 Términos encontrados: ${validation.parsedTerms.length}`);

    const phrases = validation.parsedTerms.filter(t => t.isPhrase);
    const negated = validation.parsedTerms.filter(t => t.isNegated);
    const required = validation.parsedTerms.filter(t => t.isRequired);

    if (phrases.length > 0) {
      console.log(`   💬 Frases exactas: ${phrases.map(p => `"${p.term}"`).join(', ')}`);
    }
    if (negated.length > 0) {
      console.log(`   ❌ Términos excluidos: ${negated.map(n => n.term).join(', ')}`);
    }
    if (required.length > 0) {
      console.log(`   ✔️ Términos requeridos: ${required.map(r => r.term).join(', ')}`);
    }
  } else {
    console.log('   ❌ Expresión inválida');
    validation.errors.forEach(error => {
      console.log(`   🚨 Error: ${error}`);
    });
  }

  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warning => {
      console.log(`   ⚠️ Advertencia: ${warning}`);
    });
  }
}

// Ejecutar ejemplos
examples.forEach((example, index) => {
  console.log(`\n${example.name}`);
  console.log('─'.repeat(50));
  console.log(`📝 Expresión: ${example.config.expression}`);

  // Validar la expresión
  const validation = builder.validateBooleanExpression(example.config.expression);
  showValidationResults(validation);

  // Construir la consulta
  const query = builder.buildSearchQuery(example.config);
  console.log(`🔍 Consulta optimizada: ${query}`);

  // Mostrar palabras clave de respaldo
  if (example.config.fallbackKeywords) {
    console.log(`🔄 Respaldo: ${example.config.fallbackKeywords.join(', ')}`);
  }
});

// Mostrar ejemplos de expresiones problemáticas
console.log('\n\n🚨 Ejemplos de Expresiones Problemáticas\n');
console.log('─'.repeat(50));

const problematicExamples = [
  {
    name: 'Paréntesis desbalanceados',
    expression: '(React AND developer'
  },
  {
    name: 'Operadores consecutivos',
    expression: 'React AND OR developer'
  },
  {
    name: 'Frase vacía',
    expression: 'React AND ""'
  },
  {
    name: 'Expresión demasiado larga',
    expression: 'a'.repeat(1001)
  }
];

problematicExamples.forEach(example => {
  console.log(`\n❌ ${example.name}`);
  console.log(`📝 Expresión: ${example.expression.length > 50 ? example.expression.substring(0, 50) + '...' : example.expression}`);

  const validation = builder.validateBooleanExpression(example.expression);
  showValidationResults(validation);
});

// Mostrar mejores prácticas
console.log('\n\n💡 Mejores Prácticas\n');
console.log('─'.repeat(50));

const bestPractices = [
  '✅ Usa comillas para frases exactas: "React developer"',
  '✅ Combina términos en español e inglés: ("desarrollador" OR "developer")',
  '✅ Excluye términos no deseados: developer AND -junior',
  '✅ Usa agrupación para consultas complejas: (React OR Vue) AND remote',
  '✅ Mantén las expresiones legibles y no demasiado largas',
  '✅ Siempre define fallbackKeywords como respaldo',
  '✅ Habilita validateSyntax para detectar errores temprano'
];

bestPractices.forEach(practice => {
  console.log(practice);
});

// Mostrar configuración completa de ejemplo
console.log('\n\n📋 Configuración Completa de Ejemplo\n');
console.log('─'.repeat(50));

const fullConfig = {
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
      "expression": "(\"React developer\" OR \"Frontend developer\") AND (remote OR \"trabajo remoto\") AND -junior AND -intern",
      "fallbackKeywords": [
        "React developer",
        "Frontend developer",
        "remote work"
      ],
      "validateSyntax": true
    }
  }
};

console.log(JSON.stringify(fullConfig, null, 2));

console.log('\n\n🎯 ¡Listo para usar búsquedas booleanas más precisas!\n');
console.log('📚 Consulta docs/boolean-search-guide.md para más información');
console.log('⚙️ Usa config-boolean-example.json como plantilla');
