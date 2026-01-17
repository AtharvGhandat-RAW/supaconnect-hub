import os
import markdown
import re
from weasyprint import HTML, CSS

# Configuration
OUTPUT_DIR = "report_gen/output"
CONTENT_DIR = "report_gen/content"
SOURCE_MD_PATH = "project-report/ATTENDRO_PROJECT_REPORT.md"
DIAGRAMS_DIR = "project-report/diagrams"

# Base CSS
BASE_CSS = """
@page {
    size: A4;
    margin-top: 2.5cm;
    margin-bottom: 1.25cm;
    margin-left: 3.5cm;
    margin-right: 1.25cm;
    @bottom-center {
        content: counter(page);
        font-family: "Times New Roman", Times, serif;
        font-size: 10pt;
    }
}

body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 2; /* Double space */
    text-align: justify;
    margin: 0;
}

h1 {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    text-align: center;
    page-break-before: always;
    margin-top: 0;
}

h2 {
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-top: 24pt;
    margin-bottom: 12pt;
    page-break-after: avoid;
    text-align: left;
}

h3 {
    font-size: 12pt;
    font-weight: bold;
    text-transform: none;
    margin-top: 18pt;
    margin-bottom: 12pt;
    page-break-after: avoid;
    text-align: left;
}

p, li, div {
    margin-bottom: 12pt;
    text-indent: 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12pt;
    line-height: 1.5;
}
th, td {
    border: 1px solid black;
    padding: 6pt;
    vertical-align: top;
    text-align: left;
}

/* Title Page & Cert */
.title-page-container {
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    page-break-after: always;
    line-height: 1.5;
}
.title-project-title { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2cm; }
.certificate-container { text-align: justify; page-break-after: always; }
.cert-title { text-align: center; text-transform: uppercase; font-weight: bold; font-size: 14pt; margin-bottom: 2cm; }
.sig-table { width: 100%; border: none; margin-top: 3cm; }
.sig-table td { border: none; text-align: center; vertical-align: bottom; height: 2cm; }

/* Diagram Wrapping for Report */
.report-diagram {
    margin: 20px 0;
    page-break-inside: avoid;
    text-align: center;
    display: flex;
    justify-content: center;
}

/* Include styles from Diagram HTMLs (simplified/normalized) */
.diagram-wrap { 
    background: #fff; 
    width: 100% !important; /* Force fit to page width */ 
    max-width: 600px;
    border: 1px solid #ccc; 
    padding: 10px; 
    font-family: "Times New Roman", serif;
    line-height: 1.2; /* Reset line height inside diagrams */
    margin: 0 auto;
}
.diagram-title { text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 10px; }

/* 01 Arch */
.arch { display: flex; flex-direction: column; gap: 8px; }
.layer { border: 1.5px solid #333; border-radius: 4px; padding: 10px 12px; background: #fafafa; position: relative; }
.layer-label { position: absolute; top: -9px; left: 12px; background: #fff; padding: 0 6px; font-weight: bold; font-size: 9pt; }
.layer-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; padding-top: 6px; }
.box { border: 1px solid #333; border-radius: 3px; padding: 5px 10px; font-size: 8pt; text-align: center; min-width: 60px; background: #fff; }
.box.blue { background: #2563eb; color: #fff; border-color: #1d4ed8; }
.box.green { background: #059669; color: #fff; border-color: #047857; }
.box.red { background: #dc2626; color: #fff; border-color: #b91c1c; }
.box.orange { background: #ea580c; color: #fff; border-color: #c2410c; }
.arrow { text-align: center; font-size: 14pt; color: #555; line-height: 1; }

/* 02 DB - Flex Fallback for Grid */
.er { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.entity { border: 1.5px solid #333; font-size: 7.5pt; background: #fff; width: 30%; min-width: 140px; }
.entity-hd { background: #1e3a5f; color: #fff; padding: 4px; font-weight: bold; text-align: center; font-size: 8pt; border-bottom: 1.5px solid #333; }
.entity-bd { padding: 4px; }
.attr { display: flex; justify-content: space-between; padding: 1px 0; border-bottom: 1px dashed #ddd; }
.pk { color: #b91c1c; font-weight: bold; }
.fk { color: #1d4ed8; }

/* 03 Flow */
.flow { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.node { padding: 6px 14px; font-size: 8pt; text-align: center; border: 1.5px solid #333; min-width: 100px; }
.start, .end { border-radius: 20px; background: #d1fae5; }
.process { background: #fff; }
.io { background: #dbeafe; transform: skewX(-10deg); }
.io span { display: inline-block; transform: skewX(10deg); }

/* 04 Device */
.wiring { display: flex; justify-content: center; gap: 20px; align-items: center; }
.device { border: 1.5px solid #333; padding: 6px; text-align: center; font-size: 8pt; background: #f9f9f9; border-radius: 4px; }
.oled-states { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.oled { width: 80px; height: 40px; background: #000; border: 2px solid #333; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #0f0; font-family: monospace; font-size: 6pt; }

/* 05 Security */
.layers { display: flex; flex-direction: column; gap: 4px; }
.layer-sec { display: flex; align-items: center; border: 1px solid #333; background: #fff; }
.layer-num { width: 20px; background: #1e3a5f; color: #fff; font-size: 8pt; font-weight: bold; text-align: center; padding: 4px 0; }
.layer-name { padding: 4px 8px; font-size: 8pt; border-right: 1px solid #ddd; font-weight: bold; }
.layer-desc { padding: 4px 8px; font-size: 7.5pt; color: #444; }

"""

