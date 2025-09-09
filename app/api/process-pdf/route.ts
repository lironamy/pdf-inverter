import { type NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import os from "os"

const execAsync = promisify(exec)

// Configuration for Vercel App Router
export const config = {
  maxDuration: 60,
  runtime: 'nodejs',
}

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15MB (increased limit)
const ALLOWED_MIME_TYPES = ["application/pdf"]

// Function to sanitize filename for safe use in headers
function sanitizeFilename(filename: string): string {
  // Remove or replace non-ASCII characters and special characters
  return filename
    .replace(/[^\x00-\x7F]/g, '_') // Replace non-ASCII characters with underscore
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single underscore
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 100) // Limit length to prevent header issues
    || 'processed_pdf' // Fallback if filename becomes empty
}

// Function to process PDF using Python via subprocess
async function processPDFWithPythonSubprocess(
  inputBuffer: ArrayBuffer, 
  mode: string
): Promise<{ success: boolean; outputBuffer?: Buffer; pageCount?: number; error?: string }> {
  try {
    // Create temporary files
    const tempDir = os.tmpdir()
    const inputPath = path.join(tempDir, `input_${Date.now()}.pdf`)
    const outputPath = path.join(tempDir, `output_${Date.now()}.pdf`)
    
    // Write input buffer to temporary file
    await fs.writeFile(inputPath, Buffer.from(inputBuffer))
    
    // Run Python script directly
    const pythonScript = path.join(process.cwd(), 'pdf_inverter.py')
    const isLargeFile = inputBuffer.byteLength > 10 * 1024 * 1024 // 10MB
    const dpi = isLargeFile ? 200 : 300 // Lower DPI for large files
    const command = `python "${pythonScript}" "${inputPath}" "${outputPath}" --dpi ${dpi} --mode ${mode}`
    
    const { stdout, stderr } = await execAsync(command)
    
    if (stderr) {
      console.warn('Python script stderr:', stderr)
    }
    
    // Read the output file
    const outputBuffer = await fs.readFile(outputPath)
    
    // Clean up temporary files
    await fs.unlink(inputPath).catch(() => {})
    await fs.unlink(outputPath).catch(() => {})
    
    // Extract page count from stdout
    const pageCountMatch = stdout.match(/Converted (\d+) pages to images/)
    const pageCount = pageCountMatch ? parseInt(pageCountMatch[1]) : 0
    
    return { success: true, outputBuffer, pageCount }
    
  } catch (error) {
    console.error('Python subprocess error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown Python subprocess error' 
    }
  }
}


export async function POST(request: NextRequest) {
  try {
    // Check if we're in a serverless environment
    const isServerless = process.env.VERCEL || process.env.NETLIFY
    
    const formData = await request.formData()
    const file = formData.get("pdf") as File
    const mode = (formData.get("mode") as string) || "reading"

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided", code: "NO_FILE" }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a PDF file.", code: "INVALID_TYPE" },
        { status: 400 },
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`, code: "FILE_TOO_LARGE" },
        { status: 400 },
      )
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file provided.", code: "EMPTY_FILE" }, { status: 400 })
    }

    console.log(`Processing PDF: ${file.name}, Size: ${file.size} bytes, Mode: ${mode}`)

    const pdfBytes = await file.arrayBuffer()

    const startTime = Date.now()

    // Process PDF using Python only
    let pythonResult: { success: boolean; outputBuffer?: Buffer; pageCount?: number; error?: string }
    
    try {
      // Use Python subprocess (works in both local and serverless)
      pythonResult = await processPDFWithPythonSubprocess(pdfBytes, mode)
    } catch (pythonError) {
      console.error("Python processing failed:", pythonError)
      return NextResponse.json(
        { error: "Python processing failed", details: String(pythonError), code: "PYTHON_ERROR" },
        { status: 500 },
      )
    }

    if (!pythonResult.success) {
      console.error("Python PDF processing failed:", pythonResult.error)
      return NextResponse.json(
        { error: "Python processing failed", details: pythonResult.error, code: "PYTHON_ERROR" },
        { status: 500 },
      )
    }

    const processingTime = Date.now() - startTime
    const pageCount = pythonResult.pageCount || 0

    console.log(`PDF processing complete (Python). Pages: ${pageCount}, Time: ${processingTime}ms`)

    const originalName = file.name.replace(/\.pdf$/i, "")
    const sanitizedFilename = sanitizeFilename(originalName)
    const outputFilename = `${sanitizedFilename}_dark_mode.pdf`

    return new NextResponse(pythonResult.outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${outputFilename}"`,
        "Content-Length": pythonResult.outputBuffer!.length.toString(),
        "X-Original-Filename": sanitizeFilename(file.name),
        "X-Original-Size": pdfBytes.byteLength.toString(),
        "X-Output-Size": pythonResult.outputBuffer!.length.toString(),
        "X-Pages-Processed": pageCount.toString(),
        "X-Processing-Time": processingTime.toString(),
        "X-Processing-Errors": "0",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("PDF processing error:", error)

    let errorMessage = "An unexpected error occurred while processing the PDF."
    let errorCode = "UNKNOWN_ERROR"

    if (error instanceof Error) {
      if (error.message.includes("Invalid PDF")) {
        errorMessage = "The uploaded file appears to be corrupted or is not a valid PDF."
        errorCode = "INVALID_PDF"
      } else if (error.message.includes("Memory")) {
        errorMessage = "The PDF is too complex to process. Please try a smaller or simpler PDF."
        errorCode = "MEMORY_ERROR"
      } else if (error.message.includes("timeout")) {
        errorMessage = "Processing timed out. Please try a smaller PDF."
        errorCode = "TIMEOUT_ERROR"
      } else if (error.message.includes("Request Entity Too Large")) {
        errorMessage = "File too large. Please try a smaller PDF file."
        errorCode = "FILE_TOO_LARGE"
      }
    }

    // Ensure we always return valid JSON
    try {
      return NextResponse.json(
        {
          error: errorMessage,
          code: errorCode,
          timestamp: new Date().toISOString(),
        },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        },
      )
    } catch (jsonError) {
      // Fallback response if JSON serialization fails
      return new NextResponse(
        JSON.stringify({
          error: "Internal server error",
          code: "INTERNAL_ERROR",
          timestamp: new Date().toISOString(),
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
    }
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
