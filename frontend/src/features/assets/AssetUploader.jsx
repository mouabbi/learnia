/**
 * AssetUploader — drag-and-drop (or click-to-browse) upload zone for a
 * course's assets. Self-contained: calls assetsApi.uploadAsset itself and
 * reports back through callbacks, so the caller doesn't need to manage
 * upload state — only react to the result.
 *
 * Props:
 *   - courseId (string|number, required): course the uploaded file(s)
 *     belong to.
 *   - onUploaded (asset) => void, optional: called once per successfully
 *     uploaded asset (same shape as AssetPicker's onSelect(asset)).
 *   - onError (error) => void, optional: called if an upload fails (an
 *     ApiError from api/client.js, e.g. VALIDATION_ERROR for a
 *     disallowed mime type or oversized file).
 *   - accept (string, optional): passed straight through to the hidden
 *     `<input type="file" accept=...>`, e.g. "image/*,video/mp4".
 *   - multiple (boolean, optional, default true): allow selecting/dropping
 *     more than one file at once — each is uploaded as its own request.
 *
 * Renders its own progress row per in-flight file; doesn't assume a
 * parent list is showing anything (pair it with AssetPicker, which
 * re-fetches when the parent chooses to remount/refresh it after
 * onUploaded fires).
 */

import { useCallback, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { UploadCloud, CheckCircle2, XCircle } from 'lucide-react'
import { assetsApi } from './assetsApi'

export function AssetUploader({ courseId, onUploaded, onError, accept, multiple = true }) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState([]) // [{ id, name, status: 'uploading'|'done'|'error' }]
  const inputRef = useRef(null)
  const inputId = useId()

  const uploadFiles = useCallback(
    (files) => {
      Array.from(files).forEach((file) => {
        const uploadId = `${file.name}-${Date.now()}-${Math.random()}`
        setUploads((prev) => [...prev, { id: uploadId, name: file.name, status: 'uploading' }])

        assetsApi
          .uploadAsset(courseId, file)
          .then((asset) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === uploadId ? { ...u, status: 'done' } : u)),
            )
            onUploaded?.(asset)
          })
          .catch((err) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === uploadId ? { ...u, status: 'error' } : u)),
            )
            onError?.(err)
          })
      })
    },
    [courseId, onUploaded, onError],
  )

  return (
    <div className="asset-uploader">
      <label
        htmlFor={inputId}
        className={`asset-uploader-dropzone${isDragging ? ' asset-uploader-dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
        }}
      >
        <UploadCloud aria-hidden="true" size={24} />
        <span>Drag files here, or click to browse</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="asset-uploader-input"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files)
            e.target.value = '' // allow re-selecting the same file again
          }}
        />
      </label>

      <ul className="asset-uploader-list">
        <AnimatePresence>
          {uploads.map((u) => (
            <motion.li
              key={u.id}
              className={`asset-uploader-row asset-uploader-row-${u.status}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
            >
              {u.status === 'uploading' && <span className="asset-uploader-spinner" aria-hidden="true" />}
              {u.status === 'done' && <CheckCircle2 aria-hidden="true" size={16} />}
              {u.status === 'error' && <XCircle aria-hidden="true" size={16} />}
              <span className="asset-uploader-filename">{u.name}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