def get_diagram_html(filename):
    """
    Extracts the inner HTML of the diagram-wrap div
    """
    path = os.path.join(DIAGRAMS_DIR, filename)
    if not os.path.exists(path):
        return None
        
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    match = re.search(r'<div class="diagram-wrap" id="diagram">(.*?)</div>\s*</body>', content, re.DOTALL)
    if match:
        # Wrap it back in diagram-wrap but remove id to avoid duplicates if multiple
        inner = match.group(1)
        # Clean up some heavy elements or scripts if any (though we read raw)
        return f'<div class="report-diagram"><div class="diagram-wrap">{inner}</div></div>'
        
    # Fallback: look for just diagram-wrap
    match = re.search(r'<div class="diagram-wrap.*?>(.*?)</div>', content, re.DOTALL)
    if match:
        inner = match.group(1)
        return f'<div class="report-diagram"><div class="diagram-wrap">{inner}</div></div>'
        
    return None

def process_markdown_content(md_content):
    lines = md_content.split('\n')
    processed_lines = []
    for line in lines:
        if re.match(r'^###\s+\d+\.\d+\s+', line):
            line = line.replace('###', '##', 1)
        if line.startswith("# Chapter"):
            line = line.replace("–", " ").replace("-", " ")
        processed_lines.append(line)
    return "\n".join(processed_lines)

def parse_sections(md_text):
    sections = [] # List of dicts
    lines = md_text.split('\n')
    current_title = ""
    current_content = []
    
    def flush(title, content):
        if title: 
            sections.append({"title": title, "content": "\n".join(content)})
    
    pass_intro = False
    for line in lines:
        if "## Title Page" in line:
            flush(current_title, current_content) 
            current_title = "Title Page"
            current_content = []
            pass_intro = True
            continue
        if not pass_intro: continue
            
        if line.startswith("## Certificate"):
            flush(current_title, current_content) 
            current_title = "Certificate" 
            current_content = []
        elif line.startswith("## Acknowledgement"):
            flush(current_title, current_content) 
            current_title = "Acknowledgement" 
            current_content = []
        elif line.startswith("## Index") or line.startswith("## Table of Contents"):
            flush(current_title, current_content) 
            current_title = "Table of Contents" 
            current_content = []
        elif line.startswith("## Abstract"):
            flush(current_title, current_content) 
            current_title = "Abstract" 
            current_content = []
        elif line.startswith("## List of Figures"):
            flush(current_title, current_content) 
            current_title = "List of Figures" 
            current_content = []
        elif line.startswith("## List of Tables"):
             flush(current_title, current_content) 
             current_title = "List of Tables" 
             current_content = []
        elif line.startswith("# Chapter"):
            flush(current_title, current_content)
            current_title = line.strip("# ").strip()
            current_content = []
        elif line.startswith("# References"):
             flush(current_title, current_content)
             current_title = "References"
             current_content = []
        else:
            current_content.append(line)
    flush(current_title, current_content)
    return sections

# Custom Templates (same as before)
def create_title_page_html():
    return """<div class="title-page-container"><div class="title-project-title">ATTENDRO: Smart Biometric + App-Based Attendance Management System using AI & IoT</div><p>A Project Report Submitted by</p><p><strong>[STUDENT NAME]</strong></p><p>In partial fulfillment of the requirements for the Diploma in</p><p><strong>APPLIED AI & ML</strong></p><p>At</p><p><strong>Rajarambapu Institute of Technology, Islampur</strong></p><p><strong>2025–2026</strong></p><br><br><p>Under the Guidance of</p><p><strong>[GUIDE NAME]</strong></p></div>"""

