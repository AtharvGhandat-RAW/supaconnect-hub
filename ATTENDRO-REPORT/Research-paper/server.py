import http.server
import socketserver
import os
import sys

# Port configuration
PORT = 8082
DIRECTORY = "/workspaces/supaconnect-hub/ATTENDRO-REPORT/Research-paper"

# Define the handler to manage requests
class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve files from the specific directory
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        # Handle the save-paper endpoint
        if self.path == '/save-paper':
            try:
                # Get the size of the data
                content_length = int(self.headers['Content-Length'])
                # Read the data
                post_data = self.rfile.read(content_length)
                
                # Decode the content (assuming UTF-8)
                html_content = post_data.decode('utf-8')
                
                # Define file path
                file_path = os.path.join(DIRECTORY, "Attendro_Research_Paper_IRJMETS.html")
                
                # Write the changes to the file
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
                
                # Send success response
                self.send_response(200)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b"File saved successfully")
                print(f"Successfully saved {file_path}")
                
            except Exception as e:
                # Send error response
                print(f"Error saving file: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            # Handle unknown endpoints
            self.send_error(404, "Endpoint not found")

# Set up the server
# allow_reuse_address allows restarting immediately
socketserver.TCPServer.allow_reuse_address = True

try:
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        print(f"Serving HTTP on 0.0.0.0 port {PORT} (http://localhost:{PORT}/) ...")
        print(f"Serving files from {DIRECTORY}")
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")
    sys.exit(0)
