import { NextResponse } from "next/server"

export async function GET() {
  try {
    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      services: {
        pdfProcessing: "operational",
        fileUpload: "operational",
      },
      limits: {
        maxFileSize: "10MB",
        supportedFormats: ["PDF"],
      },
    }

    return NextResponse.json(healthData, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      },
      { status: 500 },
    )
  }
}
