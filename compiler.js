// Компилятор Kotnot-C в псевдокод / JavaScript
class KotnotCompiler {
    constructor() {
        this.variables = new Set();
        this.output = [];
        this.indentLevel = 0;
        this.loopCounter = 0;
    }

    compile(code) {
        this.variables = new Set();
        this.output = [];
        this.indentLevel = 0;
        this.loopCounter = 0;

        const cleanCode = this.cleanCode(code);
        
        if (!cleanCode.includes('<kotnot>') || !cleanCode.includes('</kotnot>')) {
            throw new Error('Код должен быть обернут в <kotnot>...</kotnot>');
        }

        const programMatch = cleanCode.match(/<program>([\s\S]*?)<\/program>/);
        if (!programMatch) {
            throw new Error('Не найден блок <program>');
        }

        const programBody = programMatch[1];
        this.output.push('// Скомпилированный Kotnot-C код');
        this.output.push('(function() {');
        this.indentLevel++;
        
        this.compileBlock(programBody);
        
        this.indentLevel--;
        this.output.push('})();');
        
        return this.output.join('\n');
    }

    cleanCode(code) {
        code = code.replace(/<!--[\s\S]*?-->/g, '');
        return code.trim();
    }

    indent() {
        return '    '.repeat(this.indentLevel);
    }

    compileBlock(block) {
        const lines = block.split('\n');
        let i = 0;

        while (i < lines.length) {
            const line = lines[i].trim();
            
            if (!line) {
                i++;
                continue;
            }

            if (line.startsWith('<if ')) {
                const condition = this.parseCondition(line);
                const ifBlock = this.extractBlock(lines, i, 'if');
                const elseBlock = this.extractElseBlock(ifBlock);
                
                this.output.push(`${this.indent()}if (${this.translateCondition(condition)}) {`);
                this.indentLevel++;
                this.compileBlock(ifBlock);
                this.indentLevel--;
                
                if (elseBlock) {
                    this.output.push(`${this.indent()} else {`);
                    this.indentLevel++;
                    this.compileBlock(elseBlock);
                    this.indentLevel--;
                }
                
                this.output.push(`${this.indent()}}`);
                
                i += ifBlock.split('\n').length + 2;
                if (elseBlock) {
                    i += elseBlock.split('\n').length + 1;
                }
                continue;
            }

            if (line.startsWith('<loop ')) {
                const loopInfo = this.parseLoop(line);
                const loopBody = this.extractBlock(lines, i, 'loop');
                const loopVar = loopInfo.var;
                const start = loopInfo.start;
                const end = loopInfo.end;
                const counter = this.loopCounter++;
                
                this.output.push(`${this.indent()}for (let ${loopVar} = ${start}; ${loopVar} <= ${end}; ${loopVar}++) {`);
                this.indentLevel++;
                this.compileBlock(loopBody);
                this.indentLevel--;
                this.output.push(`${this.indent()}}`);
                
                i += loopBody.split('\n').length + 2;
                continue;
            }

            if (line.startsWith('<var ')) {
                const match = line.match(/<var\s+(\w+)\s*=\s*([^>]+)\/?>/);
                if (match) {
                    const [, name, value] = match;
                    this.variables.add(name);
                    const compiledValue = this.translateExpression(value.trim());
                    this.output.push(`${this.indent()}let ${name} = ${compiledValue};`);
                }
            } else if (line.startsWith('<print ')) {
                const match = line.match(/<print\s+([^>]+)\/?>/);
                if (match) {
                    const value = match[1].trim();
                    const compiledValue = this.translatePrintExpression(value);
                    this.output.push(`${this.indent()}console.log(${compiledValue});`);
                }
            }

            i++;
        }
    }

    parseCondition(line) {
        const match = line.match(/<if\s+([^>]+)>/);
        if (!match) {
            throw new Error('Неверный синтаксис условия');
        }
        return match[1].trim();
    }

    parseLoop(line) {
        const match = line.match(/<loop\s+(\w+)\s*=\s*([^\s]+)\s+to\s+([^\s]+)>/);
        if (!match) {
            throw new Error('Неверный синтаксис цикла');
        }
        return {
            var: match[1],
            start: this.translateExpression(match[2]),
            end: this.translateExpression(match[3])
        };
    }

    extractBlock(lines, startIndex, type) {
        const closingTag = `</${type}>`;
        let blockLines = [];
        let depth = 1;
        let i = startIndex + 1;

        while (i < lines.length && depth > 0) {
            const line = lines[i].trim();
            if (line.startsWith(`<${type} `)) {
                depth++;
            } else if (line === closingTag) {
                depth--;
                if (depth === 0) break;
            }
            if (depth > 0 && line !== closingTag) {
                blockLines.push(line);
            }
            i++;
        }

        return blockLines.join('\n');
    }

    extractElseBlock(ifBlock) {
        const elseMatch = ifBlock.match(/<else>([\s\S]*?)<\/else>/);
        if (elseMatch) {
            return elseMatch[1].trim();
        }
        return null;
    }

    translateCondition(condition) {
        // Заменяем операторы сравнения на JS-эквиваленты
        let translated = condition
            .replace(/==/g, '===')
            .replace(/!=/g, '!==')
            .replace(/and/g, '&&')
            .replace(/or/g, '||')
            .replace(/not/g, '!');
        
        return this.translateExpression(translated);
    }

    translateExpression(expr) {
        expr = expr.trim();
        
        // Строки в кавычках
        if (expr.startsWith('"') && expr.endsWith('"')) {
            return expr;
        }
        
        // Числа
        if (!isNaN(expr) && expr !== '') {
            return expr;
        }
        
        // Переменные
        if (this.variables.has(expr)) {
            return expr;
        }
        
        // Арифметические выражения - просто возвращаем как есть,
        // заменяя переменные, которые у нас есть
        let processed = expr;
        for (const varName of this.variables) {
            processed = processed.replace(new RegExp(`\\b${varName}\\b`, 'g'), varName);
        }
        
        return processed;
    }

    translatePrintExpression(expr) {
        if (expr.includes('+')) {
            const parts = expr.split('+').map(p => p.trim());
            const translatedParts = parts.map(p => this.translateExpression(p));
            return translatedParts.join(' + ');
        }
        return this.translateExpression(expr);
    }
}

// Глобальная функция компиляции
function compile(code) {
    const compiler = new KotnotCompiler();
    return compiler.compile(code);
}
