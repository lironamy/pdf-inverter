"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Upload,
  Download,
  Eye,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Settings,
  Clock,
  FileCheck,
  Info,
} from "lucide-react"

interface ProcessingStats {
  pageCount: number
  originalSize: number
  processedSize: number
  processingTime: number
  errors?: string[]
}

export default function PDFInverterPage() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processedPdfUrl, setProcessedPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState("")
  const [processingMode, setProcessingMode] = useState<"reading" | "printing" | "presentation">("reading")
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null)
  const [previewZoom, setPreviewZoom] = useState(100)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile)
      setError(null)
      setProcessedPdfUrl(null)
    } else {
      setError("אנא העלה קובץ PDF תקין.")
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile)
        setError(null)
        setProcessedPdfUrl(null)
      } else {
        setError("אנא העלה קובץ PDF תקין.")
      }
    }
  }

  const processPDF = async () => {
    if (!file) return

    // Check file size before processing
    const maxSize = 15 * 1024 * 1024 // 15MB
    if (file.size > maxSize) {
      setError(`הקובץ גדול מדי (${formatFileSize(file.size)}). אנא בחר קובץ קטן מ-15MB או נסה לחלק את ה-PDF לדפים נפרדים`)
      return
    }

    setProcessing(true)
    setError(null)
    setUploadProgress(0)
    setProcessingStep("מעלה PDF...")
    setProcessingStats(null)

    const formData = new FormData()
    formData.append("pdf", file)
    formData.append("mode", processingMode)

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      setProcessingStep("מעבד דפי PDF...")

      const response = await fetch("/api/process-pdf", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("הקובץ גדול מדי. אנא בחר קובץ קטן מ-15MB")
        }
        
        let errorData
        try {
          errorData = await response.json()
        } catch (jsonError) {
          // If response is not JSON, create a generic error
          errorData = { error: "שגיאה בשרת. אנא נסה שוב." }
        }
        throw new Error(errorData.error || "נכשל בעיבוד ה-PDF")
      }

      setProcessingStep("מסיים...")
      const stats: ProcessingStats = {
        pageCount: Number.parseInt(response.headers.get("X-Pages-Processed") || "0"),
        originalSize: Number.parseInt(response.headers.get("X-Original-Size") || "0"),
        processedSize: Number.parseInt(response.headers.get("X-Output-Size") || "0"),
        processingTime: Number.parseInt(response.headers.get("X-Processing-Time") || "0"),
        errors: response.headers.get("X-Processing-Errors") !== "0" ? ["אירעו אזהרות עיבוד"] : undefined,
      }
      setProcessingStats(stats)

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setProcessedPdfUrl(url)
      setProcessingStep("הושלם!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "נכשל בעיבוד ה-PDF. אנא נסה שוב.")
      console.error("Processing error:", err)
    } finally {
      setProcessing(false)
      setUploadProgress(0)
      setProcessingStep("")
    }
  }

  const downloadPDF = () => {
    if (processedPdfUrl) {
      const link = document.createElement("a")
      link.href = processedPdfUrl
      link.download = `${file?.name.replace(/\.pdf$/i, "")}_dark_mode_${processingMode}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const resetApp = () => {
    setFile(null)
    setProcessedPdfUrl(null)
    setError(null)
    setUploadProgress(0)
    setProcessingStep("")
    setProcessingStats(null)
    setPreviewZoom(100)
    if (processedPdfUrl) {
      URL.revokeObjectURL(processedPdfUrl)
    }
  }

  const handleZoomIn = () => setPreviewZoom((prev) => Math.min(prev + 25, 200))
  const handleZoomOut = () => setPreviewZoom((prev) => Math.max(prev - 25, 50))
  const handleZoomReset = () => setPreviewZoom(100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
            <RotateCcw className="h-4 w-4" />
מהפך צבעי PDF
          </div>
          <h1 className="text-4xl font-bold text-foreground text-balance">הפיכת PDF למצב כהה</h1>
          <div className="bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/20 dark:to-purple-900/20 rounded-lg p-4 mb-4 border border-pink-200 dark:border-pink-800">
            <p className="text-lg text-pink-700 dark:text-pink-300 font-medium text-center">
              💕 נוצר במיוחד בשבילך, לוטרה שלי 💕
            </p>
            <p className="text-sm text-pink-600 dark:text-pink-400 text-center mt-1">
              עכשיו תוכלי לקרוא בנוחות גם בחושך
            </p>
          </div>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            העלה את מסמכי ה-PDF שלך והמר אותם מיד מרקעים בהירים למצב כהה. מושלם לקריאה
            בסביבות עם תאורה נמוכה או להפחתת עומס על העיניים.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
              💡 <strong>טיפ:</strong> האפליקציה משתמשת ב-Python בלבד להיפוך צבעים אמיתי!
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
              📏 מגבלת גודל: 15MB (מורחב)
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-500 text-center mt-1">
              💡 לקבצים גדולים: נסה לחלק את ה-PDF לדפים נפרדים
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 text-center mt-1">
              ✨ Python בלבד! היפוך צבעים אמיתי ברמת הפיקסלים!
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
העלאת מסמך PDF
            </CardTitle>
            <CardDescription>בחר קובץ PDF או גרור ושחרר אותו כאן. גודל קובץ מקסימלי: 15MB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
מצב עיבוד
              </label>
              <Select
                value={processingMode}
                onValueChange={(value: "reading" | "printing" | "presentation") => setProcessingMode(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחר מצב עיבוד" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reading">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">מצב קריאה</span>
                      <span className="text-xs text-muted-foreground">
                        היפוך צבעים מלא - אופטימלי לקריאה על המסך
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="printing">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">מצב הדפסה</span>
                      <span className="text-xs text-muted-foreground">
                        היפוך צבעים קל יותר - מותאם להדפסה
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="presentation">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">מצב מצגת</span>
                      <span className="text-xs text-muted-foreground">
                        אלגוריתם מתקדם עם התאמות צבעים משופרות
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
                dragActive
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-none" title={file.name}>{file.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">{formatFileSize(file.size)}</Badge>
                        <Badge variant="outline">מסמך PDF</Badge>
                        <Badge variant="outline">
                          {processingMode === 'reading' ? 'מצב קריאה' : 
                           processingMode === 'printing' ? 'מצב הדפסה' : 
                           processingMode === 'presentation' ? 'מצב מצגת' : processingMode}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {processing && (
                    <div className="space-y-3">
                      <Progress value={uploadProgress} className="w-full" />
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {processingStep}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 justify-center">
                    <Button onClick={processPDF} disabled={processing} size="lg" className="min-w-[140px]">
                      {processing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
מעבד...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
הפוך צבעים
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={resetApp} disabled={processing}>
בחר קובץ אחר
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">שחרר את ה-PDF שלך כאן</h3>
                    <p className="text-muted-foreground">או לחץ על הכפתור למטה כדי לעיין בקבצים שלך</p>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <Button asChild size="lg">
                    <label htmlFor="pdf-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
בחר קובץ PDF
                    </label>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {processedPdfUrl && (
          <Card className="border-2 border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
ה-PDF עובד בהצלחה
              </CardTitle>
              <CardDescription>
                ה-PDF שלך הומר למצב כהה. תצוגה מקדימה למטה או הורד את הקובץ המעובד.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {processingStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <FileCheck className="h-4 w-4" />
דפים
                    </div>
                    <div className="text-lg font-semibold">{processingStats.pageCount}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
זמן
                    </div>
                    <div className="text-lg font-semibold">{processingStats.processingTime}ms</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Info className="h-4 w-4" />
מקורי
                    </div>
                    <div className="text-lg font-semibold">{formatFileSize(processingStats.originalSize)}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Info className="h-4 w-4" />
מעובד
                    </div>
                    <div className="text-lg font-semibold">{formatFileSize(processingStats.processedSize)}</div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button onClick={downloadPDF} size="lg" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
הורד PDF מופך
                </Button>
                <Button variant="outline" onClick={resetApp} size="lg">
                  <Upload className="h-4 w-4 mr-2" />
עבד PDF אחר
                </Button>
              </div>

              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
תצוגה מקדימה
                  </TabsTrigger>
                  <TabsTrigger value="details" className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
פרטים
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span className="font-medium">תצוגה מקדימה של PDF</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={previewZoom <= 50}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleZoomReset}>
                        {previewZoom}%
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={previewZoom >= 200}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(processedPdfUrl, "_blank")}>
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="border-2 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                    <iframe
                      src={processedPdfUrl}
                      className="w-full h-[500px]"
                      title="תצוגה מקדימה של PDF מעובד"
                      style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: "top left" }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="details" className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="font-medium">שם קובץ מקורי</span>
                        <span className="text-muted-foreground">{file?.name}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="font-medium">מצב עיבוד</span>
                        <Badge variant="outline">
                          {processingMode === 'reading' ? 'מצב קריאה' : 
                           processingMode === 'printing' ? 'מצב הדפסה' : 
                           processingMode === 'presentation' ? 'מצב מצגת' : processingMode}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="font-medium">שם קובץ פלט</span>
                        <span className="text-muted-foreground">
                          {file?.name.replace(/\.pdf$/i, "")}_dark_mode_{processingMode}.pdf
                        </span>
                      </div>
                      {processingStats?.errors && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium mb-2">
                            <AlertCircle className="h-4 w-4" />
אזהרות עיבוד
                          </div>
                          <ul className="text-sm text-yellow-600 dark:text-yellow-300 space-y-1">
                            {processingStats.errors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">העלאה קלה</h3>
                <p className="text-sm text-muted-foreground">גרור ושחרר או לחץ כדי לבחור את קבצי ה-PDF שלך</p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <RotateCcw className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">עיבוד מיידי</h3>
                <p className="text-sm text-muted-foreground">
                  אלגוריתמים מתקדמים הופכים צבעים תוך שמירה על הפריסה
                </p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">הורדה ותצוגה מקדימה</h3>
                <p className="text-sm text-muted-foreground">תצוגה מקדימה בדפדפן או הורד את ה-PDF במצב כהה</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
