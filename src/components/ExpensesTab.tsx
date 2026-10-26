import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent, type DragStartEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { reorderExpenses } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { formatKRW } from '../lib/settlement'
import type { Expense, Group, Member } from '../types'
import ExpenseForm from './ExpenseForm'
import { button, card } from './ui/styles'

interface Props {
  meetingId: string
  members: Member[]
  expenses: Expense[]
  groups?: Group[]
  onChanged: () => void
  onReordered: (expenses: Expense[]) => void
  goMembers: () => void
}

export default function ExpensesTab({
  meetingId,
  members,
  expenses,
  groups = [],
  onChanged,
  onReordered,
  goMembers,
}: Props) {
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [orderedExpenses, setOrderedExpenses] = useState(expenses)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  useEffect(() => setOrderedExpenses(expenses), [expenses])
  const nameOf = useMemo(
    () => new Map(members.map((m) => [m.id, m.name])),
    [members],
  )

  if (members.length === 0) {
    return (
      <main className="grid min-h-0 flex-1 place-items-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="m-0 text-ink">참석자가 없어 지출을 기록할 수 없어요.</p>
          <button type="button" className={button.primary} onClick={goMembers}>참석자 추가하러 가기</button>
        </div>
      </main>
    )
  }

  const total = orderedExpenses.reduce((sum, e) => sum + e.amount, 0)
  const titleOf = (id: UniqueIdentifier) => orderedExpenses.find((expense) => expense.id === id)?.title ?? '지출'
  const positionOf = (id: UniqueIdentifier) => orderedExpenses.findIndex((expense) => expense.id === id) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${titleOf(active.id)} 지출을 들었어요. 현재 ${positionOf(active.id)}번째입니다.`,
    onDragOver: ({ active, over }) => over ? `${titleOf(active.id)} 지출이 ${positionOf(over.id)}번째 자리로 이동합니다.` : `${titleOf(active.id)} 지출이 목록 밖에 있어요.`,
    onDragEnd: ({ active, over }) => over ? `${titleOf(active.id)} 지출을 ${positionOf(over.id)}번째 자리에 놓았어요.` : `${titleOf(active.id)} 지출을 원래 자리에 두었어요.`,
    onDragCancel: ({ active }) => `이동을 취소했어요. ${titleOf(active.id)} 지출은 원래 자리에 있어요.`,
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = orderedExpenses.findIndex((expense) => expense.id === active.id)
    const to = orderedExpenses.findIndex((expense) => expense.id === over.id)
    const previous = orderedExpenses
    const next = arrayMove(orderedExpenses, from, to)
    setOrderedExpenses(next)
    try {
      await reorderExpenses(next)
      onReordered(next)
    } catch (error) {
      setOrderedExpenses(previous)
      toast.error(`순서를 저장하지 못해 원래대로 되돌렸어요. ${errorMessage(error)}`)
    }
  }

  const activeExpense = activeId ? orderedExpenses.find((expense) => expense.id === activeId) : undefined

  return (
    <>
      <main className="scroll-quiet min-h-0 flex-1 px-4 py-4 lg:px-8">
        {orderedExpenses.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="m-0 text-center text-ink">아직 지출 기록이 없어요.<br /><span className="text-sm text-muted">아래 지출 추가 버튼으로 첫 지출을 기록하세요.</span></p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{ announcements, screenReaderInstructions: { draggable: '스페이스나 엔터로 지출을 들고, 위아래 방향키로 옮긴 뒤 다시 스페이스나 엔터로 놓으세요. ESC를 누르면 취소됩니다.' } }}
            onDragStart={(event: DragStartEvent) => setActiveId(event.active.id)}
            onDragCancel={() => setActiveId(null)}
            onDragEnd={(event) => void handleDragEnd(event)}
          >
            <SortableContext items={orderedExpenses.map((expense) => expense.id)} strategy={verticalListSortingStrategy}>
              <ul className="m-0 flex max-w-3xl list-none flex-col gap-2.5 p-0">
                {orderedExpenses.map((e) => (
                  <SortableExpense key={e.id} id={e.id} title={e.title}>
                    <ExpenseCard expense={e} payerName={nameOf.get(e.payer_id) ?? '알 수 없음'} onClick={() => setEditing(e)} />
                  </SortableExpense>
                ))}
              </ul>
            </SortableContext>
            {/* 드래그 중인 카드는 떠 있는 사본으로 보여주고, 원래 자리는 놓일 위치를 표시하는 빈칸으로 남긴다. */}
            <DragOverlay>
              {activeExpense ? <div className="flex items-stretch gap-1.5">
                <span className="grid w-9 place-items-center text-accent"><GripVertical size={20} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1 rotate-1 shadow-xl"><ExpenseCard expense={activeExpense} payerName={nameOf.get(activeExpense.payer_id) ?? '알 수 없음'} /></div>
              </div> : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <div className="flex flex-none items-center gap-3 border-t border-line bg-bg px-4 py-3 lg:px-8">
        <div className="flex min-w-0 flex-1 max-w-3xl items-center justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="text-sm text-muted">총 지출</span>
            <strong className="truncate text-lg text-ink">{formatKRW(total)}</strong>
          </span>
          <button type="button" className={button.primary} onClick={() => setEditing('new')}><Plus size={18} aria-hidden="true" />지출 추가</button>
        </div>
      </div>

      {editing && (
        <ExpenseForm
          meetingId={meetingId}
          members={members}
          groups={groups}
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}

function ExpenseCard({ expense, payerName, onClick }: { expense: Expense; payerName: string; onClick?: () => void }) {
  const hasCustom = expense.expense_shares.some((s) => s.amount != null)
  return <button type="button" className={`${card} flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:border-accent/30 focus-visible:outline-2 focus-visible:outline-focus`} onClick={onClick} tabIndex={onClick ? undefined : -1}>
    <span className="flex w-full items-start justify-between gap-3">
      <span className="min-w-0 font-bold break-words text-ink">{expense.title}</span>
      <span className="shrink-0 font-bold whitespace-nowrap text-ink">{formatKRW(expense.amount)}</span>
    </span>
    <span className="flex w-full justify-between gap-3 text-sm text-muted">
      <span className="truncate">{payerName} 결제</span>
      <span className="shrink-0">{expense.expense_shares.length}명 참여{hasCustom && ', 금액 지정'}</span>
    </span>
  </button>
}

function SortableExpense({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="relative">
    <div className={`flex items-stretch gap-1.5 ${isDragging ? 'opacity-0' : ''}`}>
      <button type="button" className="grid w-9 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted hover:bg-subtle hover:text-accent focus-visible:outline-2 focus-visible:outline-focus active:cursor-grabbing" aria-label={`${title} 순서 변경`} {...attributes} {...listeners}>
        <GripVertical size={20} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
    {/* 놓일 자리 표시 */}
    {isDragging && <div className="absolute inset-0 ml-[2.625rem] rounded-2xl border-2 border-dashed border-focus/60 bg-accent-soft/50" aria-hidden="true" />}
  </li>
}
