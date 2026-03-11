import os

template_dir = r"c:\Users\alvar\Desktop\Datium-py\Datium\templates"

for filename in os.listdir(template_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(template_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove the backslashes
        content = content.replace(r"\'", "'")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Templates fixed.")
