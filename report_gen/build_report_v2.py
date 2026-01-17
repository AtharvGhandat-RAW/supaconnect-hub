import os
import markdown
import re
from weasyprint import HTML, CSS

# Configuration
OUTPUT_DIR = "report_gen/output"
CONTENT_DIR = "report_gen/content"
SOURCE_MD_PATH = "project-report/ATTENDRO_PROJECT_REPORT.md"

CSS_STYLES = """
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

/* Chapter Name / Topic Name - TNR 14 Capital */
h1 {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    text-align: center;
    page-break-before: always;
    margin-top: 0;
}

/* Section Heading - TNR 12 Capital Bold */
h2 {
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-top: 24pt;
    margin-bottom: 12pt;
    page-break-after: avoid;
    text-align: left;
}

/* Subsection Heading - TNR 12 Bold Normal */
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

/* Tables */
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

/* Special Layouts */

/* 1. Title Page */
.title-page-container {
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    page-break-after: always;
    line-height: 1.5; /* Looser on title page? Or keep double? Rule says report is double space. Title page can be exception or standard. */
}
.title-project-title {
    font-size: 16pt; /* Slightly bigger for visual distinction, or keep 14 capital per rule */
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 2cm;
}
.title-label {
    font-weight: bold;
    margin-top: 1cm;
}
.title-value {
    margin-bottom: 0.5cm;
    text-transform: uppercase; /* Often names are uppercase on covers */
}

/* 2. Certificate */
.certificate-container {
    text-align: justify;
    page-break-after: always;
}
.cert-title {
    text-align: center;
    text-transform: uppercase;
    font-weight: bold;
    font-size: 14pt;
    margin-bottom: 2cm;
}
.cert-signatures {
    margin-top: 3cm;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap; /* In case WeasyPrint supports flex well */
}
/* Weasyprint flex support is decent, but table is safer for signatures */
.sig-table {
    width: 100%;
    border: none;
    margin-top: 3cm;
}
.sig-table td {
    border: none;
    text-align: center;
    vertical-align: bottom;
    height: 2cm;
}

"""

def process_markdown_content(md_content):
    """
    Transforms RAW Markdown into structured HTML fragments matching the rules.
    Crucially: Promotes ### 1.1 to H2 (Section) instead of H3.
    """
    
    # 1. Promote Sections (1.1, 2.1 etc) from ### to ## 
    # Valid patterns: ### 1.1, ### 1.2, ### 5.4 
    # INVALID: ### 1.1.1 (Subsection)
    
    lines = md_content.split('\n')
    processed_lines = []
    
    for line in lines:
        # Regex to find "### X.X " but NOT "### X.X.X"
        # If it matches ### X.X, change to ## X.X
        if re.match(r'^###\s+\d+\.\d+\s+', line):
            line = line.replace('###', '##', 1)
        elif re.match(r'^###\s+\d+\.\d+\.\d+\s+', line):
            # It is a subsection, keep as ### (H3)
            pass
        
        # Chapter handling: # Chapter-1 -> # Chapter 1
        if line.startswith("# Chapter"):
            line = line.replace("–", " ").replace("-", " ")
            
        processed_lines.append(line)
        
    return "\n".join(processed_lines)

def parse_sections(md_text):
    sections = []
    
    lines = md_text.split('\n')
    current_title = ""
    current_content = []
    
    def flush(title, content):
        if title: 
            sections.append({"title": title, "content": "\n".join(content)})
    
    # We rely on the ## Title Page markers I saw in the file
    pass_intro = False
    
    for line in lines:
        # Front Matter Markers
        if "## Title Page" in line:
            flush(current_title, current_content) 
            current_title = "Title Page"
            current_content = []
            pass_intro = True
            continue # Don't include the marker line
            
        if not pass_intro:
            continue
            
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
        # Chapters (Using single #)
        elif line.startswith("# Chapter"):
            flush(current_title, current_content)
            current_title = line.strip("# ").strip()
            current_content = [] # Don't include the H1 line in content, we'll add it manually as H1
        elif line.startswith("# References"):
             flush(current_title, current_content)
             current_title = "References"
             current_content = []
        else:
            current_content.append(line)
            
    flush(current_title, current_content)
    return sections

