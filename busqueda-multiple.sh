#!/bin/bash

echo "🚀 Iniciando búsqueda múltiple para trabajo remoto en países hispanos..."

# Configuración 1: Remote global
echo "📍 Búsqueda 1: Remote (Global)"
cp config.json config-backup.json
npm start

echo "⏳ Esperando 30 segundos antes de la siguiente búsqueda..."
sleep 30

# Configuración 2: España específico
echo "📍 Búsqueda 2: España"
cp config-hispano.json config.json
npm start

echo "⏳ Esperando 30 segundos antes de la siguiente búsqueda..."
sleep 30

# Configuración 3: México
echo "📍 Búsqueda 3: México"
sed 's/"España"/"México"/g' config-hispano.json > config-temp.json
cp config-temp.json config.json
npm start

# Restaurar configuración original
cp config-backup.json config.json
rm config-backup.json config-temp.json

echo "✅ Búsqueda múltiple completada!"
