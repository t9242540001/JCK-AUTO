#!/bin/bash
# Переименовывает все .jpeg файлы в .jpg в каталоге авто.
# Запуск: bash scripts/fix-photo-extensions.sh

CATALOG_DIR="/var/www/jckauto/storage/catalog"
COUNT=0

echo "Scanning $CATALOG_DIR for .jpeg files..."

find "$CATALOG_DIR" -type f -name "*.jpeg" | while read -r FILE; do
  NEWFILE="${FILE%.jpeg}.jpg"
  mv "$FILE" "$NEWFILE"
  echo "  renamed: $FILE → $NEWFILE"
  COUNT=$((COUNT + 1))
done

# Re-count (pipe runs in subshell)
TOTAL=$(find "$CATALOG_DIR" -type f -name "*.jpeg" | wc -l)
RENAMED=$((COUNT))

echo ""
echo "Done. Remaining .jpeg files: $TOTAL"
