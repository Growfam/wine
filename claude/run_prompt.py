import sys
from pathlib import Path


def load_prompt(template_path, general_html_path, settings_js_path):
    prompt = Path(template_path).read_text()
    general_html = Path(general_html_path).read_text()
    settings_js = Path(settings_js_path).read_text()
    return prompt.replace("{{GENERAL_HTML}}", general_html).replace("{{SETTINGS_JS}}", settings_js)


def save_prompt(generated_prompt):
    out_path = Path("claude/outputs/generated_prompt.txt")
    out_path.write_text(generated_prompt)
    print(f"🔹 Prompt збережено в {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Використання: python run_prompt.py prompts/js_ui_component.txt")
        sys.exit(1)

    template_path = sys.argv[1]
    general_html_path = "claude/inputs/general.html"
    settings_js_path = "claude/inputs/settings.js"
    generated_prompt = load_prompt(template_path, general_html_path, settings_js_path)
    save_prompt(generated_prompt)