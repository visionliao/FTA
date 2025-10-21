import { useState, useCallback } from 'react'
import { domToPng } from 'modern-screenshot'

interface UseScreenshotOptions {
  filename?: string
  quality?: number
  scale?: number
  backgroundColor?: string
}

interface UseScreenshotReturn {
  captureScreenshot: (element: HTMLElement, options?: UseScreenshotOptions) => Promise<string>
  isCapturing: boolean
  error: string | null
}

export function useScreenshot(): UseScreenshotReturn {
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const captureScreenshot = useCallback(async (
    element: HTMLElement,
    options: UseScreenshotOptions = {}
  ): Promise<string> => {
    setIsCapturing(true)
    setError(null)

    try {
      const {
        filename,
        quality = 0.95,
        scale = 2,
        backgroundColor = '#ffffff'
      } = options

      // Generate filename if not provided
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const finalFilename = filename || `screenshot_${timestamp}.png`

      // Configure screenshot options
      const screenshotOptions = {
        quality,
        scale,
        backgroundColor,
        style: {
          backgroundColor,
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      }

      // Capture the screenshot
      const dataUrl = await domToPng(element, screenshotOptions)

      // Convert data URL to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = finalFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      window.URL.revokeObjectURL(url)

      return dataUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture screenshot'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsCapturing(false)
    }
  }, [])

  return {
    captureScreenshot,
    isCapturing,
    error
  }
}