def create_title_page_html():
    return """
    <div class="title-page-container">
        <div class="title-project-title">ATTENDRO: Smart Biometric + App-Based Attendance Management System using AI & IoT</div>
        
        <p>A Project Report Submitted by</p>
        <p><strong>[STUDENT NAME]</strong></p>
        
        <p>In partial fulfillment of the requirements for the Diploma in</p>
        <p><strong>APPLIED AI & ML</strong></p>
        
        <p>At</p>
        <p><strong>Rajarambapu Institute of Technology, Islampur</strong></p>
        
        <p><strong>2025–2026</strong></p>
        <br><br>
        <p>Under the Guidance of</p>
        <p><strong>[GUIDE NAME]</strong></p>
    </div>
    """ # Customized based on standard academic cover, substituting the raw list from MD

def create_certificate_html():
    return """
    <div class="certificate-container">
        <div class="cert-title">CERTIFICATE</div>
        <p>This is to certify that the project titled <strong>"ATTENDRO: Smart Biometric + App-Based Attendance Management System using AI & IoT"</strong> has been carried out by <strong>[Student Name]</strong> under my guidance and supervision in partial fulfillment of the requirements for the award of the Diploma in <strong>Applied AI & ML</strong> at <strong>Rajarambapu Institute of Technology, Islampur</strong>, during the academic year <strong>2025–2026</strong>.</p>
        
        <table class="sig-table">
            <tr>
                <td>___________________<br><strong>Guide</strong></td>
                <td>___________________<br><strong>H.O.D.</strong></td>
                <td>___________________<br><strong>Principal</strong></td>
            </tr>
            <tr>
               <td colspan="3" style="text-align:left; padding-top:1cm;">Date: _______________<br>Place: Islampur</td>
            </tr>
        </table>
    </div>
    """

def generate():
    with open(SOURCE_MD_PATH, 'r', encoding='utf-8') as f:
        raw = f.read()
        
    refined_md = process_markdown_content(raw)
    sections = parse_sections(refined_md)
    
    full_body_html = ""
    
    for idx, sec in enumerate(sections):
        title = sec['title']
        content = sec['content']
        
        # Generate HTML from MD
        html_content = markdown.markdown(content, extensions=['tables'])
        
        # Logic for Special Pages
        if "Title Page" in title:
            final_section = create_title_page_html() # Ignore MD content, use Custom Template
        elif "Certificate" in title:
            final_section = create_certificate_html() # Ignore MD content, use Custom Template
        else:
            # Standard Section
            # Add H1 manually since we stripped it (or didn't include it in content)
            # Exception: Ack/Abstract/Etc usually assume H1 from title
            final_section = f"<h1>{title}</h1>\n{html_content}"
            if "Table of Contents" in title:
                # Custom fixed styling for TOC if needed, or let MD handle it
                pass
        
        # Save individual HTML file
        safe_title = title.replace(" ", "-").replace("/", "-")[:30]
        fname = f"{idx+1:02d}_{safe_title}.html"
        fpath = os.path.join(CONTENT_DIR, fname)
        
        page_html = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><title>{title}</title><style>{CSS_STYLES}</style></head><body>{final_section}</body></html>"""
        
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(page_html)
            
        full_body_html += f"\n<div class='section-wrapper'>{final_section}</div>\n"

    # Final PDF
    pdf_path = os.path.join(OUTPUT_DIR, "Attendro_Final_Report.pdf")
    final_doc = f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><style>{CSS_STYLES}</style></head><body>{full_body_html}</body></html>"""
    
    HTML(string=final_doc).write_pdf(pdf_path)
    print("PDF Generated Successfully.")

if __name__ == "__main__":
    generate()
