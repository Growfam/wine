#!/bin/bash
# Скрипт для перетворення абсолютних імпортів у відносні в JS-файлах

# Базова директорія для фронтенд коду
BASE_DIR="frontend"
# Цільова директорія, що містить JS-файли для обробки
TARGET_DIR="$BASE_DIR/js/tasks/ui"

echo "Починаю конвертацію імпортів ТІЛЬКИ у директорії $TARGET_DIR"

# Створюємо тимчасовий JavaScript файл для обробки імпортів
cat > convert_imports.js << 'EOL'
const fs = require('fs');
const path = require('path');

// Отримуємо шлях до файлу з аргументів командного рядка
const filePath = process.argv[2];
if (!filePath) {
  console.error('Помилка: Не вказано шлях до файлу');
  process.exit(1);
}

// Читаємо вміст файлу
try {
  const content = fs.readFileSync(filePath, 'utf8');

  // Визначаємо базовий шлях для js/tasks
  const basePath = 'frontend/js/tasks';

  // Поточний шлях до файлу відносно базового шляху
  const currentDir = path.dirname(filePath);

  // Регулярний вираз для пошуку імпортів, що починаються з 'js/tasks/'
  const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+[^;]+|[^;{]*(?:,\s*(?:{[^}]*}|\*\s+as\s+[^;]+|[^;{]*))*)?\s+from\s+(['"])(js\/tasks\/[^'"]+)\1/g;

  // Регулярний вираз для імпортів з require
  const requireRegex = /require\s*\(\s*(['"])(js\/tasks\/[^'"]+)\1\s*\)/g;

  // Відслідковуємо, чи були зміни
  let hasChanges = false;
  let updatedContent = content;

  // Функція для обчислення відносного шляху
  function getRelativePath(importPath) {
    // Видаляємо 'js/tasks/' з початку шляху
    const targetPath = path.join(basePath, importPath.replace('js/tasks/', ''));

    // Обчислюємо відносний шлях від поточного файлу до цільового файлу
    let relativePath = path.relative(currentDir, targetPath);

    // Якщо шлях не починається з ./ або ../, додаємо ./
    if (!relativePath.startsWith('./') && !relativePath.startsWith('../')) {
      relativePath = './' + relativePath;
    }

    return relativePath;
  }

  // Заміна для імпортів, зберігаємо всі знайдені співпадіння
  let importMatches = [];
  let match;

  // Пошук всіх імпортів
  while ((match = importRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const quote = match[1];
    const importPath = match[2];
    importMatches.push({ fullMatch, quote, importPath });
  }

  // Заміна знайдених імпортів
  for (const { fullMatch, quote, importPath } of importMatches) {
    const relativePath = getRelativePath(importPath);
    console.log(`Змінюю імпорт: ${importPath} -> ${relativePath}`);
    updatedContent = updatedContent.replace(fullMatch, fullMatch.replace(importPath, relativePath));
    hasChanges = true;
  }

  // Заміна для require
  let requireMatches = [];

  // Скидаємо lastIndex для пошуку з початку
  requireRegex.lastIndex = 0;

  // Пошук всіх require
  while ((match = requireRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const quote = match[1];
    const importPath = match[2];
    requireMatches.push({ fullMatch, quote, importPath });
  }

  // Заміна знайдених require
  for (const { fullMatch, quote, importPath } of requireMatches) {
    const relativePath = getRelativePath(importPath);
    console.log(`Змінюю require: ${importPath} -> ${relativePath}`);
    updatedContent = updatedContent.replace(fullMatch, fullMatch.replace(importPath, relativePath));
    hasChanges = true;
  }

  // Зберігаємо оновлений файл, якщо були зміни
  if (hasChanges) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`Файл оновлено: ${filePath}`);
  } else {
    console.log(`Змін не знайдено у файлі: ${filePath}`);
  }
} catch (error) {
  console.error(`Помилка при обробці файлу ${filePath}:`, error);
  process.exit(1);
}
EOL

# Знаходимо всі JS файли в цільовій директорії і обробляємо їх
echo "Пошук JS файлів у директорії $TARGET_DIR..."
FILES_COUNT=$(find "$TARGET_DIR" -type f -name "*.js" | wc -l)
echo "Знайдено $FILES_COUNT JS файлів для обробки"

find "$TARGET_DIR" -type f -name "*.js" | while read file; do
  echo "Обробка файлу: $file"
  node convert_imports.js "$file"
done

# Видаляємо тимчасовий скрипт
rm convert_imports.js

echo "Конвертація завершена!"