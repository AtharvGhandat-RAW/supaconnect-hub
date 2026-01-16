import os
import re
from markdown_it import MarkdownIt

# Define the source MD file and output directory
SOURCE_MD = "project-report/ATTENDRO_PROJECT_REPORT.md"
OUTPUT_DIR = "project-report"

# Diagram mapping (Text reference -> Filename)
DIAGRAM_MAP = {
    "Figure 1": "diagrams/01-system-architecture.html",
    "Figure 2": "diagrams/02-database-schema.html",
    "Figure 3": "diagrams/03-user-workflow.html",
    "Figure 4": "diagrams/04-device-interface.html",
    "Figure 5": "diagrams/05-security-model.html",
    "Figure 6": "diagrams/06-usecase-diagram.html",
    "Figure 7": "diagrams/06-usecase-diagram.html" # Fallback if missing
}

# The target files corresponding to the sections in MD
# Order matters and must match the splitting logic
SECTIONS = [
    ("Title Page (i)", "Title-Page.html"),
    ("Certificate of the Guide (ii)", "Certificate.html"),
    ("Acknowledgement (iii)", "Acknowledgment.html"),
    ("Index / Table of Contents (iv)", "Table-of-Contents.html"),
    ("Abstract (v)", "Abstract.html"), # New file
    ("List of Figures (vi)", "List-of-Figures.html"), # New file
    ("List of Tables (vii)", "List-of-Tables.html"), # New file
    ("Chapter–1 Introduction", "Chapter-1-Introduction.html"),
    ("Chapter–2 Literature Survey", "Chapter-2-Literature-Survey.html"),
    ("Chapter–3 Scope of the Project", "Chapter-3-Scope-of-Project.html"),
    ("Chapter–4 Methodology / Approach", "Chapter-4-Methodology.html"),
    ("Chapter–5 Designs, Working and Processes", "Chapter-5-Design-Details.html"),
    ("Chapter–6 Results and Applications", "Chapter-6-Results-and-Applications.html"),
    ("Chapter–7 Conclusion", "Chapter-7-Conclusion.html"),
    ("References", "References.html")
]

def read_diagram_content(filename):
    path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Extract the useful diagram part (usually inside diagram-wrap or just body)
            # We strip the full HTML structure to embed it
            match = re.search(r'<div class="diagram-wrap".*?</div>\s*</div>', content, re.DOTALL) 
            # Looking for the outer wrapper. The diagrams usually have <div class="diagram-wrap" id="diagram"> ... </div>
            
            # If regex fails, let's try to grab just the body content but exclude scripts
            if not match:
                match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL)
            
            if match:
                inner = match.group(0 if 'diagram-wrap' in match.group(0) else 1)
                # Remove controls
                inner = re.sub(r'<div class="controls">.*?</div>', '', inner, flags=re.DOTALL)
                # Remove scripts
                inner = re.sub(r'<script.*?</script>', '', inner, flags=re.DOTALL)
                # We need to include the CSS too for it to render!
                css_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
                css = css_match.group(1) if css_match else ""
                
                return f"<style>{css}</style>\n<div style='page-break-inside: avoid;'>{inner}</div>"
    return ""

def md_to_html(md_text):
    md = MarkdownIt()
    return md.render(md_text)

def split_and_save():
    with open(SOURCE_MD, 'r', encoding='utf-8') as f:
        full_text = f.read()

    # Naive split by "## " or "# " depending on the file structure
    # The file uses "## Title Page" then "# Chapter-1"
    
    # Let's verify the markers.
    # We will loop through sections and find their start index.
    
    current_text = full_text
    
    for i, (section_title, filename) in enumerate(SECTIONS):
        # Find start of this section
        # The MD file uses "## Title Page (i)" or "# Chapter–1"
        # We need to be flexible with exact matching or substring
        
        # Construct a regex to find the header
        # pattern: ^#+\s*Title Page \(i\)
        escaped_title = re.escape(section_title).replace(r'\ ', r'\s*')
        pattern = r'(^|\n)(#+)\s*' + escaped_title
        
        match = re.search(pattern, current_text, re.IGNORECASE)
        
        if not match:
            print(f"Warning: Could not find section '{section_title}'")
            continue
            
        start_idx = match.start()
        
        # Find end (start of next section)
        end_idx = len(current_text)
        if i < len(SECTIONS) - 1:
            next_title = SECTIONS[i+1][0]
            escaped_next = re.escape(next_title).replace(r'\ ', r'\s*')
            next_pattern = r'(^|\n)(#+)\s*' + escaped_next
            next_match = re.search(next_pattern, current_text[start_idx+1:], re.IGNORECASE)
            if next_match:
                end_idx = start_idx + 1 + next_match.start()
        
        # Extract content
        section_content_md = current_text[start_idx:end_idx]
        
        # Convert to HTML
        html_content = md_to_html(section_content_md)
        
        # Inject Diagrams
        # We look for references like "Figure 1" in the text and append the diagram after the paragraph
        # Or just append all relevant diagrams for the chapter at the end
        
        # For simplicity and robustness: Check which figures are mentioned and append them
        for fig_name, dia_file in DIAGRAM_MAP.items():
            if fig_name in section_content_md:
                print(f"Injecting {fig_name} into {filename}")
                dia_html = read_diagram_content(dia_file)
                # Append to end of HTML
                html_content += f"\n<br><hr><br>\n{dia_html}"
        
        # Wrap in minimal HTML document for WeasyPrint
        full_html = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
/* Reset */
body {{ font-family: 'Times New Roman', serif; line-height: 1.5; text-align: justify; }}
h1, h2, h3 {{ text-align: center; }}
p {{ margin-bottom: 1em; }}
table {{ width: 100%; border-collapse: collapse; margin: 1em 0; }}
th, td {{ border: 1px solid #000; padding: 5px; }}
.diagram-wrap {{ border: none !important; margin: 20px auto !important; width: 100% !important; }}
</style>
</head>
<body>
{html_content}
</body>
</html>
"""
        
        out_path = os.path.join(OUTPUT_DIR, filename)
        with open(out_path, 'w', encoding='utf-8') as out:
            out.write(full_html)
        print(f"Generated {out_path}")

if __name__ == "__main__":
    split_and_save()
