from http.server import BaseHTTPRequestHandler
import json
import os
import tempfile
import sys
from pathlib import Path
import io

# Set UTF-8 encoding for Windows compatibility
if sys.platform.startswith('win'):
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

try:
    import fitz  # PyMuPDF
    from PIL import Image, ImageOps
    import numpy as np
except ImportError as e:
    print(f"Missing required library: {e}")
    print("Please install required packages:")
    print("pip install PyMuPDF Pillow numpy")
    sys.exit(1)


class TruePDFColorInverter:
    """
    A class to handle true color inversion of PDF documents.
    
    This implementation converts PDF pages to images, inverts colors at the
    pixel level, and reconstructs a new PDF with the inverted content.
    """
    
    def __init__(self, dpi=300, optimize_large_files=False):
        """
        Initialize the inverter.
        
        Args:
            dpi (int): Resolution for PDF to image conversion (higher = better quality)
            optimize_large_files (bool): Whether to optimize for large files (lower DPI)
        """
        self.dpi = dpi
        self.optimize_large_files = optimize_large_files
        self.temp_dir = Path("temp_images")
        self.temp_dir.mkdir(exist_ok=True)
    
    def pdf_to_images(self, pdf_path):
        """
        Convert PDF pages to high-resolution images.
        
        Args:
            pdf_path (str): Path to the input PDF file
            
        Returns:
            list: List of PIL Image objects representing each page
        """
        print(f"Converting PDF to images at {self.dpi} DPI...")
        
        # Open the PDF document
        pdf_document = fitz.open(pdf_path)
        images = []
        
        # Convert each page to an image
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            
            # Create a high-resolution matrix for better quality
            mat = fitz.Matrix(self.dpi/72, self.dpi/72)  # 72 is the default DPI
            
            # Render page to image
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            images.append(img)
            
            print(f"Converted page {page_num + 1}/{len(pdf_document)}")
        
        pdf_document.close()
        print(f"Converted {len(images)} pages to images")
        return images
    
    def invert_image_colors(self, image):
        """
        Perform true color inversion on an image.
        
        Args:
            image (PIL.Image): Input image
            
        Returns:
            PIL.Image: Image with inverted colors
        """
        # Convert to RGB if not already
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Method 1: Using PIL's ImageOps.invert
        # This is the simplest and most reliable method
        inverted = ImageOps.invert(image)
        
        return inverted
    
    def advanced_color_inversion(self, image):
        """
        Advanced color inversion with fine-tuned adjustments.
        
        This method provides more control over the inversion process
        and can handle edge cases better.
        
        Args:
            image (PIL.Image): Input image
            
        Returns:
            PIL.Image: Image with advanced color inversion
        """
        # Convert to numpy array for pixel manipulation
        img_array = np.array(image)
        
        # Invert colors: 255 - original_value
        inverted_array = 255 - img_array
        
        # Optional: Adjust contrast or brightness if needed
        # This can help with readability in some cases
        
        # For very light grays, make them darker
        # For very dark grays, make them lighter
        mask_light = (inverted_array > 200).all(axis=2)
        mask_dark = (inverted_array < 55).all(axis=2)
        
        # Adjust light areas to be darker
        inverted_array[mask_light] = inverted_array[mask_light] * 0.8
        
        # Adjust very dark areas to be slightly lighter for readability
        inverted_array[mask_dark] = inverted_array[mask_dark] + 30
        
        # Ensure values stay in valid range
        inverted_array = np.clip(inverted_array, 0, 255)
        
        # Convert back to PIL Image
        inverted_image = Image.fromarray(inverted_array.astype('uint8'))
        
        return inverted_image
    
    def printing_color_inversion(self, image):
        """
        Color inversion optimized for printing.
        
        This method creates a lighter dark mode that works better
        when printed, preserving more contrast and readability.
        
        Args:
            image (PIL.Image): Input image
            
        Returns:
            PIL.Image: Image with printing-optimized color inversion
        """
        # Convert to numpy array for pixel manipulation
        img_array = np.array(image)
        
        # Invert colors: 255 - original_value
        inverted_array = 255 - img_array
        
        # For printing mode, we want a lighter dark mode
        # Reduce the intensity of the inversion to make it more print-friendly
        inverted_array = inverted_array * 0.7  # Make it 70% of full inversion
        
        # Add some white back to make it lighter
        inverted_array = inverted_array + (255 * 0.3)
        
        # Ensure values stay in valid range
        inverted_array = np.clip(inverted_array, 0, 255)
        
        # Convert back to PIL Image
        inverted_image = Image.fromarray(inverted_array.astype('uint8'))
        
        return inverted_image
    
    def images_to_pdf(self, images, output_path):
        """
        Create a PDF from a list of images.
        
        Args:
            images (list): List of PIL Image objects
            output_path (str): Path for the output PDF file
        """
        print(f"Creating PDF from {len(images)} inverted images...")
        
        if not images:
            raise ValueError("No images to convert to PDF")
        
        # Convert all images to RGB mode
        rgb_images = []
        for img in images:
            if img.mode != 'RGB':
                rgb_images.append(img.convert('RGB'))
            else:
                rgb_images.append(img)
        
        # Save the first image as PDF and append the rest
        if rgb_images:
            rgb_images[0].save(
                output_path,
                "PDF",
                resolution=self.dpi,
                save_all=True,
                append_images=rgb_images[1:] if len(rgb_images) > 1 else []
            )
        
        print(f"PDF created successfully: {output_path}")
    
    def process_pdf(self, input_path, output_path, mode="reading"):
        """
        Main method to process a PDF and invert its colors.
        
        Args:
            input_path (str): Path to input PDF
            output_path (str): Path for output PDF
            mode (str): Processing mode - "reading", "printing", or "presentation"
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            print(f"Starting true color inversion for: {input_path}")
            print(f"Output will be saved to: {output_path}")
            
            # Check file size and adjust DPI for large files
            file_size = os.path.getsize(input_path)
            if file_size > 10 * 1024 * 1024:  # 10MB
                print(f"Large file detected ({file_size / (1024*1024):.1f}MB), optimizing DPI...")
                self.dpi = 200  # Reduce DPI for large files
                print(f"Reduced DPI to {self.dpi} for better performance")
            
            # Step 1: Convert PDF to images
            images = self.pdf_to_images(input_path)
            
            if not images:
                raise ValueError("No pages found in PDF or conversion failed")
            
            # Step 2: Invert colors in each image
            inverted_images = []
            
            for i, img in enumerate(images):
                print(f"Inverting colors for page {i + 1}/{len(images)}")
                
                # Apply different inversion methods based on mode
                if mode == "presentation":
                    inverted_img = self.advanced_color_inversion(img)
                elif mode == "printing":
                    inverted_img = self.printing_color_inversion(img)
                else:  # reading mode (default)
                    inverted_img = self.invert_image_colors(img)
                
                inverted_images.append(inverted_img)
            
            # Step 3: Create new PDF from inverted images
            self.images_to_pdf(inverted_images, output_path)
            
            print(f"Successfully processed {len(images)} pages")
            return True
            
        except Exception as e:
            print(f"Error processing PDF: {e}")
            return False

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
