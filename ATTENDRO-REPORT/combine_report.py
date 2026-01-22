import os
import re
from html.parser import HTMLParser

# List of files in order
files = [
    "Cover_Page.html",
    "Acknowledgment.html",
    "Abstract.html",
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

base_dir = "/workspaces/supaconnect-hub/ATTENDRO-REPORT"
output_file = os.path.join(base_dir, "Attendro_Full_Report.html")

# Common Header
html_start = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendro - Full Project Report</title>
    <!-- Mermaid JS -->
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
    </script>
    <style>
        @page {
            size: A4;
            margin: 2.5cm 1.25cm 1.25cm 3.5cm;
        }

        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 2;
            text-align: justify;
            margin: 0;
            padding: 20px;
            background-color: #f0f2f5;
            color: black;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .paper {
            background-color: white;
            width: 210mm;
            min-height: 297mm;
            padding: 2.5cm 1.25cm 1.25cm 3.5cm;
            box-sizing: border-box;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            position: relative;
            page-break-after: always;
        }
        
        .paper:last-child {
            page-break-after: auto;
        }

        @media print {
            body { 
                background: none; 
                padding: 0; 
                display: block; 
            }
            .paper {
                box-shadow: none;
                margin: 0;
                width: auto;
                min-height: auto;
                padding: 0;
                page-break-after: always;
            }
            .controls, .btn { display: none !important; }
        }

        /* Common Styles */
        h1.chapter-title {
            font-size: 14pt;
            text-transform: uppercase;
            text-align: center;
            font-weight: bold;
            margin-bottom: 24pt;
            margin-top: 0;
        }
        h2.section-heading {
            font-size: 12pt;
            text-transform: uppercase;
            font-weight: bold;
            margin-top: 18pt;
            margin-bottom: 12pt;
        }
        h3.subsection-heading {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 6pt;
        }
        p { margin-bottom: 12pt; text-indent: 1cm; }
        ul, ol { margin-bottom: 12pt; padding-left: 1.5cm; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11pt; }
        th, td { border: 1px solid black; padding: 8px; vertical-align: top; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .mermaid { text-align: center; margin: 24pt 0; }
        .mermaid svg { max-width: 100%; }
        .figure-caption { font-style: italic; text-align: center; margin-bottom: 12pt; font-weight: bold;}
        
        /* TOC Specific */
        .toc-entry { display: flex; align-items: baseline; margin-bottom: 6pt; }
        .toc-chapter-main { font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; }
        .title { flex: 1; position: relative; overflow: hidden; }
        .page { font-weight: bold; }
        .indent-1 { margin-left: 0; }
        .indent-2 { margin-left: 20px; }
        
        /* Reference List */
        .reference-item { margin-bottom: 12pt; display: flex; }
        .ref-number { min-width: 40px; }

        /* Controls */
        .controls {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex;
            gap: 10px;
        }
        .btn {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-family: sans-serif;
            font-size: 14px;
        }
        .btn:hover { background-color: #0056b3; }
        .btn-doc { background-color: #28a745; }
        .btn-doc:hover { background-color: #218838; }

        /* COVER PAGE STYLES */
        .cover-page {
            text-align: center !important;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .cover-page .project-title {
            font-size: 16pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 20pt 0;
            line-height: 1.5;
        }
        .cover-page .topic-name {
            font-size: 14pt;
            text-transform: uppercase;
            margin-bottom: 12pt;
        }
        .cover-page .section-heading {
            text-align: center;
        }
        .cover-page .student-list {
            margin: 20px auto;
            width: 80%;
            text-align: left;
        }
        .cover-page .student-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .cover-page .signatures {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            text-align: center;
        }
        .cover-page .sig-block {
            margin-bottom: 40px;
        }
        .cover-page .footer {
            margin-top: auto;
        }
    </style>
    <script>
        function downloadDoc() {
            var content = document.getElementById("full-report-content").innerHTML;
            
            // Cleanup script tags if any
            content = content.replace(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gm, "");
            
            // Create a Blob-based download
            var header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
                 "xmlns:w='urn:schemas-microsoft-com:office:word' " +
                 "xmlns='http://www.w3.org/TR/REC-html40'>" +
                 "<head><meta charset='utf-8'><title>Attendro Full Report</title></head><body>";
            var footer = "</body></html>";
            
            var source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(header + content + footer);
            var fileDownload = document.createElement("a");
            document.body.appendChild(fileDownload);
            fileDownload.href = source;
            fileDownload.download = 'Attendro_Full_Report.doc';
            fileDownload.click();
            document.body.removeChild(fileDownload);
        }
    </script>
</head>
<body>
    <div class="controls">
        <button onclick="window.print()" class="btn">Download / Print PDF</button>
        <button onclick="downloadDoc()" class="btn btn-doc">Download DOC (Combined)</button>
    </div>
    <div id="full-report-content">
"""

html_end = """
    </div>
</body>
</html>
"""

class ContentExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.target_content = ""
        self.recording = False
        self.div_level = 0
        self.target_div_level = -1
        self.found_target = False

    def handle_starttag(self, tag, attrs):
        if self.found_target:
            if self.recording:
                # Reconstruct tag
                attr_str = "".join([f' {k}="{v}"' for k, v in attrs])
                # Skip script tags and controls in output 
                if tag != 'script':
                    self.target_content += f"<{tag}{attr_str}>"
            if tag == 'div':
                self.div_level += 1
            return

        if tag == 'div':
            # Check for class="paper" or class="container"
            attr_dict = dict(attrs)
            class_name = attr_dict.get('class', '')
            if 'paper' in class_name or 'container' in class_name:
                self.recording = True
                self.target_div_level = self.div_level
                self.found_target = True
                # Do NOT include the wrapper div itself in the content we return
                # We want INNER content
            self.div_level += 1

    def handle_endtag(self, tag):
        if self.found_target:
            if tag == 'div':
                self.div_level -= 1
                if self.div_level == self.target_div_level:
                    self.recording = False
                    # We reached the end of our target div
                    return

            if self.recording:
                if tag != 'script':
                    self.target_content += f"</{tag}>"

    def handle_data(self, data):
        if self.recording:
            self.target_content += data

    def handle_entityref(self, name):
        if self.recording:
            self.target_content += f"&{name};"

    def handle_charref(self, name):
        if self.recording:
            self.target_content += f"&#{name};"

full_content = ""

for filename in files:
    filepath = os.path.join(base_dir, filename)
    if os.path.exists(filepath):
        print(f"Processing {filename}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
            # Use the parser to extract INNER content of the main wrapper
            parser = ContentExtractor()
            parser.feed(content)
            
            inner_content = parser.target_content
            
            # Fallback if parser found nothing (e.g. malformed HTML)
            if not inner_content.strip():
                # Fallback to crude regex for body
                body_match = re.search(r'<body>([\s\S]*?)</body>', content)
                if body_match:
                     inner_content = body_match.group(1)
                     # Attempt to clean wrappers crudely
                     inner_content = re.sub(r'<div class="controls">.*?</div>', '', inner_content, flags=re.DOTALL)
                     inner_content = re.sub(r'<script\b[^>]*>([\s\S]*?)<\/script>', '', inner_content, flags=re.DOTALL)
            
            # Wrap in .paper for the final report
            if inner_content.strip():
                if filename == "Cover_Page.html":
                    full_content += f'<div class="paper cover-page">\n{inner_content}\n</div>\n'
                else:
                    full_content += f'<div class="paper">\n{inner_content}\n</div>\n'

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(html_start + full_content + html_end)

print(f"Created {output_file}")
