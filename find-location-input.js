const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteerExtra.use(StealthPlugin());

async function findLocationInput() {
  console.log('🔍 Buscando el campo de ubicación en LinkedIn...');

  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: false,
      slowMo: 100
    });

    const page = await browser.newPage();

    // Cargar cookies si existen
    if (fs.existsSync('./cookies.json')) {
      const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf8'));
      if (cookies.cookies) {
        for (const cookie of cookies.cookies) {
          await page.setCookie(cookie);
        }
      }
    }

    // Ir a la página de empleos
    await page.goto('https://www.linkedin.com/jobs/', {
      waitUntil: 'networkidle2'
    });

    console.log('📍 Página cargada, buscando campos de entrada...');

    // Buscar todos los inputs en la página
    const allInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(input => ({
        tagName: input.tagName,
        type: input.type,
        placeholder: input.placeholder,
        ariaLabel: input.getAttribute('aria-label'),
        className: input.className,
        id: input.id,
        name: input.name,
        value: input.value
      }));
    });

    console.log('\n🔍 Todos los campos de entrada encontrados:');
    allInputs.forEach((input, index) => {
      console.log(`\n${index + 1}. Input:`);
      console.log(`   - Type: ${input.type}`);
      console.log(`   - Placeholder: "${input.placeholder}"`);
      console.log(`   - Aria-label: "${input.ariaLabel}"`);
      console.log(`   - Class: "${input.className}"`);
      console.log(`   - ID: "${input.id}"`);
      console.log(`   - Name: "${input.name}"`);
    });

    // Buscar específicamente campos que podrían ser de ubicación
    const locationInputs = allInputs.filter(input =>
      (input.placeholder && (
        input.placeholder.toLowerCase().includes('ubicación') ||
        input.placeholder.toLowerCase().includes('location') ||
        input.placeholder.toLowerCase().includes('ciudad') ||
        input.placeholder.toLowerCase().includes('city') ||
        input.placeholder.toLowerCase().includes('lugar') ||
        input.placeholder.toLowerCase().includes('place')
      )) ||
      (input.ariaLabel && (
        input.ariaLabel.toLowerCase().includes('ubicación') ||
        input.ariaLabel.toLowerCase().includes('location') ||
        input.ariaLabel.toLowerCase().includes('ciudad') ||
        input.ariaLabel.toLowerCase().includes('city') ||
        input.ariaLabel.toLowerCase().includes('lugar') ||
        input.ariaLabel.toLowerCase().includes('place')
      ))
    );

    console.log('\n🌍 Campos de ubicación potenciales:');
    if (locationInputs.length > 0) {
      locationInputs.forEach((input, index) => {
        console.log(`\n✅ Campo ${index + 1}:`);
        console.log(`   - Placeholder: "${input.placeholder}"`);
        console.log(`   - Aria-label: "${input.ariaLabel}"`);
        console.log(`   - Class: "${input.className}"`);
        console.log(`   - ID: "${input.id}"`);

        // Generar selector sugerido
        let selector = '';
        if (input.id) {
          selector = `#${input.id}`;
        } else if (input.className) {
          selector = `.${input.className.split(' ')[0]}`;
        } else if (input.ariaLabel) {
          selector = `input[aria-label="${input.ariaLabel}"]`;
        }
        console.log(`   - Selector sugerido: "${selector}"`);
      });
    } else {
      console.log('❌ No se encontraron campos de ubicación obvios');
      console.log('💡 Esto podría significar que:');
      console.log('   1. El campo de ubicación se carga dinámicamente');
      console.log('   2. LinkedIn cambió la estructura');
      console.log('   3. Necesitas hacer clic en el campo de búsqueda primero');
    }

    // Tomar screenshot para análisis manual
    await page.screenshot({ path: 'location-debug.png', fullPage: true });
    console.log('\n📸 Screenshot guardado como location-debug.png');

    console.log('\n🔄 Manteniendo navegador abierto para inspección manual...');
    console.log('Presiona Ctrl+C para cerrar');

    // Mantener abierto
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Manejo de señales para cierre limpio
process.on('SIGINT', async () => {
  console.log('\n🔄 Cerrando...');
  process.exit(0);
});

findLocationInput().catch(console.error);
