const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0a0a0f',
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'icon.png')
    });

    mainWindow.loadFile('src/index.html');

    // Descomentar para debug
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handlers

// Minimizar, maximizar, cerrar
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => mainWindow.close());

// Diálogo para seleccionar archivos
ipcMain.handle('dialog-open-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Archivos de texto', extensions: ['txt'] }],
        defaultPath: 'C:\\Users\\Usuario\\Documents\\GitHub\\backbone'
    });
    return result.filePaths;
});

// Leer archivo
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Guardar archivo
ipcMain.handle('save-file', async (event, filePath, content) => {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Obtener ruta de datos
ipcMain.handle('get-data-path', () => {
    return path.join(__dirname, 'data');
});

// Listar archivos en directorio
ipcMain.handle('list-files', async (event, dirPath, extension) => {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            return [];
        }
        const files = fs.readdirSync(dirPath)
            .filter(f => f.endsWith(extension));
        return files;
    } catch (error) {
        return [];
    }
});

// Guardar perfil
ipcMain.handle('save-profile', async (event, profile) => {
    try {
        const perfilesPath = path.join(__dirname, 'data', 'perfiles');
        if (!fs.existsSync(perfilesPath)) {
            fs.mkdirSync(perfilesPath, { recursive: true });
        }
        const filePath = path.join(perfilesPath, `${profile.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Cargar perfiles
ipcMain.handle('load-profiles', async () => {
    try {
        const perfilesPath = path.join(__dirname, 'data', 'perfiles');
        if (!fs.existsSync(perfilesPath)) {
            return [];
        }
        const files = fs.readdirSync(perfilesPath).filter(f => f.endsWith('.json'));
        const profiles = files.map(f => {
            const content = fs.readFileSync(path.join(perfilesPath, f), 'utf-8');
            return JSON.parse(content);
        });
        return profiles;
    } catch (error) {
        return [];
    }
});

// Eliminar perfil
ipcMain.handle('delete-profile', async (event, profileId) => {
    try {
        const filePath = path.join(__dirname, 'data', 'perfiles', `${profileId}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
