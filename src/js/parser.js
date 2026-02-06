/**
 * ANIRUL - Parser de Habilidades
 * Parsea archivos .txt de habilidades RPG
 */

class SkillParser {
    constructor() {
        this.patterns = {
            separator: /^[=\-]{10,}$/,
            categoryName: /^\[([^\]]+)\]\s*[-–—]\s*(.+)$/i,
            exp: /^(\d+)\s*EXP/i,
            type: /^([\w\s\/]+)\s*[-–—]\s*([\w\s]+)$/,
            range: /^Alcance[:\s]+(.+)$/i,
            pa: /^(?:PA|Coste|Costo)[:\s]*(Variable|\d+)\s*(?:PA)?$/i,
            paVariable: /^PA\s+Variable$/i,
            tier: /^TIER[:\s]*(\d+|No clasificado)/i,
            effectVisual: /^Efecto visual[:\s]*(.+)$/i,
            effect: /^Efecto[:\s]*(.+)$/i,
            clarifications: /^ACLARACIONES?[:\s]*$/i,
            rank: /^RANGO\s+(ÚNICO|I{1,4}|IV|V|VI)$/i
        };

        this.sectionTitles = [
            'COMANDOS BÁSICOS', 'COMANDOS BASICOS',
            'HABILIDADES PASIVAS', 'HABILIDADES ACTIVAS',
            'PERFIL BÁSICO', 'PERFIL BASICO',
            'TOMO MÁGICO', 'TOMO MAGICO'
        ];
    }

    parseFile(content, fileName, filePath) {
        const skills = [];
        const blocks = this.splitIntoBlocks(content);

        for (const block of blocks) {
            const skill = this.parseBlock(block, fileName, filePath);
            if (skill && skill.nombre) {
                skills.push(skill);
            }
        }

        return skills;
    }

    splitIntoBlocks(content) {
        const lines = content.split('\n');
        const blocks = [];
        let currentBlock = [];
        let inSkill = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // Ignorar separadores
            if (this.patterns.separator.test(trimmed)) {
                continue;
            }

            // Línea vacía
            if (!trimmed) {
                continue;
            }

            // Detectar inicio de habilidad
            if (this.patterns.categoryName.test(trimmed)) {
                if (currentBlock.length > 0) {
                    blocks.push(currentBlock);
                }
                currentBlock = [trimmed];
                inSkill = true;
            } else if (inSkill) {
                currentBlock.push(trimmed);
            } else {
                // Posible título de sección
                if (this.isSectionTitle(trimmed)) {
                    continue;
                }
                // Podría ser habilidad sin categoría
                if (this.looksLikeSkillName(trimmed)) {
                    if (currentBlock.length > 0) {
                        blocks.push(currentBlock);
                    }
                    currentBlock = [trimmed];
                    inSkill = true;
                }
            }
        }

        if (currentBlock.length > 0) {
            blocks.push(currentBlock);
        }

        return blocks;
    }

    isSectionTitle(line) {
        const upper = line.toUpperCase();
        if (this.sectionTitles.includes(upper)) {
            return true;
        }
        if (this.patterns.rank.test(line)) {
            return true;
        }
        return false;
    }

    looksLikeSkillName(line) {
        return /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,}$/.test(line);
    }

    parseBlock(lines, fileName, filePath) {
        if (!lines || lines.length < 2) {
            return null;
        }

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
            usos_en_ronda: 0
        };

        const firstLine = lines[0];

        // Parsear nombre y categoría
        const catMatch = this.patterns.categoryName.exec(firstLine);
        if (catMatch) {
            skill.categoria = catMatch[1].trim();
            skill.nombre = catMatch[2].trim();
        } else {
            skill.nombre = firstLine.trim();
        }

        // Parsear resto de líneas
        let inClarifications = false;
        let effectLines = [];
        let effectVisualLines = [];
        let readingEffect = false;
        let readingVisual = false;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            // Aclaraciones
            if (this.patterns.clarifications.test(line)) {
                inClarifications = true;
                readingEffect = false;
                readingVisual = false;
                continue;
            }

            if (inClarifications) {
                if (line.startsWith('-') || line.startsWith('•')) {
                    skill.aclaraciones.push(line.replace(/^[-•]\s*/, '').trim());
                } else if (line.toUpperCase() !== 'N/A' && line.toUpperCase() !== 'N/A.') {
                    skill.aclaraciones.push(line);
                }
                continue;
            }

            // EXP
            const expMatch = this.patterns.exp.exec(line);
            if (expMatch) {
                skill.costo_exp = parseInt(expMatch[1]);
                continue;
            }

            // Tipo y clasificación
            const typeMatch = this.patterns.type.exec(line);
            if (typeMatch && !skill.tipo) {
                skill.tipo = typeMatch[1].trim();
                skill.clasificacion = typeMatch[2].trim();
                continue;
            }

            // Alcance
            const rangeMatch = this.patterns.range.exec(line);
            if (rangeMatch) {
                skill.alcance = rangeMatch[1].trim();
                continue;
            }

            // PA Variable
            if (this.patterns.paVariable.test(line)) {
                skill.costo_pa = 0;
                continue;
            }

            // PA
            const paMatch = this.patterns.pa.exec(line);
            if (paMatch) {
                const value = paMatch[1];
                skill.costo_pa = value.toLowerCase() === 'variable' ? 0 : parseInt(value);
                continue;
            }

            // TIER
            const tierMatch = this.patterns.tier.exec(line);
            if (tierMatch) {
                const value = tierMatch[1];
                skill.tier = value.toLowerCase() === 'no clasificado' ? 0 : parseInt(value);
                continue;
            }

            // Efecto visual
            const visualMatch = this.patterns.effectVisual.exec(line);
            if (visualMatch) {
                effectVisualLines = [visualMatch[1].trim()];
                readingVisual = true;
                readingEffect = false;
                continue;
            }

            // Efecto
            const effectMatch = this.patterns.effect.exec(line);
            if (effectMatch && !line.toLowerCase().includes('visual')) {
                effectLines = [effectMatch[1].trim()];
                readingEffect = true;
                readingVisual = false;
                continue;
            }

            // Continuación de efectos
            if (readingEffect) {
                effectLines.push(line);
            } else if (readingVisual) {
                effectVisualLines.push(line);
            }
        }

        // Unir líneas de efecto
        if (effectLines.length > 0) {
            skill.efecto = effectLines.join(' ');
        }
        if (effectVisualLines.length > 0) {
            skill.efecto_visual = effectVisualLines.join(' ');
        }

        // Generar ID único
        if (skill.nombre) {
            const cleanName = skill.nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
            const hash = this.simpleHash(filePath + skill.nombre);
            skill.id = `${cleanName}_${hash}`;
        }

        // Validar contenido mínimo
        if (skill.nombre && (skill.efecto || skill.efecto_visual || skill.tier)) {
            return skill;
        }

        return null;
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
            /(?:Daña|daña)\s*["""]?(\w+)\s*[*x×]\s*(\d+(?:\.\d+)?)/i,
            /(\w+)\s*[*x×]\s*(\d+(?:\.\d+)?)/i
        ];

        for (const pattern of patterns) {
            const match = pattern.exec(effect);
            if (match) {
                return {
                    stat: match[1].toUpperCase(),
                    multiplier: parseFloat(match[2])
                };
            }
        }

        return null;
    }
}

// Exportar para uso en Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkillParser;
}
