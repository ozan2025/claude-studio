import { useState, useCallback, useRef, useEffect } from 'react'
import type { ClaudeStatus } from '@shared/types'
import FileAutocomplete from './FileAutocomplete'
import SlashCommandAutocomplete from './SlashCommandAutocomplete'
import ImagePreview from './ImagePreview'
import { useFileAutocomplete } from '@renderer/hooks/useFileAutocomplete'
import { useSlashCommands } from '@renderer/hooks/useSlashCommands'
import { useImagePaste } from '@renderer/hooks/useImagePaste'

interface InputAreaProps {
  onSend: (text: string, images?: Array<{ base64: string; mediaType: string }>) => void
  onCommand: (command: string) => void
  onInterrupt: () => void
  status: ClaudeStatus
  disabled: boolean
}

export default function InputArea({
  onSend,
  onCommand,
  onInterrupt,
  status,
  disabled,
}: InputAreaProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const {
    visible: fileAutocompleteVisible,
    query: fileAutocompleteQuery,
    selectedIndex: fileSelectedIndex,
    position: fileAutocompletePosition,
    allFiles,
    handleInputChange: handleFileInputChange,
    moveSelection: moveFileSelection,
    getSelectedFile,
    close: closeFileAutocomplete,
  } = useFileAutocomplete()

  const {
    visible: slashVisible,
    filtered: slashFiltered,
    selectedIndex: slashSelectedIndex,
    checkForSlash,
    moveSelection: moveSlashSelection,
    getSelectedCommand,
    close: closeSlash,
  } = useSlashCommands()

  const { images, handlePaste, removeImage, clearImages } = useImagePaste()

  const isProcessing = status === 'thinking' || status === 'tool_executing'

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && images.length === 0) return
    // Route slash commands through onCommand for expansion
    if (trimmed.startsWith('/') && !trimmed.includes(' ')) {
      onCommand(trimmed)
    } else if (images.length > 0) {
      // Convert dataUrl images to base64 payloads
      const imagePayloads = images.map((img) => {
        const [header, data] = img.dataUrl.split(',')
        const mediaType = header.match(/data:(.*?);/)?.[1] ?? 'image/png'
        return { base64: data, mediaType }
      })
      onSend(trimmed, imagePayloads)
    } else {
      onSend(trimmed)
    }
    setText('')
    clearImages()
    closeSlash()
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, images, onSend, onCommand, clearImages, closeSlash])

  const insertSlashCommand = useCallback(
    (command: string) => {
      setText(command + ' ')
      closeSlash()
      textareaRef.current?.focus()
    },
    [closeSlash],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle slash command autocomplete navigation
      if (slashVisible) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          moveSlashSelection('down')
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveSlashSelection('up')
          return
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault()
          const selected = getSelectedCommand()
          if (selected) {
            // If Enter, execute the command via onCommand
            if (e.key === 'Enter') {
              onCommand(selected.command)
              setText('')
              closeSlash()
              return
            }
            // Tab inserts the command text
            insertSlashCommand(selected.command)
          }
          return
        }
        if (e.key === 'Escape') {
          closeSlash()
          return
        }
      }

      // Handle file autocomplete navigation
      if (fileAutocompleteVisible) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          moveFileSelection('down')
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveFileSelection('up')
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          const selected = getSelectedFile()
          if (selected) {
            insertFileAtCursor(selected)
          }
          closeFileAutocomplete()
          return
        }
        if (e.key === 'Escape') {
          closeFileAutocomplete()
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (isProcessing) {
          onInterrupt()
        } else {
          handleSubmit()
        }
      }
    },
    [
      slashVisible,
      fileAutocompleteVisible,
      handleSubmit,
      isProcessing,
      onInterrupt,
      onSend,
      moveSlashSelection,
      moveFileSelection,
      getSelectedCommand,
      getSelectedFile,
      insertSlashCommand,
      closeSlash,
      closeFileAutocomplete,
    ],
  )

  const insertFileAtCursor = useCallback(
    (filePath: string) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const cursorPos = textarea.selectionStart
      const beforeCursor = text.slice(0, cursorPos)
      const afterCursor = text.slice(cursorPos)

      const atIdx = beforeCursor.lastIndexOf('@')
      if (atIdx === -1) return

      const newText = beforeCursor.slice(0, atIdx) + filePath + ' ' + afterCursor
      setText(newText)

      const newCursorPos = atIdx + filePath.length + 1
      setTimeout(() => {
        textarea.selectionStart = newCursorPos
        textarea.selectionEnd = newCursorPos
      }, 0)
    },
    [text],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setText(value)

      // Auto-resize
      const el = e.target
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 200) + 'px'

      const cursorPos = el.selectionStart

      // Check for / slash commands (only at start of input)
      checkForSlash(value, cursorPos)

      // Check for @ file autocomplete
      const rect = el.getBoundingClientRect()
      handleFileInputChange(value, cursorPos, rect)
    },
    [handleFileInputChange, checkForSlash],
  )

  // Focus textarea on mount and when status changes to idle
  useEffect(() => {
    if (status === 'idle' || status === 'disconnected') {
      textareaRef.current?.focus()
    }
  }, [status])

  return (
    <div className="border-t border-gray-200 bg-white flex-shrink-0 relative">
      <ImagePreview images={images} onRemove={removeImage} />

      <div className="p-2">
        <div className="flex gap-2 relative">
          <FileAutocomplete
            query={fileAutocompleteQuery}
            files={allFiles}
            visible={fileAutocompleteVisible}
            position={fileAutocompletePosition}
            selectedIndex={fileSelectedIndex}
            onSelect={(path) => {
              insertFileAtCursor(path)
              closeFileAutocomplete()
            }}
            onClose={closeFileAutocomplete}
          />

          <SlashCommandAutocomplete
            commands={slashFiltered}
            visible={slashVisible && !fileAutocompleteVisible}
            selectedIndex={slashSelectedIndex}
            onSelect={(cmd) => {
              onCommand(cmd)
              setText('')
              closeSlash()
            }}
            onClose={closeSlash}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            placeholder={
              isProcessing
                ? 'Press Enter to interrupt...'
                : 'Message Claude... (/ for commands, @ for files)'
            }
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-400 disabled:bg-gray-100 disabled:text-gray-500 min-h-[36px] max-h-[200px]"
            rows={1}
          />
          <button
            onClick={isProcessing ? onInterrupt : handleSubmit}
            disabled={disabled || (!isProcessing && !text.trim() && images.length === 0)}
            className={`px-3 py-2 text-sm font-medium rounded-lg flex-shrink-0 transition-colors ${
              isProcessing
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500'
            }`}
          >
            {isProcessing ? 'Stop' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
