# ANIRUL - Sistema de Bitácora RPG

Aplicación de escritorio para gestionar combates RPG turn-based con estética Sci-Fi terminal futurista.

## Instalación

1. Asegúrate de tener [Node.js](https://nodejs.org/) instalado
2. Haz doble clic en `INSTALAR.bat`
3. Espera a que termine la instalación

## Ejecución

Haz doble clic en `INICIAR_ANIRUL.bat`

## Uso

1. **PERFILES** - Crea un perfil de personaje
   - Ingresa nombre y stats
   - Carga archivos .txt de habilidades desde tu repositorio
   - Haz clic en GUARDAR

2. **NUEVO COMBATE** - Inicia un combate
   - Selecciona un perfil
   - Usa habilidades, recibe daño, regenera
   - Gestiona adversarios
   - Finaliza rondas para resetear PA

## Estructura

```
Anirul-Electron/
├── main.js           # Proceso principal de Electron
├── package.json      # Configuración del proyecto
├── src/
│   ├── index.html    # Interfaz principal
│   ├── css/
│   │   └── styles.css  # Estilos Sci-Fi
│   └── js/
│       ├── app.js      # Lógica de la aplicación
│       └── parser.js   # Parser de habilidades
└── data/
    └── perfiles/     # Perfiles guardados
```

## Tecnologías

- Electron
- HTML/CSS/JavaScript
- Node.js
