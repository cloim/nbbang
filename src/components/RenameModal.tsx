import { useId, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Modal } from './Modal/Modal'
import { errorMessage } from '../lib/errors'
import { button, input, label as labelClass } from './ui/styles'

interface Props {
  title: string
  label: string
  initial: string
  maxLength: number
  onSave: (name: string) => Promise<void>
  onClose: () => void
}

export default function RenameModal({ title, label, initial, maxLength, onSave, onClose }: Props) {
  const formId = useId()
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const name = draft.trim()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name || busy) return
    if (name === initial) return onClose()
    setBusy(true)
    try {
      await onSave(name)
      toast.success('이름을 바꿨어요.')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
      setBusy(false)
    }
  }

  return <Modal
    isOpen
    size="sm"
    draggable={false}
    title={title}
    initialFocusRef={inputRef}
    onClose={() => { if (!busy) onClose() }}
    footer={<>
      <button type="button" className={button.ghost} disabled={busy} onClick={onClose}>취소</button>
      <button type="submit" form={formId} className={button.primary} disabled={!name || busy}>{busy ? '저장 중…' : '저장'}</button>
    </>}
  >
    <form id={formId} onSubmit={(event) => void submit(event)}>
      <label className={labelClass}>
        {label}
        <input ref={inputRef} className={input} value={draft} maxLength={maxLength} disabled={busy} onChange={(event) => setDraft(event.target.value)} />
      </label>
    </form>
  </Modal>
}
