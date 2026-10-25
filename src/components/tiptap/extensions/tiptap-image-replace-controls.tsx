"use client"

import { useId, type ChangeEvent, type RefObject } from "react"
import { ImageIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type TiptapImageReplaceControlsProps = {
  fileInputRef: RefObject<HTMLInputElement | null>
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
  error: string | null | undefined
  imageUrl: string
  setImageUrl: (value: string) => void
  altText: string
  setAltText: (value: string) => void
  handleImageUrlSubmit: () => void
  saveAltText: () => void
}

export function TiptapImageReplaceControls({
  fileInputRef,
  handleFileChange,
  uploading,
  error,
  imageUrl,
  setImageUrl,
  altText,
  setAltText,
  handleImageUrlSubmit,
  saveAltText,
}: TiptapImageReplaceControlsProps) {
  const id = useId()
  const altId = `${id}-alt`
  const uploadId = `${id}-upload`
  const urlId = `${id}-url`
  const helpId = `${id}-alt-help`
  const errorId = `${id}-upload-error`
  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
          <ImageIcon className="mr-2 size-4" aria-hidden /> Edit image
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit image</DialogTitle>
          <DialogDescription>Update the image or its text alternative.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium">Upload Image</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              hidden
              id={uploadId}
              aria-label="Upload replacement image"
              aria-describedby={error ? errorId : undefined}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              aria-describedby={error ? errorId : undefined}
              className="h-auto w-full border-2 border-dashed p-4"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4" aria-hidden />
                  <span>Choose Image</span>
                </>
              )}
            </Button>
            {error && <p id={errorId} role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <div>
            <label htmlFor={urlId} className="mb-2 block text-xs font-medium">Image URL</label>
            <div className="space-y-2">
              <Input
                id={urlId}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Enter image URL..."
                className="h-11 text-base sm:h-9 sm:text-sm"
              />
              <Button
                type="button"
                onClick={handleImageUrlSubmit}
                className="min-h-11 w-full sm:min-h-8"
                disabled={!imageUrl}
                size="sm"
              >
                Replace with URL
              </Button>
            </div>
          </div>

          <div>
            <label htmlFor={altId} className="mb-2 block text-xs font-medium">Alt text</label>
            <Input
              id={altId}
              aria-describedby={helpId}
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the image"
              className="h-11 text-base sm:h-9 sm:text-sm"
            />
            <p id={helpId} className="mt-1 text-xs text-muted-foreground">Leave blank only for decorative images.</p>
            <Button type="button" size="sm" className="mt-2 min-h-11 w-full sm:min-h-8" onClick={saveAltText}>Save alt text</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
