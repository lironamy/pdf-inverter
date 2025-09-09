#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
True PDF Color Inverter

This script performs genuine color inversion on PDF files by:
1. Converting PDF pages to high-resolution images
2. Inverting colors at the pixel level (white -> black, black -> white)
3. Recreating a new PDF from the inverted images

This approach provides true color inversion rather than just overlays.
"""

import sys
import os
import json
from pathlib import Path
import argparse

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
    
    def __init__(self, dpi=300):
        """
        Initialize the inverter.
        
        Args:
            dpi (int): Resolution for PDF to image conversion (higher = better quality)
        """
        self.dpi = dpi
        self.temp_dir = Path("temp_images")
        self.temp_dir.mkdir(exist_ok=True)
    
    def pdf_to_images(self, pdf_path):
        """
        Convert PDF pages to high-resolution images.
        
        Args:
            pdf_path (str): Path to the input PDF file
            
        Returns:
            list: List of PIL Image objects, one per page
        """
        print(f"Converting PDF to images at {self.dpi} DPI...")
        
        doc = fitz.open(pdf_path)
        images = []
        
        for page_num in range(len(doc)):
            print(f"Processing page {page_num + 1}/{len(doc)}")
            
            # Get page
            page = doc.load_page(page_num)
            
            # Create matrix for high-resolution rendering
            # Higher DPI = better quality but larger file size
            zoom = self.dpi / 72.0  # 72 DPI is default
            mat = fitz.Matrix(zoom, zoom)
            
            # Render page to pixmap
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("ppm")
            img = Image.open(io.BytesIO(img_data))
            
            images.append(img)
        
        doc.close()
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
                img = img.convert('RGB')
            rgb_images.append(img)
        
        # Save as PDF
        rgb_images[0].save(
            output_path,
            save_all=True,
            append_images=rgb_images[1:],
            format='PDF',
            resolution=self.dpi
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
            
            # Step 1: Convert PDF to images
            images = self.pdf_to_images(input_path)
            
            if not images:
                raise ValueError("No pages found in PDF or conversion failed")
            
            # Step 2: Invert colors in each image
            print("Inverting colors...")
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
            
            print("SUCCESS: Color inversion completed successfully!")
            return True
            
        except Exception as e:
            print(f"ERROR: Error during processing: {str(e)}")
            return False
        
        finally:
            # Clean up temporary files if any
            self.cleanup_temp_files()
    
    def cleanup_temp_files(self):
        """Clean up any temporary files created during processing."""
        try:
            if self.temp_dir.exists():
                for file in self.temp_dir.glob("*"):
                    file.unlink()
        except Exception as e:
            print(f"Warning: Could not clean up temp files: {e}")


def main():
    """Main function to handle command line arguments and process PDF."""
    parser = argparse.ArgumentParser(
        description="True PDF Color Inverter - Invert colors in PDF files"
    )
    parser.add_argument("input", help="Input PDF file path")
    parser.add_argument("output", help="Output PDF file path")
    parser.add_argument(
        "--dpi", 
        type=int, 
        default=300, 
        help="DPI for image conversion (default: 300)"
    )
    parser.add_argument(
        "--mode", 
        choices=["reading", "printing", "presentation"],
        default="reading",
        help="Processing mode: reading (optimized for screen), printing (lighter for print), presentation (enhanced visuals)"
    )
    parser.add_argument(
        "--json", 
        action="store_true", 
        help="Output result as JSON (for programmatic use)"
    )
    
    args = parser.parse_args()
    
    # Validate input file
    if not os.path.exists(args.input):
        error_msg = f"Input file not found: {args.input}"
        if args.json:
            print(json.dumps({"success": False, "error": error_msg}))
        else:
            print(f"Error: {error_msg}")
        sys.exit(1)
    
    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Process the PDF
    inverter = TruePDFColorInverter(dpi=args.dpi)
    success = inverter.process_pdf(args.input, args.output, args.mode)
    
    # Output result
    if args.json:
        if success:
            result = {
                "success": True,
                "input_file": args.input,
                "output_file": args.output,
                "message": "PDF color inversion completed successfully"
            }
        else:
            result = {
                "success": False,
                "error": "PDF processing failed"
            }
        print(json.dumps(result))
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    # Add missing import for io
    import io
    main()