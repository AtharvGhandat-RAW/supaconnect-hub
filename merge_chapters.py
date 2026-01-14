import os
import re

# File order
files = [
    "Acknowledgment.html",
    "Table-of-Contents.html",
    "Chapter-1-Introduction.html",
    "Chapter-2-Literature-Survey.html",
    "Chapter-3-Scope-of-Project.html",
    "Chapter-4-Methodology.html",
    "Chapter-5-Design-Details.html",
    "Chapter-6-Results-and-Applications.html",
    "Chapter-7-Conclusion.html",
    "References.html"
]

base_dir = "project-report"
output_html = os.path.join(base_dir, "Attendro_Full_Report.html")

# Common CSS
css = """
<style>
    @page {
        size: A4;
        margin-left: 3.5cm;
        margin-top: 2.5cm;
        margin-right: 1.25cm;
        margin-bottom: 1.25cm;
    }
    body {
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 2;
        text-align: justify;
    }
    .page-break {
        page-break-before: always;
    }
    /* Ensure tables look good */
    table {
        border-collapse: collapse;
        width: 100%;
        font-size: 12pt;
    }
    th, td {
        border: 1px solid black;
        padding: 5px;
    }
    /* Mermaid centering */
    .mermaid {
        display: flex;
        justify-content: center;
        width: 100%;
        margin: 20px 0;
    }
</style>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>
    mermaid.initialize({
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: '"Times New Roman", Times, serif'
    });
</script>
"""

full_content = []

for i, filename in enumerate(files):
    path = os.path.join(base_dir, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Extract body content only
            match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL)
            if match:
                body_content = match.group(1)
                
                # Add page break before every chapter except the first one
                if i > 0:
                    full_content.append('<div class="page-break"></div>')
                
                full_content.append(f"<!-- Start of {filename} -->")
                full_content.append(body_content)
                full_content.append(f"<!-- End of {filename} -->")

# Write master file
with open(output_html, 'w', encoding='utf-8') as f:
    f.write('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>Attendro Full Project Report</title>\n')
    f.write(css)
    f.write('\n</head>\n<body>\n')
    f.write('\n'.join(full_content))
    f.write('\n</body>\n</html>')

print(f"Master HTML created at: {output_html}")
