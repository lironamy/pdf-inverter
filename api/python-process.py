from http.server import BaseHTTPRequestHandler
import json
import os
import tempfile
import sys
from pathlib import Path

# Add the parent directory to the path to import our PDF inverter
sys.path.append(str(Path(__file__).parent.parent))
from pdf_inverter import TruePDFColorInverter

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get content length
            content_length = int(self.headers['Content-Length'])
            
            # Read the request body
            post_data = self.rfile.read(content_length)
            
            # Parse form data (simplified)
            # In a real implementation, you'd use proper form parsing
            boundary = self.headers['Content-Type'].split('boundary=')[1]
            parts = post_data.split(f'--{boundary}'.encode())
            
            pdf_data = None
            mode = "reading"
            
            for part in parts:
                if b'name="pdf"' in part:
                    # Extract PDF data
                    pdf_start = part.find(b'\r\n\r\n') + 4
                    pdf_end = part.rfind(b'\r\n')
                    pdf_data = part[pdf_start:pdf_end]
                elif b'name="mode"' in part:
                    # Extract mode
                    mode_start = part.find(b'\r\n\r\n') + 4
                    mode_end = part.rfind(b'\r\n')
                    mode = part[mode_start:mode_end].decode()
            
            if not pdf_data:
                self.send_error(400, "No PDF data found")
                return
            
            # Create temporary files
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as input_file:
                input_file.write(pdf_data)
                input_path = input_file.name
            
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as output_file:
                output_path = output_file.name
            
            try:
                # Process the PDF
                inverter = TruePDFColorInverter(dpi=300)
                success = inverter.process_pdf(input_path, output_path, mode)
                
                if success:
                    # Read the processed PDF
                    with open(output_path, 'rb') as f:
                        processed_data = f.read()
                    
                    # Send response
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/pdf')
                    self.send_header('Content-Length', str(len(processed_data)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(processed_data)
                else:
                    self.send_error(500, "PDF processing failed")
                    
            finally:
                # Clean up temporary files
                try:
                    os.unlink(input_path)
                    os.unlink(output_path)
                except:
                    pass
                    
        except Exception as e:
            self.send_error(500, f"Server error: {str(e)}")
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
