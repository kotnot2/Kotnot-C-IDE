// Интерпретатор Kotnot-C
class KotnotInterpreter {
    constructor() {
        this.variables = {};
        this.output = [];
        this.loopStack = [];
    }

    // Парсинг и выполнение
    interpret(code) {
        this.variables = {};
        this.output = [];
        this.loopStack = [];

        // Очистка кода от HTML-комментариев и пробелов
        const cleanCode = this.cleanCode(code);
        
        // Проверка корневой структуры
        if (!cleanCode.includes('<kotnot>') || !cleanCode.includes('</kotnot>')) {
            throw new Error('Код должен быть обернут в <kotnot>...</kotnot>');
        }

        // Извлечение тела программы
        const programMatch = cleanCode.match(/<program>([\s\S]*?)<\/program>/);
        if (!programMatch) {
            throw new Error('Не найден блок <program>');
        }

        const programBody = programMatch[1];
        this.executeBlock(programBody);

        return this.output.join('\n');
    }

    cleanCode(code) {
        // Удаление комментариев <!-- ... -->
        code = code.replace(/<!--[\s\S]*?-->/g, '');
        // Удаление лишних пробелов
        return code.trim();
    }

    executeBlock(block) {
        const lines = block.split('\n');
        let i = 0;

        while (i < lines.length) {
            const line = lines[i].trim();
            
            if (!line) {
                i++;
                continue;
            }

            // Проверка на открывающий тег условия
            if (line.startsWith('<if ')) {
                const condition = this.parseCondition(line);
                const ifBlock = this.extractBlock(lines, i, 'if');
                const elseBlock = this.extractElseBlock(ifBlock);
                
                if (this.evaluateCondition(condition)) {
                    this.executeBlock(ifBlock);
                } else if (elseBlock) {
                    this.executeBlock(elseBlock);
                }
                
                i += ifBlock.split('\n').length + 2; // +2 для открывающего и закрывающего тегов
                if (elseBlock) {
                    i += elseBlock.split('\n').length + 1;
                }
                continue;
            }

            // Проверка на открывающий тег цикла
            if (line.startsWith('<loop ')) {
                const loopInfo = this.parseLoop(line);
                const loopBody = this.extractBlock(lines, i, 'loop');
                
                for (let val = loopInfo.start; val <= loopInfo.end; val++) {
                    this.variables[loopInfo.var] = val;
                    this.executeBlock(loopBody);
                }
                
                i += loopBody.split('\n').length + 2;
                continue;
            }

            // Обработка других тегов
            if (line.startsWith('<var ')) {
                this.handleVar(line);
            } else if (line.startsWith('<print ')) {
                this.handlePrint(line);
            } else if (line.startsWith('<') && !line.startsWith('</')) {
                throw new Error(`Неизвестный тег: ${line}`);
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
            throw new Error('Неверный синтаксис цикла. Используйте: <loop var = start to end>');
        }
        return {
            var: match[1],
            start: this.evaluateExpression(match[2]),
            end: this.evaluateExpression(match[3])
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

    evaluateCondition(condition) {
        // Обработка операторов сравнения
        const operators = ['>=', '<=', '!=', '==', '>', '<'];
        for (const op of operators) {
            if (condition.includes(op)) {
                const [left, right] = condition.split(op).map(s => s.trim());
                const leftVal = this.evaluateExpression(left);
                const rightVal = this.evaluateExpression(right);
                
                switch(op) {
                    case '>=': return leftVal >= rightVal;
                    case '<=': return leftVal <= rightVal;
                    case '!=': return leftVal != rightVal;
                    case '==': return leftVal == rightVal;
                    case '>': return leftVal > rightVal;
                    case '<': return leftVal < rightVal;
                }
            }
        }
        return this.evaluateExpression(condition) !== false;
    }

    evaluateExpression(expr) {
        expr = expr.trim();
        
        // Проверка на строки в кавычках
        if (expr.startsWith('"') && expr.endsWith('"')) {
            return expr.slice(1, -1);
        }
        
        // Проверка на числа
        if (!isNaN(expr) && expr !== '') {
            return Number(expr);
        }
        
        // Проверка на переменную
        if (this.variables.hasOwnProperty(expr)) {
            return this.variables[expr];
        }
        
        // Обработка арифметических выражений
        if (expr.includes('+') || expr.includes('-') || 
            expr.includes('*') || expr.includes('/')) {
            return this.evaluateArithmetic(expr);
        }
        
        throw new Error(`Неизвестное выражение: ${expr}`);
    }

    evaluateArithmetic(expr) {
        // Простая поддержка арифметики
        try {
            // Заменяем переменные на их значения
            let processed = expr;
            for (const [key, value] of Object.entries(this.variables)) {
                processed = processed.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
            }
            
            // Безопасное вычисление
            const result = Function('"use strict"; return (' + processed + ')')();
            return result;
        } catch (e) {
            throw new Error(`Ошибка в арифметическом выражении: ${expr}`);
        }
    }

    handleVar(line) {
        const match = line.match(/<var\s+(\w+)\s*=\s*([^>]+)\/?>/);
        if (!match) {
            throw new Error('Неверный синтаксис переменной');
        }
        const [, name, value] = match;
        this.variables[name] = this.evaluateExpression(value.trim());
    }

    handlePrint(line) {
        const match = line.match(/<print\s+([^>]+)\/?>/);
        if (!match) {
            throw new Error('Неверный синтаксис print');
        }
        const value = match[1].trim();
        
        // Обработка конкатенации
        if (value.includes('+')) {
            const parts = value.split('+').map(p => p.trim());
            let result = '';
            for (const part of parts) {
                const evaluated = this.evaluateExpression(part);
                result += typeof evaluated === 'string' ? evaluated : String(evaluated);
            }
            this.output.push(result);
        } else {
            const result = this.evaluateExpression(value);
            this.output.push(typeof result === 'string' ? result : String(result));
        }
    }
}

// Глобальная функция интерпретации
function interpret(code) {
    const interpreter = new KotnotInterpreter();
    return interpreter.interpret(code);
}
