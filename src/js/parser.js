/**
 * ANIRUL - Parser de Habilidades
 * Parsea archivos .txt de habilidades RPG
 */

class SkillParser {
    constructor() {
        // Patrones para separadores (=, -, █)
        this.separatorPattern = /^[=\-█]{10,}$/;

        // Patrones para secciones
        this.sectionPatterns = {
            passive: /^HABILIDADES?\s*PASIVAS?$/i,
            active: /^HABILIDADES?\s*(ACTIVAS?|BÁSICAS?)$/i,
            rank: /^RANGO\s+(ÚNICO|I{1,3}V?|IV|V|VI?)$/i
        };

        // Títulos de documento a ignorar
        this.documentTitles = [
            'PERFIL BÁSICO', 'PERFIL BASICO',
            'TOMO MÁGICO', 'TOMO MAGICO',
            'COMANDOS BÁSICOS', 'COMANDOS BASICOS'
        ];
    }

    parseFile(content, fileName, filePath) {
        const skills = [];
        const lines = content.split('\n');

        let currentSection = 'active'; // 'active' or 'passive'
        let blockLines = [];
        let isCollectingBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Ignorar líneas vacías
            if (!trimmed) continue;

            // Ignorar separadores
            if (this.separatorPattern.test(trimmed)) continue;

            // Detectar cambio de sección
            if (this.sectionPatterns.passive.test(trimmed)) {
                currentSection = 'passive';
                continue;
            }

            if (this.sectionPatterns.active.test(trimmed) || this.sectionPatterns.rank.test(trimmed)) {
                currentSection = 'active';
                continue;
            }

            // Ignorar títulos de documento
            if (this.isDocumentTitle(trimmed)) continue;

            // Detectar inicio de habilidad
            if (this.isSkillName(trimmed)) {
                // Guardar bloque anterior si existe
                if (blockLines.length > 0) {
                    const skill = this.parseBlock(blockLines, fileName, filePath);
                    if (skill) skills.push(skill);
                }

                // Iniciar nuevo bloque
                blockLines = [{
                    text: trimmed,
                    isPassiveSection: currentSection === 'passive'
                }];
                isCollectingBlock = true;
                continue;
            }

            // Agregar línea al bloque actual
            if (isCollectingBlock) {
                blockLines.push({ text: trimmed });
            }
        }

        // Procesar último bloque
        if (blockLines.length > 0) {
            const skill = this.parseBlock(blockLines, fileName, filePath);
            if (skill) skills.push(skill);
        }

