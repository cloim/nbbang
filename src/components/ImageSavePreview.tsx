import { Download, ExternalLink } from 'lucide-react'
import { Modal } from './Modal/Modal'
import { button } from './ui/styles'

export interface PreviewImage {
  filename: string
  url: string
  writeFailed?: boolean
}

interface Props {
  image: PreviewImage
  onClose: () => void
}

export default function ImageSavePreview({ image, onClose }: Props) {
  return (
    <Modal
      isOpen
      size="lg"
      title="정산 이미지 저장"
      onClose={onClose}
      footer={<>
        <a className={button.ghost} href={image.url} target="_blank" rel="noopener"><ExternalLink size={17} aria-hidden="true" />새 탭에서 열기</a>
        <a className={button.primary} href={image.url} download={image.filename}><Download size={17} aria-hidden="true" />PNG 저장</a>
      </>}
    >
      <div className="flex flex-col gap-3">
        {image.writeFailed && (
          <p className="m-0 rounded-xl bg-warn-bg px-3 py-2 text-sm text-ink" role="status">
            선택한 위치에 파일을 저장하지 못했어요. 아래 PNG 저장 버튼을 이용하거나 이미지를 길게 눌러 저장하세요.
          </p>
        )}
        <p className="m-0 text-sm text-muted">
          PNG 저장 버튼으로 받거나, 이미지를 마우스 오른쪽 버튼(모바일은 길게 누르기)으로 저장하세요.
          저장이 막히면 엔빵을 외부 브라우저에서 열어 다시 시도하세요.
        </p>
        <img className="block h-auto w-full rounded-xl border border-line" src={image.url} alt="정산 결과 이미지" />
      </div>
    </Modal>
  )
}