def create_certificate_html():
    return """<div class="certificate-container"><div class="cert-title">CERTIFICATE</div><p>This is to certify that the project titled <strong>"ATTENDRO: Smart Biometric + App-Based Attendance Management System using AI & IoT"</strong> has been carried out by <strong>[Student Name]</strong> under my guidance and supervision in partial fulfillment of the requirements for the award of the Diploma in <strong>Applied AI & ML</strong> at <strong>Rajarambapu Institute of Technology, Islampur</strong>, during the academic year <strong>2025–2026</strong>.</p><table class="sig-table"><tr><td>___________________<br><strong>Guide</strong></td><td>___________________<br><strong>H.O.D.</strong></td><td>___________________<br><strong>Principal</strong></td></tr><tr><td colspan="3" style="text-align:left; padding-top:1cm;">Date: _______________<br>Place: Islampur</td></tr></table></div>"""

def generate():
    with open(SOURCE_MD_PATH, 'r', encoding='utf-8') as f:
        raw = f.read()
    refined = process_markdown_content(raw)
    sections = parse_sections(refined)
    
    full_body = ""
    
    # Pre-load diagrams
    dia_arch = get_diagram_html("01-system-architecture.html")
    dia_db = get_diagram_html("02-database-schema.html")
    dia_flow = get_diagram_html("03-user-workflow.html")
    dia_device = get_diagram_html("04-device-interface.html")
    dia_sec = get_diagram_html("05-security-model.html")
    # dia_usecase = get_diagram_html("06-usecase-diagram.html") # Assuming 06 exist or similar
    
    for sec in sections:
        title = sec['title']
        content = sec['content']
        html_part = markdown.markdown(content, extensions=['tables'])
        
        final_part = ""
        if title == "Title Page": final_part = create_title_page_html()
        elif title == "Certificate": final_part = create_certificate_html()
        else:
            final_part = f"<h1>{title}</h1>\n{html_part}"
            
            # Inject Diagrams Logic
            if "Chapter 4" in title: 
                # Methodology
                if dia_arch: 
                     final_part = final_part.replace("<h3>4.1 System Overview</h3>", f"<h3>4.1 System Overview</h3>\n{dia_arch}\n<p style='text-align:center;font-style:italic;'>Figure 1: System Architecture</p>")
                if dia_flow:
                     # Inject flow near Device Logic
                     final_part = final_part.replace("<h3>4.2 Device Logic & Workflow</h3>", f"<h3>4.2 Device Logic & Workflow</h3>\n{dia_flow}\n<p style='text-align:center;font-style:italic;'>Figure 3: User Workflow</p>")
                     
            if "Chapter 5" in title:
                # Design
                if dia_device:
                    final_part = final_part.replace("<h3>5.1 Hardware Design</h3>", f"<h3>5.1 Hardware Design</h3>\n{dia_device}\n<p style='text-align:center;font-style:italic;'>Figure 4: Device Interface</p>")
                if dia_db:
                    final_part = final_part.replace("<h3>5.2 Database Description (Supabase)</h3>", f"<h3>5.2 Database Description (Supabase)</h3>\n{dia_db}\n<p style='text-align:center;font-style:italic;'>Figure 2: Database Schema</p>")
                if dia_sec:
                    final_part = final_part.replace("<h3>5.3 Session & Context Rules (The Verification Logic)</h3>", f"<h3>5.3 Session & Context Rules</h3>\n{dia_sec}\n<p style='text-align:center;font-style:italic;'>Figure 5: Security Model</p>")

        full_body += f"<div class='section-wrapper'>{final_part}</div>\n"
        
    final_doc = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>{BASE_CSS}</style></head><body>{full_body}</body></html>"""
    
    pdf_path = os.path.join(OUTPUT_DIR, "Attendro_Final_Report.pdf")
    HTML(string=final_doc).write_pdf(pdf_path)
    print("PDF with Diagrams Generated Successfully.")
    
    # Also save the HTML used for PDF for inspection
    with open(os.path.join(OUTPUT_DIR, "Attendro_Final_Report_With_Diagrams.html"), 'w') as f:
        f.write(final_doc)

if __name__ == "__main__":
    generate()