        return skills;
    }

    isDocumentTitle(line) {
        const upper = line.toUpperCase();

        // Títulos exactos
        if (this.documentTitles.includes(upper)) return true;

        // Títulos que son solo texto en mayúsculas sin estructura de habilidad
        // Ej: "ARMAS DE FUEGO", "COMBATIENTE ÁGIL", "MÍSTICO"
        if (/^[A-ZÁÉÍÓÚÑ\s]+$/.test(line) && line === line.toUpperCase()) {
            const commonTitles = [
                'ARMAS DE FUEGO', 'ARMAS DE FILO', 'ARMAS CONTUNDENTES',
                'ARMAS ARROJADIZAS', 'CIENTÍFICO', 'COMBATIENTE BRUTO',
                'COMBATIENTE ÁGIL', 'COMBATIENTE AGIL', 'LÍDER', 'LIDER',
                'MÍSTICO', 'MISTICO', 'PARAMÉDICO', 'PARAMEDICO',
                'MAGIA VISHANTI', 'MAGIA OSCURA', 'MAGIA NÓRDICA',
                'MAGIA DE LA TIERRA', 'MAGIA INFERNAL', 'MAGIA VOODOO',
                'MAGIA ARCANA'
            ];
            if (commonTitles.includes(upper)) return true;
        }

        return false;
    }

    isSkillName(line) {
        // Formato [CATEGORÍA] - NOMBRE o [CATEGORÍA] – NOMBRE o [CATEGORÍA] NOMBRE
        if (/^\[.+\]/.test(line)) return true;

        // Nombre en mayúsculas (mínimo 3 caracteres, puede tener espacios, guiones, comillas, signos)
        // Ejemplos: "PATADA RÁPIDA", "PERCEPCIÓN ARÁCNIDA – "SPIDER SENSE"", "ORDEN: ¡CON TODO!"
        if (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\-–—:¡!¿?"'""\(\)]+$/.test(line) && line.length >= 3) {
            // Excluir secciones y títulos
            const upper = line.toUpperCase();
            if (this.sectionPatterns.passive.test(line)) return false;
            if (this.sectionPatterns.active.test(line)) return false;
            if (this.sectionPatterns.rank.test(line)) return false;
            if (this.isDocumentTitle(line)) return false;
            return true;
        }

        return false;
    }

    parseBlock(lines, fileName, filePath) {
        if (!lines || lines.length < 2) return null;

        const firstLine = lines[0];
        const isPassiveSection = firstLine.isPassiveSection || false;

        const skill = {
            id: null,
            nombre: null,
            categoria: null,
            tipo: null,
            clasificacion: null,
            alcance: null,
            costo_pa: 1,
            costo_exp: null,
            tier: null,
            efecto_visual: null,
            efecto: null,
            aclaraciones: [],
            fuente: fileName,
            ruta_fuente: filePath,
            usos_en_ronda: 0,
            esPasiva: isPassiveSection
        };

        // Parsear primera línea (nombre)
        const nameInfo = this.parseSkillName(firstLine.text);
        skill.nombre = nameInfo.nombre;
        skill.categoria = nameInfo.categoria;

        // Si la categoría indica pasiva
        if (skill.categoria) {
            const catLower = skill.categoria.toLowerCase();
            if (catLower.includes('pasiv') || catLower.includes('parafernalia')) {
                skill.esPasiva = true;
            }
        }

        // Parsear resto de líneas
        let inClarifications = false;
        let effectLines = [];
        let effectVisualLines = [];
        let readingEffect = false;
        let readingVisual = false;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].text || lines[i];

            // Aclaraciones
            if (/^ACLARACIONES?:?\s*$/i.test(line)) {
                inClarifications = true;
                readingEffect = false;
                readingVisual = false;
                continue;
            }

            if (inClarifications) {
                const cleaned = line.replace(/^[-•]\s*/, '').trim();
                if (cleaned && !/^N\/A\.?$/i.test(cleaned) && cleaned !== '-') {
                    skill.aclaraciones.push(cleaned);
                }
                continue;
            }

            // Tipo y clasificación
            // Formatos: "Física — Ofensiva", "Habilidad Pasiva", "Accesorio – Parafernalia", "Pasiva", "Orden - Suplementaria"
            const typeMatch = line.match(/^([\w\s\/áéíóúñÁÉÍÓÚÑ]+)\s*[-–—]\s*([\w\s\/áéíóúñÁÉÍÓÚÑ]+)$/i);
            if (typeMatch && !skill.tipo) {
                skill.tipo = typeMatch[1].trim();
                skill.clasificacion = typeMatch[2].trim();

                // Detectar pasiva por tipo
                const tipo = skill.tipo.toLowerCase();
                const clasif = skill.clasificacion.toLowerCase();
                if (tipo.includes('pasiv') || tipo.includes('parafernalia') ||
                    clasif.includes('pasiv') || clasif.includes('parafernalia')) {
                    skill.esPasiva = true;
                }
                continue;
            }

            // Tipo solo (sin clasificación): "Habilidad Pasiva", "Pasiva"
            if (/^(Habilidad\s+)?Pasiva$/i.test(line) && !skill.tipo) {
                skill.tipo = 'Pasiva';
                skill.esPasiva = true;
                continue;
            }

            // EXP
            const expMatch = line.match(/^(\d+)\s*EXP/i);
            if (expMatch) {
                skill.costo_exp = parseInt(expMatch[1]);
                continue;
            }

            // Alcance - múltiples formatos
            // "Alcance: 1", "Alcance 1", "Alcance Arma", "Alcance Variable", "Alcance propio"
            // "Área 2 sobre el usuario", "Cónico 4", "3x3", "Alcance 5, Área 2"
            const rangeMatch = line.match(/^(?:Alcance[:\s]*)([\w\d\s,áéíóúñ"]+)$/i);
            if (rangeMatch && !skill.alcance) {
                skill.alcance = rangeMatch[1].trim();
                continue;
            }

            // Cónico, Área, o patrón NxN
            if (/^(Cónico|Área|Conico|Area|\d+x\d+)/i.test(line) && !skill.alcance) {
                skill.alcance = line.trim();
                continue;
            }

            // TIER
            const tierMatch = line.match(/^TIER[:\s]*(\d+)/i);
            if (tierMatch) {
                skill.tier = parseInt(tierMatch[1]);
                continue;
            }

            // "No clasificada" o "No clasificado"
            if (/^No\s+clasificad[ao]$/i.test(line)) {
                skill.tier = 0;
                continue;
            }

            // PA Variable
            if (/^PA\s+Variable$/i.test(line)) {
                skill.costo_pa = 0;
                continue;
            }

            // PA: X o Costo: X
            const paMatch = line.match(/^(?:PA|Coste|Costo)[:\s]*(Variable|\d+)/i);
            if (paMatch) {
                const value = paMatch[1];
                skill.costo_pa = value.toLowerCase() === 'variable' ? 0 : parseInt(value);
                continue;
            }

            // Efecto visual (varios formatos)
            const visualMatch = line.match(/^(?:Efecto\s+visual|EFECTO\s+VISUAL)[:\s]*(.*)$/i);
            if (visualMatch) {
                const content = visualMatch[1].trim();
                if (content) {
                    effectVisualLines = [content];
                } else {
                    effectVisualLines = [];
                }
                readingVisual = true;
                readingEffect = false;
                continue;
            }

            // Efecto (pero no "Efecto visual")
            const effectMatch = line.match(/^Efecto[:\s]*(.*)$/i);
            if (effectMatch && !line.toLowerCase().includes('visual')) {
                const content = effectMatch[1].trim();
                if (content) {
                    effectLines = [content];
                } else {
                    effectLines = [];
                }
                readingEffect = true;
                readingVisual = false;
                continue;
            }

            // Continuación de efectos
            if (readingEffect && !this.isNewSection(line)) {
                effectLines.push(line);
            } else if (readingVisual && !this.isNewSection(line)) {
                effectVisualLines.push(line);
            }
        }

        // Unir líneas de efecto
        if (effectLines.length > 0) {
            skill.efecto = effectLines.join(' ').trim();
        }
        if (effectVisualLines.length > 0) {
            skill.efecto_visual = effectVisualLines.join(' ').trim();
        }

        // Generar ID único
        if (skill.nombre) {
            const cleanName = skill.nombre.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            const hash = this.simpleHash(filePath + skill.nombre);
            skill.id = `${cleanName}_${hash}`;
        }

        // Validar contenido mínimo
        if (skill.nombre && (skill.efecto || skill.efecto_visual || skill.tier !== null)) {
            return skill;
        }

        return null;
    }

    parseSkillName(line) {
        const result = { nombre: null, categoria: null };

        // Formato [CATEGORÍA] - NOMBRE o [CATEGORÍA] – NOMBRE
        const catDashMatch = line.match(/^\[([^\]]+)\]\s*[-–—]\s*(.+)$/);
        if (catDashMatch) {
            result.categoria = catDashMatch[1].trim();
            result.nombre = catDashMatch[2].trim();
            return result;
        }

        // Formato [CATEGORÍA] NOMBRE (sin guión)
        const catSpaceMatch = line.match(/^\[([^\]]+)\]\s+(.+)$/);
        if (catSpaceMatch) {
            result.categoria = catSpaceMatch[1].trim();
            result.nombre = catSpaceMatch[2].trim();
            return result;
        }

        // Nombre simple
        result.nombre = line.trim();
        return result;
    }

    isNewSection(line) {
        // Detectar si una línea indica el inicio de una nueva sección
        if (/^ACLARACIONES?:?\s*$/i.test(line)) return true;
        if (/^(?:Alcance|TIER|PA|Costo|Coste)/i.test(line)) return true;
        return false;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash % 10000).toString().padStart(4, '0');
    }

    /**
     * Extrae fórmula de daño del efecto
     */
    extractDamageFormula(effect) {
        if (!effect) return null;

        const patterns = [
            /(?:Daña|daña|Causa[^"]*daño[^"]*)\s*["""]?(\w+)\s*[*x×]\s*(\d+(?:\.\d+)?)/i,
            /["""](\w+)\s*[*x×]\s*(\d+(?:\.\d+)?)[""]/i,
            /(\w+)\s*[*x×]\s*(\d+(?:\.\d+)?)/i
        ];

        for (const pattern of patterns) {
            const match = pattern.exec(effect);
            if (match) {
                const stat = match[1].toUpperCase();
                // Verificar que es un stat válido
                if (['FUE', 'VEL', 'PM', 'VOL', 'REF', 'VIT', 'ARMA', 'WEB', 'RANGO', 'ATRIBUTO'].includes(stat)) {
                    return {
                        stat: stat,
                        multiplier: parseFloat(match[2])
                    };
                }
            }
        }

        return null;
    }
}

// Exportar para uso en Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkillParser;
}
