const path = require('path');
const fs = require('fs');
const acorn = require('acorn');

// Граф залежностей
const dependencies = {};
// Шлях до директорії з модулями
const rootDir = path.resolve('./frontend/js/referrals');

function parseImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ast = acorn.parse(content, { sourceType: 'module', ecmaVersion: 2020 });

  const imports = [];
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const source = node.source.value;
      if (source.startsWith('.')) {
        // Перетворюємо відносний шлях на абсолютний
        const absolutePath = path.resolve(path.dirname(filePath), source);
        const normalizedPath = absolutePath.endsWith('.js') ?
          absolutePath : `${absolutePath}.js`;
        imports.push(normalizedPath);
      }
    }
  }
  return imports;
}

function buildDependencyGraph(startPath) {
  const queue = [startPath];
  const visited = new Set();

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (visited.has(currentPath)) continue;
    visited.add(currentPath);

    try {
      if (!fs.existsSync(currentPath)) {
        console.warn(`Файл не існує: ${currentPath}`);
        continue;
      }

      const imports = parseImports(currentPath);
      dependencies[currentPath] = imports;

      for (const importPath of imports) {
        if (!visited.has(importPath)) {
          queue.push(importPath);
        }
      }
    } catch (error) {
      console.error(`Помилка при обробці ${currentPath}:`, error);
    }
  }
}

function findCycles() {
  const cycles = [];

  function dfs(node, visited = new Set(), path = []) {
    if (visited.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart).concat(node));
      }
      return;
    }

    visited.add(node);
    path.push(node);

    const deps = dependencies[node] || [];
    for (const dep of deps) {
      dfs(dep, new Set(visited), [...path]);
    }
  }

  for (const node in dependencies) {
    dfs(node);
  }

  return cycles;
}

// Запускаємо аналіз
const indexPath = path.resolve(rootDir, 'index.js');
buildDependencyGraph(indexPath);
const cycles = findCycles();

if (cycles.length === 0) {
  console.log('Циклічних залежностей не знайдено!');
} else {
  console.log(`Знайдено ${cycles.length} циклічних залежностей:`);
  cycles.forEach((cycle, i) => {
    console.log(`\nЦикл #${i + 1}:`);
    cycle.forEach(node => {
      // Виводимо відносний шлях для кращої читабельності
      console.log(`  ${path.relative(rootDir, node)}`);
    });
    console.log(`  ${path.relative(rootDir, cycle[0])} (повернення до початку)`);
  });
}