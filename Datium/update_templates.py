import os
import re

template_dir = r"c:\Users\alvar\Desktop\Datium-py\Datium\templates"

for filename in os.listdir(template_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(template_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Add {% load static %} if not present
        if '{% load static %}' not in content:
            content = '{% load static %}\n' + content

        # Replace href="css/..." to href="{% static 'css/...' %}"
        content = re.sub(r'href="css/([^"]+)"', r'href="{% static \'css/\1\' %}"', content)
        
        # Replace src="js/..." to src="{% static 'js/...' %}"
        content = re.sub(r'src="js/([^"]+)"', r'src="{% static \'js/\1\' %}"', content)
        
        # Replace src="img/..." to src="{% static 'img/...' %}"
        content = re.sub(r'src="img/([^"]+)"', r'src="{% static \'img/\1\' %}"', content)
        
        # Replace href="img/..." to href="{% static 'img/...' %}" for favicons
        content = re.sub(r'href="img/([^"]+)"', r'href="{% static \'img/\1\' %}"', content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

print("Templates updated with static tags.")
