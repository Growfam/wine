# Claude Master Workflow

## Як користуватись:

1. Встав код у `inputs/current_code.py`
2. Запусти:
```bash
python claude/run_prompt.py prompts/refactor_code.txt
```
3. Claude згенерує prompt → встав його в Claude
4. Результат встав у `outputs/refactored_code.py`
5. Встав назад у проєкт

## Шаблони:
- `refactor_code.txt` — рефакторинг
- `flask_api.txt` — API endpoint
- `js_ui_component.txt` — UI Telegram компонент
- `supabase_query.txt` — Supabase-запити
