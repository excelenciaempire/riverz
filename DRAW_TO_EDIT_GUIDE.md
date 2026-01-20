# Draw to Edit - Guía de Usuario

## Introducción

La funcionalidad Draw to Edit permite editar imágenes de manera intuitiva mediante:
- Dibujo directo de máscaras para marcar áreas a editar
- Añadir elementos decorativos (texto, formas, imágenes)
- Prompts opcionales para guiar la edición con IA
- Sistema de capas para organizar elementos
- Vista dividida para comparar antes/después

## Características Principales

### 🎨 Herramientas de Dibujo

#### Seleccionar (V)
- Mueve, redimensiona y rota objetos
- Selección múltiple con Ctrl/Cmd + clic
- Arrastra para crear selección de área

#### Pincel (P)
- Dibuja trazos libres
- Ajusta tamaño y color en el panel de propiedades
- Útil para añadir anotaciones

#### Borrador (E)
- Elimina partes de trazos
- Tamaño ajustable

#### Modo Máscara (M)
- **Importante**: Marca áreas que quieres editar con IA
- Color rojo semi-transparente distintivo
- Los trazos de máscara indican a la IA dónde aplicar cambios
- Se excluyen de la imagen final

### 📝 Elementos

#### Texto (T)
- Añade texto editable
- Doble clic para editar contenido
- Propiedades: fuente, tamaño, color, opacidad

#### Formas
- **Rectángulo (R)**: Cuadrados y rectángulos
- **Círculo (C)**: Círculos y elipses
- **Triángulo**: Formas triangulares
- **Línea**: Líneas rectas

Todas las formas tienen propiedades ajustables:
- Color de relleno
- Color y grosor de borde
- Opacidad

#### Imágenes
- Sube imágenes adicionales sobre la base
- Redimensiona y posiciona libremente
- Ajusta opacidad

### 🗂️ Sistema de Capas

Panel lateral derecho que muestra todas las capas:

- **Visibilidad**: Ojo para mostrar/ocultar
- **Bloqueo**: Candado para evitar ediciones accidentales
- **Reordenar**: Arrastra capas para cambiar orden Z
- **Opciones**: Menú con duplicar, renombrar, eliminar
- **Selección**: Clic en capa para seleccionarla en canvas

### ⌨️ Atajos de Teclado

#### Herramientas
- `V` - Seleccionar
- `T` - Texto
- `P` - Pincel
- `E` - Borrador
- `M` - Modo máscara
- `R` - Rectángulo
- `C` - Círculo

#### Acciones
- `Ctrl/Cmd + Z` - Deshacer
- `Ctrl/Cmd + Shift + Z` - Rehacer
- `Ctrl/Cmd + D` - Duplicar selección
- `Ctrl/Cmd + G` - Agrupar objetos
- `Delete/Backspace` - Eliminar selección
- `Escape` - Deseleccionar

#### Navegación
- `Flechas` - Mover objeto 1px
- `Shift + Flechas` - Mover objeto 10px

## Flujo de Trabajo

### 1. Cargar Imagen
- Arrastra o haz clic en el área de carga
- También puedes usar el botón de imagen en la barra lateral

### 2. Marcar Áreas a Editar
- Selecciona el modo máscara (M)
- Dibuja sobre las áreas que quieres modificar
- Usa trazos rojos para indicar zonas de edición

### 3. Añadir Contexto (Opcional)
- Añade textos, formas o imágenes de referencia
- Estos elementos ayudan a la IA a entender el contexto
- No se incluyen en las áreas de máscara

### 4. Escribir Prompt (Opcional)
- Usa el campo flotante superior
- Describe los cambios deseados
- Ejemplo: "Cambiar el cielo a atardecer", "Eliminar objeto marcado"

### 5. Generar
- Clic en "Editar" (100 créditos)
- La IA procesa las máscaras y el prompt
- Espera mientras se genera

### 6. Comparar Resultados
- Vista dividida automática
- Original a la izquierda
- Resultado a la derecha

### 7. Opciones Post-Generación
- **Usar Anterior**: Vuelve a la versión previa
- **Redo**: Regenera con los mismos parámetros
- **Reiniciar**: Vuelve a la imagen original
- **Editar**: Continúa editando para refinar
- **Descargar**: Guarda el resultado

## Consejos y Mejores Prácticas

### Uso de Máscaras
✅ **Hacer:**
- Marca áreas claramente con trazos completos
- Usa máscaras más grandes para cambios generales
- Máscaras pequeñas para detalles precisos

❌ **Evitar:**
- Máscaras muy pequeñas o fragmentadas
- Marcas ambiguas
- Demasiadas máscaras desconectadas

### Prompts Efectivos
✅ **Buenos ejemplos:**
- "Cambiar el color del cielo a azul brillante"
- "Eliminar el objeto marcado en rojo"
- "Añadir más vegetación en el área marcada"
- "Mejorar la iluminación de la cara"

❌ **Menos efectivos:**
- "Mejorar"
- "Cambiar"
- "Editar esto"

### Organización
- Nombra las capas descriptivamente
- Agrupa elementos relacionados
- Bloquea capas que no quieres mover
- Oculta elementos temporalmente para trabajar mejor

## Limitaciones Técnicas

- **Tamaño máximo de canvas**: 4096x4096px
- **Límite de capas**: 50 capas máximo
- **Límite de historial**: 50 acciones
- **Formato de salida**: PNG
- **Tiempo máximo de generación**: 2 minutos

## Costos

- **Draw to Edit**: 100 créditos por generación
- Los créditos se deducen al iniciar la generación
- No se cobra si la generación falla

## Solución de Problemas

### La IA no entiende mis ediciones
- Asegúrate de usar máscaras claras
- Añade un prompt descriptivo
- Verifica que las máscaras cubran el área correcta

### Las capas no se muestran
- Verifica que la capa esté visible (ojo abierto)
- Comprueba el orden Z de las capas
- Refresca el panel de capas

### El canvas no responde
- Verifica que no haya demasiados objetos
- Intenta reducir la resolución de imágenes grandes
- Recarga la página si es necesario

### Error de créditos insuficientes
- Verifica tu saldo en la esquina superior
- Compra más créditos si es necesario
- Basic: 2000 créditos/mes
- Pro: 5500 créditos/mes
- Premium: 12000 créditos/mes

## Soporte

Si encuentras problemas o tienes sugerencias:
1. Verifica esta guía primero
2. Consulta los logs del navegador (F12)
3. Contacta al soporte con detalles del problema

---

*Última actualización: Enero 2026*
*Versión: 1.0.0*
