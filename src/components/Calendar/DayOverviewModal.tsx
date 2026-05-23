'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { toEcuadorISODate, getLocalNow, forceEcuadorTZ } from '@/lib/date-utils'

interface DayOverviewModalProps {
  isOpen: boolean
  onClose: () => void
  date: Date
  appointments: any[]
  operators: any[]
  initialEditEventId?: number | string | null
  onSave: (data: any) => Promise<void>
  onDelete: (id: number) => Promise<void>
  refreshAppointments: () => Promise<void>
}

export default function DayOverviewModal({
  isOpen,
  onClose,
  date,
  appointments,
  operators = [],
  initialEditEventId = null,
  onSave,
  onDelete,
  refreshAppointments
}: DayOverviewModalProps) {
  const [mounted, setMounted] = useState(false)
  const [filterOperatorId, setFilterOperatorId] = useState<string>('all')
  const [newNoteText, setNewNoteText] = useState('')
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [isDraggingActive, setIsDraggingActive] = useState(false)
  const [priorityInputs, setPriorityInputs] = useState<Record<number, string>>({})
  const [isEditMode, setIsEditMode] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isNoteExpanded, setIsNoteExpanded] = useState(false)

  // Autosave visual states and debounce control
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingChangesCount = useRef<number>(0)

  // Local state for interactive drag and drop sorting
  const [localEvents, setLocalEvents] = useState<any[]>([])
  
  // Reference to store manual pointer drag info without triggering intermediate React re-renders
  const dragInfo = useRef<{
    startIndex: number;
    currentIndex: number;
    startY: number;
    element: HTMLDivElement | null;
    items: HTMLDivElement[];
  }>({
    startIndex: -1,
    currentIndex: -1,
    startY: 0,
    element: null,
    items: []
  });

  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Pre-select operator in form when filter changes
  useEffect(() => {
    if (filterOperatorId !== 'all') {
      setSelectedOperatorIds([Number(filterOperatorId)])
    } else {
      setSelectedOperatorIds([])
    }
    setEditingNoteId(null)
    setNewNoteText('')
  }, [filterOperatorId])

  // Start Note Editing Flow
  const handleStartEdit = (event: any) => {
    setEditingNoteId(event.id)
    setNewNoteText(event.description || '')
    
    let opIds: number[] = []
    if (event.assignedUsers) {
      const parsed = typeof event.assignedUsers === 'string' ? JSON.parse(event.assignedUsers) : event.assignedUsers
      opIds = parsed.map((u: any) => u.id)
    } else if (event.userId) {
      opIds = [event.userId]
    }
    setSelectedOperatorIds(opIds)
  }

  useEffect(() => {
    if (isOpen) {
      if (initialEditEventId) {
        const eventToEdit = appointments.find(e => e.id === initialEditEventId || e.id === Number(initialEditEventId))
        if (eventToEdit) {
          handleStartEdit(eventToEdit)
        }
      } else {
        setEditingNoteId(null)
        setNewNoteText('')
        setSelectedOperatorIds([])
      }
    }
  }, [isOpen, initialEditEventId, appointments])

  const dayStr = toEcuadorISODate(date)
  
  // Format long date for header
  const formattedDate = date.toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  // Get all events for the current day
  const allDayEvents = useMemo(() => {
    return appointments.filter(e => toEcuadorISODate(e.startTime) === dayStr)
  }, [appointments, dayStr])

  // Sort events by priority (description string containing number)
  const allSortedEvents = useMemo(() => {
    return [...allDayEvents].sort((a, b) => {
      const prioA = parseInt(a.title || '999999', 10)
      const prioB = parseInt(b.title || '999999', 10)
      if (isNaN(prioA) && isNaN(prioB)) {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      }
      if (isNaN(prioA)) return 1
      if (isNaN(prioB)) return -1
      return prioA - prioB
    })
  }, [allDayEvents])

  // Get dayEvents (shows all sorted events of the day)
  const dayEvents = allSortedEvents

  // Filter sorted events by operator
  const visibleEvents = useMemo(() => {
    return dayEvents.filter(e => {
      if (filterOperatorId === 'all') return true
      const opId = Number(filterOperatorId)
      if (e.assignedUsers) {
        const parsed = typeof e.assignedUsers === 'string' ? JSON.parse(e.assignedUsers) : e.assignedUsers
        return parsed.some((u: any) => u.id === opId)
      }
      return e.userId === opId
    })
  }, [dayEvents, filterOperatorId])

  // Sync localEvents state whenever visibleEvents changes, but protect optimistic UI state during active autosave
  useEffect(() => {
    if (autosaveStatus === 'idle' && pendingChangesCount.current === 0) {
      setLocalEvents(visibleEvents)
    }
  }, [visibleEvents, autosaveStatus])

  if (!isOpen || !mounted) return null

  // Calculate task counts for each operator for dropdown label
  const getOperatorTaskCount = (opId: number) => {
    return allSortedEvents.filter(e => {
      if (e.assignedUsers) {
        const parsed = typeof e.assignedUsers === 'string' ? JSON.parse(e.assignedUsers) : e.assignedUsers
        return parsed.some((u: any) => u.id === opId)
      }
      return e.userId === opId
    }).length
  }

  // --- PRIORITY INPUT HANDLERS ---
  const handlePriorityInputChange = (eventId: number, val: string) => {
    setPriorityInputs(prev => ({ ...prev, [eventId]: val }))
    const num = parseInt(val, 10)
    if (isNaN(num) || num < 1 || num > allSortedEvents.length) return
    commitPriorityChange(eventId, val)
  }

  const commitPriorityChange = async (eventId: number, rawValue: string) => {
    const newPriority = parseInt(rawValue, 10)
    if (isNaN(newPriority) || newPriority < 1) return

    const currentIndex = allSortedEvents.findIndex(ev => ev.id === eventId)
    if (currentIndex === -1) return

    const clamped = Math.min(newPriority - 1, allSortedEvents.length - 1)
    if (clamped === currentIndex) return

    const reorderedGlobal = [...allSortedEvents]
    const [moved] = reorderedGlobal.splice(currentIndex, 1)
    reorderedGlobal.splice(clamped, 0, moved)

    // Calculate optimistically the new visible list
    const opId = filterOperatorId === 'all' ? null : Number(filterOperatorId)
    const newVisible = reorderedGlobal.filter(e => {
      if (filterOperatorId === 'all') return true
      if (e.assignedUsers) {
        const parsed = typeof e.assignedUsers === 'string' ? JSON.parse(e.assignedUsers) : e.assignedUsers
        return parsed.some((u: any) => u.id === opId)
      }
      return e.userId === opId
    })
    setLocalEvents(newVisible)

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    setAutosaveStatus('idle')
    pendingChangesCount.current += 1

    autosaveTimerRef.current = setTimeout(async () => {
      setAutosaveStatus('saving')
      try {
        const payload = reorderedGlobal.map((ev, idx) => ({ id: ev.id, priority: (idx + 1).toString() }))
        const res = await fetch('/api/appointments/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: payload })
        })
        if (!res.ok) throw new Error('Error al reordenar')
        setAutosaveStatus('saved')
        pendingChangesCount.current = 0
        await refreshAppointments()
        setTimeout(() => setAutosaveStatus(prev => prev === 'saved' ? 'idle' : prev), 1500)
      } catch (err) {
        console.error('Error saving priority:', err)
        setAutosaveStatus('idle')
      }
    }, 800)
  }

  // --- MANUAL POINTER EVENT DRAG AND DROP HANDLERS (Infinitely robust on all devices) ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (loading) return
    // Block drag entirely when edit mode is off
    if (!isEditMode) return
    // Block drag if the click target is the priority input
    if ((e.target as HTMLElement).classList.contains('priority-input-inline')) return
    if (e.button !== 0) return // Only left click

    const card = e.currentTarget.closest('.note-item-card') as HTMLDivElement
    if (!card) return
    const container = card.parentElement as HTMLDivElement
    if (!container) return

    // Capture the pointer to receive move/up events even if cursor leaves card bounds
    card.setPointerCapture(e.pointerId)

    // Capture all card elements in order
    const childCards = Array.from(container.children).filter(
      child => child.classList.contains('note-item-card')
    ) as HTMLDivElement[]

    dragInfo.current = {
      startIndex: index,
      currentIndex: index,
      startY: e.clientY,
      element: card,
      items: childCards
    }

    card.style.zIndex = '1000'
    card.style.cursor = 'grabbing'
    card.style.transition = 'none'
    card.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.45), 0 0 20px rgba(88, 199, 255, 0.25)'
    card.style.borderColor = '#58c7ff'
    card.classList.add('is-dragging-manual')

    setIsDraggingActive(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragInfo.current
    if (!drag.element || drag.startIndex === -1) return

    e.preventDefault()
    const deltaY = e.clientY - drag.startY
    drag.element.style.transform = `translateY(${deltaY}px)`

    const draggedRect = drag.element.getBoundingClientRect()
    const draggedMiddleY = draggedRect.top + draggedRect.height / 2

    let targetIndex = drag.startIndex

    // Find current drag target index by finding which card middle Y bounds our dragged card middle is over
    for (let i = 0; i < drag.items.length; i++) {
      if (i === drag.startIndex) continue
      const itemRect = drag.items[i].getBoundingClientRect()

      if (draggedMiddleY > itemRect.top && draggedMiddleY < itemRect.bottom) {
        targetIndex = i
        break
      }
    }

    // Shift neighbor elements temporarily to create visual slot
    if (targetIndex !== drag.currentIndex) {
      drag.currentIndex = targetIndex

      drag.items.forEach((item, idx) => {
        if (idx === drag.startIndex) return

        let offset = 0
        const draggedHeight = drag.items[drag.startIndex].getBoundingClientRect().height + 6 // Height + gap

        if (drag.startIndex < targetIndex) {
          // Dragging downwards: move items below start but above target up
          if (idx > drag.startIndex && idx <= targetIndex) {
            offset = -draggedHeight
          }
        } else {
          // Dragging upwards: move items above start but below target down
          if (idx >= targetIndex && idx < drag.startIndex) {
            offset = draggedHeight
          }
        }

        item.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        item.style.transform = `translateY(${offset}px)`
      });
    }
  }

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragInfo.current
    if (!drag.element || drag.startIndex === -1) {
      setIsDraggingActive(false)
      return
    }

    drag.element.releasePointerCapture(e.pointerId)

    const finalStartIndex = drag.startIndex
    const finalTargetIndex = drag.currentIndex

    // Clean inline transforms and visual cues
    drag.items.forEach(item => {
      item.style.transform = ''
      item.style.transition = ''
      item.style.zIndex = ''
      item.style.cursor = ''
      item.style.boxShadow = ''
      item.style.borderColor = ''
      item.classList.remove('is-dragging-manual')
    })

    dragInfo.current = {
      startIndex: -1,
      currentIndex: -1,
      startY: 0,
      element: null,
      items: []
    }

    setIsDraggingActive(false)

    // Evaluate click action (if user barely moved pointer, e.g. < 4px, trigger edit modal)
    const deltaY = Math.abs(e.clientY - drag.startY)
    if (deltaY < 4) {
      const clickedEvent = localEvents[finalStartIndex]
      if (clickedEvent) {
        handleStartEdit(clickedEvent)
      }
      return
    }

    // Persist reorder if target index changed
    if (finalTargetIndex !== finalStartIndex) {
      const reorderedLocal = [...localEvents]
      const [draggedItem] = reorderedLocal.splice(finalStartIndex, 1)
      reorderedLocal.splice(finalTargetIndex, 0, draggedItem)

      // 1. ACTUALIZAR EN CALIENTE EL FRONTEND (OPTIMISTA)
      setLocalEvents(reorderedLocal)

      // Map the localEvents' positions back to the global allSortedEvents array
      const visibleIndicesGlobal = localEvents.map(ev => 
        allSortedEvents.findIndex(globalEv => globalEv.id === ev.id)
      )

      const reorderedGlobal = [...allSortedEvents]
      visibleIndicesGlobal.forEach((globalIdx, localIdx) => {
        if (globalIdx !== -1) {
          reorderedGlobal[globalIdx] = reorderedLocal[localIdx]
        }
      })
      
      // 2. CONTROL DE DEBOUNCE
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }

      setAutosaveStatus('idle')
      pendingChangesCount.current += 1 // Incrementamos cambios en cola

      // 3. PROGRAMAR AUTOSAVE
      autosaveTimerRef.current = setTimeout(async () => {
        setAutosaveStatus('saving')
        
        try {
          const payload = reorderedGlobal.map((event, idx) => ({
            id: event.id,
            priority: (idx + 1).toString()
          }))

          const res = await fetch('/api/appointments/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders: payload })
          })

          if (!res.ok) throw new Error('Error al reordenar en base de datos')

          // Guardado exitoso de fondo
          setAutosaveStatus('saved')
          pendingChangesCount.current = 0 // Cola vacía

          // Solo refrescar la vista general si no hay nuevos arrastres en el ínterin
          await refreshAppointments()

          setTimeout(() => {
            setAutosaveStatus(prev => prev === 'saved' ? 'idle' : prev)
          }, 1500)

        } catch (err) {
          console.error('Error autosaving drag order:', err)
          setAutosaveStatus('idle')
          alert('Error al guardar el nuevo orden de prioridad en segundo plano')
        }
      }, 1500) // Esperar 1.5s de inactividad antes de guardar
    }
  }



  // Handle Delete Note
  const handleDeleteNote = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta nota?')) return
    setLoading(true)
    try {
      await onDelete(id)
      if (editingNoteId === id) {
        setEditingNoteId(null)
        setNewNoteText('')
        setSelectedOperatorIds([])
      }
      await refreshAppointments()
    } catch (err) {
      console.error('Error deleting note:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle Creating or Updating a Note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteText.trim()) {
      alert('Escribe el contenido de la nota.')
      return
    }
    if (selectedOperatorIds.length === 0) {
      alert('Selecciona al menos un operador.')
      return
    }

    setLoading(true)

    // HH:MM format for Ecuadorian safe time conversions
    const startTimeStr = `${dayStr}T08:00`
    const endTimeStr = `${dayStr}T18:00`

    const payload: any = {
      description: newNoteText.trim(), // Note is stored in description!
      startTime: forceEcuadorTZ(startTimeStr),
      endTime: forceEcuadorTZ(endTimeStr),
      userIds: selectedOperatorIds,
      userId: selectedOperatorIds[0]
    }

    if (editingNoteId) {
      const currentEvent = allSortedEvents.find(e => e.id === editingNoteId)
      if (currentEvent) {
        payload.title = currentEvent.title // Keep original priority title ("1", "2", "3")
      }
    } else {
      payload.title = (allSortedEvents.length + 1).toString() // Next sequential priority preference number
      payload.status = 'PENDIENTE'
    }

    try {
      if (editingNoteId) {
        await onSave({ ...payload, id: editingNoteId })
        setEditingNoteId(null)
      } else {
        await onSave(payload)
      }
      setNewNoteText('')
      if (filterOperatorId === 'all') {
        setSelectedOperatorIds([])
      }
      await refreshAppointments()
    } catch (err) {
      console.error('Error saving note:', err)
      alert('Error al guardar la nota')
    } finally {
      setLoading(false)
    }
  }

  const toggleOperatorSelection = (id: number) => {
    setSelectedOperatorIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAllOperators = () => {
    if (selectedOperatorIds.length === operators.length) {
      setSelectedOperatorIds([])
    } else {
      setSelectedOperatorIds(operators.map(op => op.id))
    }
  }

  return createPortal(
    <div 
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(4, 8, 19, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '24px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="modal-container card day-overview-card" 
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: '980px',
          background: 'linear-gradient(135deg, rgba(13, 19, 33, 0.98), rgba(8, 12, 21, 0.99))',
          border: '1px solid rgba(88, 199, 255, 0.2)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(88, 199, 255, 0.1)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          margin: 'auto'
        }}
      >
        
        {/* HEADER */}
        <div className="modal-header card-header">
          <div className="header-details">
            <h3 className="card-title capitalize-first">Resumen y Agenda Diaria</h3>
            <span className="subtitle-date">{formattedDate}</span>
          </div>
          <button className="btn btn-ghost close-btn" onClick={onClose} type="button">✕</button>
        </div>

        {/* CONTENT BODY */}
        <div className={`modal-scroll day-overview-body-grid ${isMaximized ? 'is-maximized-layout' : ''}`}>
          
          {/* COLUMN LEFT: LIST & FILTER */}
          <div className="column-left-list">
            
            {/* OPERATOR FILTER DROPDOWN */}
            <div className="filter-section">
              <label className="form-label-aquatech">Filtrar por Operador:</label>
              <select
                className="form-select-aquatech"
                value={filterOperatorId}
                onChange={e => setFilterOperatorId(e.target.value)}
              >
                <option value="all">Todos los operadores ({allSortedEvents.length} notas)</option>
                {operators.map(op => {
                  const count = getOperatorTaskCount(op.id)
                  return (
                    <option key={op.id} value={op.id}>
                      {op.name} ({count} {count === 1 ? 'nota' : 'notas'})
                    </option>
                  )
                })}
              </select>
            </div>

            {/* LIST OF NOTES */}
            <div className={`notes-list-section ${isMaximized ? 'notes-maximized' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '6px', flexWrap: 'wrap' }}>
                <h4 className="section-title notes-section-heading" style={{ margin: 0 }}>
                  {filterOperatorId === 'all' 
                    ? 'Notas del Día' 
                    : `Notas de ${operators.find(op => op.id === Number(filterOperatorId))?.name}`
                  }
                </h4>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {/* Edit Mode Toggle */}
                  <button
                    type="button"
                    className={`edit-mode-toggle-btn ${isEditMode ? 'is-active' : ''}`}
                    onClick={() => setIsEditMode(prev => !prev)}
                    title={isEditMode ? 'Bloquear edición' : 'Desbloquear para editar/arrastrar'}
                  >
                    {isEditMode ? '🔓 Editar' : '🔒 Bloqueado'}
                  </button>

                  {/* Maximize Toggle */}
                  <button
                    type="button"
                    className="maximize-toggle-btn"
                    onClick={() => setIsMaximized(prev => !prev)}
                    title={isMaximized ? 'Ver Formulario' : 'Expandir Lista (Ocultar formulario)'}
                    style={{ fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}
                  >
                    {isMaximized ? '🔍 Formulario' : '🔍 Expandir'}
                  </button>

                  {/* Micro-loader de Autosave de fondo */}
                  {autosaveStatus !== 'idle' && (
                    <div className="autosave-badge" style={{ 
                      fontWeight: 700, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      backgroundColor: autosaveStatus === 'saving' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(37, 211, 102, 0.15)',
                      color: autosaveStatus === 'saving' ? '#f59e0b' : '#25d366',
                      border: autosaveStatus === 'saving' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(37, 211, 102, 0.3)',
                      transition: 'all 0.3s ease',
                      whiteSpace: 'nowrap'
                    }}>
                      <span className="autosave-text">{autosaveStatus === 'saving' ? '⏳ Guardando...' : '💾 Guardado'}</span>
                    </div>
                  )}
                </div>
              </div>

              {localEvents.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📝</span>
                  <p>No hay notas registradas para este operario hoy.</p>
                </div>
              ) : (
                <div className={`notes-vertical-list ${isDraggingActive ? 'is-dragging-active' : ''} ${!isEditMode ? 'edit-locked' : ''}`}>
                  {localEvents.map((event, idx) => {
                    // Get assigned operator names
                    let opNames: string[] = []
                    if (event.assignedUsers) {
                      const parsed = typeof event.assignedUsers === 'string' ? JSON.parse(event.assignedUsers) : event.assignedUsers
                      opNames = parsed.map((u: any) => u.name)
                    } else {
                      opNames = [event.user?.name || 'Operador']
                    }

                    const isBeingEdited = editingNoteId === event.id

                    return (
                      <div 
                        key={event.id} 
                        className={`note-item-card ${isBeingEdited ? 'is-being-edited' : ''}`}
                        style={{
                          borderLeft: `3px solid ${event.status === 'COMPLETADA' ? '#25d366' : event.status === 'ATRASADA' ? '#ef4444' : '#58c7ff'}`,
                          touchAction: 'pan-y'
                        }}
                        onPointerMove={isEditMode ? handlePointerMove : undefined}
                        onPointerUp={isEditMode ? handlePointerUp : undefined}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (
                            target.closest('.drag-handle-indicator') || 
                            target.closest('.delete-note-btn') || 
                            target.closest('.priority-input-inline')
                          ) {
                            return;
                          }
                          handleStartEdit(event);
                        }}
                      >
                        {/* Drag handle — only interactive in edit mode */}
                        <div 
                          className={`drag-handle-indicator ${!isEditMode ? 'drag-disabled' : ''}`} 
                          title={isEditMode ? 'Arrastrar para ordenar' : 'Activa modo edición para arrastrar'}
                          onPointerDown={isEditMode ? (e) => handlePointerDown(e, idx) : undefined}
                          style={{ touchAction: isEditMode ? 'none' : 'auto' }}
                        >
                          ⋮⋮
                        </div>

                        {/* Note text and compact assignees line */}
                        <div className="note-content-area" title="Haz clic para editar">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Always visible inline priority numeric input */}
                            {isEditMode ? (
                              <input
                                className="priority-input-inline"
                                type="number"
                                min={1}
                                max={allSortedEvents.length}
                                value={priorityInputs[event.id] ?? event.title ?? ''}
                                onChange={e => handlePriorityInputChange(event.id, e.target.value)}
                                onPointerDown={e => e.stopPropagation()}
                                onClick={e => e.stopPropagation()}
                                onBlur={() => {
                                  setPriorityInputs(prev => {
                                    const next = { ...prev }
                                    delete next[event.id]
                                    return next
                                  })
                                }}
                                style={{
                                  width: '42px',
                                  height: '22px',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  backgroundColor: 'rgba(88, 199, 255, 0.1)',
                                  color: '#58c7ff',
                                  border: '1px solid rgba(88, 199, 255, 0.3)',
                                  borderRadius: '4px',
                                  textAlign: 'center',
                                  outline: 'none',
                                  flexShrink: 0
                                }}
                              />
                            ) : (
                              <span className="priority-badge-readonly">
                                #{event.title || '?'}
                              </span>
                            )}
                            <p className="note-text">{event.description || '(Sin nota)'}</p>
                          </div>
                          <div className="note-assignees-text">
                            👤 Asignados: {opNames.join(', ')}
                          </div>
                        </div>

                        {/* Delete Action */}
                        <button 
                          type="button" 
                          className="delete-note-btn"
                          onClick={(e) => { e.stopPropagation(); handleDeleteNote(event.id) }}
                          disabled={loading}
                          title="Eliminar Nota"
                        >
                          🗑️
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* COLUMN RIGHT: INTEGRATED CREATION/EDITING FORM */}
          <div className="column-right-form">
            <h4 className="section-title-form">
              {editingNoteId ? '✏️ Ver / Editar Nota' : '➕ Generar Nueva Nota'}
            </h4>
            
            <form onSubmit={handleSaveNote} className="add-note-form">
              <div className="form-group-compact">
                <label className="form-label-aquatech">Nota de Agendamiento:</label>
                <textarea
                  className={`form-input-aquatech note-textarea-premium ${isNoteExpanded ? 'note-textarea-expanded' : ''}`}
                  placeholder="Escribe la nota para la actividad aquí..."
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  rows={isNoteExpanded ? 14 : 4}
                  required
                />
                <button
                  type="button"
                  className="expand-note-btn"
                  onClick={() => setIsNoteExpanded(prev => !prev)}
                >
                  {isNoteExpanded ? '🔼 Contraer nota' : '🔽 Expandir nota'}
                </button>
              </div>

              <div className="form-group-compact">
                <label className="form-label-aquatech">Asignar Operadores:</label>
                <div className="operators-compact-selection">
                  <div className="select-all-row">
                    <label className="op-checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={selectedOperatorIds.length === operators.length} 
                        onChange={toggleAllOperators} 
                      />
                      <span className="op-name-text font-bold">✓ SELECCIONAR TODOS</span>
                    </label>
                  </div>
                  <div className="operators-list-scroll">
                    {operators.map(op => (
                      <label key={op.id} className="op-checkbox-label">
                        <input 
                          type="checkbox" 
                          checked={selectedOperatorIds.includes(op.id)} 
                          onChange={() => toggleOperatorSelection(op.id)} 
                        />
                        <span className="op-name-text">{op.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-actions-row">
                <button 
                  type="submit" 
                  className="btn btn-primary submit-note-btn-premium"
                  disabled={loading || !newNoteText.trim() || selectedOperatorIds.length === 0}
                >
                  {loading ? 'Guardando...' : editingNoteId ? '💾 Actualizar Nota' : '📝 Registrar Actividad'}
                </button>
                {editingNoteId && (
                  <button 
                    type="button" 
                    className="btn btn-secondary cancel-edit-btn"
                    onClick={() => {
                      setEditingNoteId(null)
                      setNewNoteText('')
                      setSelectedOperatorIds([])
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

        </div>

        {/* JSX STYLES */}
        <style jsx>{`
          :global(.modal-overlay) {
            position: fixed !important;
            inset: 0 !important;
            background: rgba(4, 8, 19, 0.8) !important;
            backdrop-filter: blur(12px) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 20000000 !important;
            padding: 24px !important;
            box-sizing: border-box !important;
          }

          :global(.day-overview-card) {
            width: 100% !important;
            max-width: 980px !important;
            background: linear-gradient(135deg, rgba(13, 19, 33, 0.95), rgba(8, 12, 21, 0.98)) !important;
            border: 1px solid rgba(88, 199, 255, 0.15) !important;
            box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 25px rgba(88, 199, 255, 0.05) !important;
            animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            max-height: 85vh !important;
            border-radius: 16px !important;
          }

          /* CONTRAST FIX FOR DROPDOWN OPTIONS */
          .form-select-aquatech option {
            background-color: #0b0f19 !important;
            color: #ffffff !important;
            padding: 8px !important;
          }
          
          .header-details {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .capitalize-first {
            text-transform: capitalize;
            font-weight: 800;
            letter-spacing: -0.2px;
            color: #ffffff;
          }

          .subtitle-date {
            font-size: 0.85rem;
            color: #58c7ff;
            text-transform: capitalize;
            font-weight: 500;
          }

          .day-overview-body-grid {
            padding: 20px 24px 24px 24px;
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 24px;
            flex: 1;
            overflow-y: auto;
          }

          .day-overview-body-grid.is-maximized-layout {
            grid-template-columns: 1fr !important;
          }

          .day-overview-body-grid.is-maximized-layout .column-right-form {
            display: none !important;
          }

          .column-left-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
            min-width: 0;
          }

          .column-right-form {
            background: rgba(255, 255, 255, 0.015);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            height: fit-content;
          }

          .filter-section {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 10px;
            padding: 10px 14px;
            border: 1px solid rgba(255, 255, 255, 0.04);
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .section-title {
            font-size: 0.78rem;
            font-weight: 700;
            color: #58c7ff;
            margin: 0 0 10px 0;
            letter-spacing: 0.8px;
            text-transform: uppercase;
          }

          .section-title-form {
            font-size: 0.85rem;
            font-weight: 800;
            color: #ffffff;
            margin: 0 0 6px 0;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 10px;
          }

          .autosave-badge {
            font-size: 0.65rem;
            flex-shrink: 0;
          }

          .autosave-text {
            font-size: inherit;
          }

          .notes-section-heading {
            flex: 1;
            min-width: 0;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2.5rem 1rem;
            background: rgba(255, 255, 255, 0.01);
            border: 1px dashed rgba(255, 255, 255, 0.06);
            border-radius: 10px;
            text-align: center;
            color: var(--text-muted);
          }

          .empty-icon {
            font-size: 2rem;
            margin-bottom: 10px;
          }

          .empty-state p {
            margin: 0;
            font-size: 0.85rem;
          }

          .notes-vertical-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: 420px;
            overflow-y: auto;
            padding-right: 6px;
          }

          .notes-vertical-list.edit-locked .note-item-card {
            cursor: pointer;
          }

          .notes-maximized .notes-vertical-list {
            max-height: 70vh;
          }

          /* Edit/Maximize toggle buttons */
          .edit-mode-toggle-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.62rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
          }
          .edit-mode-toggle-btn.is-active {
            background: rgba(88, 199, 255, 0.15);
            border-color: rgba(88, 199, 255, 0.4);
            color: #58c7ff;
          }
          .edit-mode-toggle-btn:hover {
            background: rgba(88, 199, 255, 0.1);
            border-color: rgba(88, 199, 255, 0.3);
          }

          .maximize-toggle-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.75rem;
            padding: 3px 7px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .maximize-toggle-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
          }

          /* Read-only priority badge */
          .priority-badge-readonly {
            font-size: 0.68rem;
            font-weight: 800;
            color: #58c7ff;
            background: rgba(88, 199, 255, 0.08);
            border: 1px solid rgba(88, 199, 255, 0.2);
            border-radius: 4px;
            padding: 1px 6px;
            flex-shrink: 0;
            min-width: 22px;
            text-align: center;
          }

          /* Disabled drag handle */
          .drag-handle-indicator.drag-disabled {
            opacity: 0.2;
            cursor: default;
          }

          .notes-vertical-list.is-dragging-active .note-item-card * {
            pointer-events: none !important;
          }

          /* --- NOTE CARD (COMPACT AND HIGH-CONTRAST) --- */
          .note-item-card {
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.035);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 6px 10px;
            gap: 8px;
            transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
            cursor: grab;
          }

          .note-item-card:hover {
            background: rgba(255, 255, 255, 0.08);
            transform: translateX(3px);
            border-color: rgba(88, 199, 255, 0.3);
          }
          
          .note-item-card:active {
            cursor: grabbing;
          }

          .note-item-card.is-being-edited {
            border-color: #58c7ff !important;
            background: rgba(88, 199, 255, 0.08);
          }

          .note-item-card.is-dragging-manual {
            opacity: 0.85;
            background: rgba(13, 19, 33, 0.98) !important;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(88, 199, 255, 0.3) !important;
            border-color: #58c7ff !important;
          }

          /* Drag handle visual */
          .drag-handle-indicator {
            color: rgba(88, 199, 255, 0.4);
            font-weight: bold;
            font-size: 1rem;
            cursor: grab;
            user-select: none;
            padding: 0 4px;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
          }

          .note-content-area {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .note-text {
            margin: 0;
            font-size: 0.78rem;
            font-weight: 500;
            color: #ffffff;
            line-height: 1.35;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .note-assignees-text {
            font-size: 0.65rem;
            color: rgba(88, 199, 255, 0.85);
            font-weight: 600;
          }

          .delete-note-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            font-size: 0.85rem;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .delete-note-btn:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.15);
          }

          /* Form design right side */
          .add-note-form {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .note-textarea-premium {
            resize: none;
            width: 100%;
            height: 180px !important;
            background: rgba(0, 0, 0, 0.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            color: white !important;
            font-size: 0.9rem !important;
            line-height: 1.4 !important;
            transition: all 0.2s ease;
          }

          .note-textarea-premium:focus {
            border-color: #58c7ff !important;
            box-shadow: 0 0 0 2px rgba(88, 199, 255, 0.1) !important;
            outline: none;
          }

          .note-textarea-expanded {
            height: 500px !important;
            min-height: 350px !important;
          }

          .expand-note-btn {
            display: block;
            width: 100%;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.68rem;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
            margin-top: 4px;
          }

          .expand-note-btn:hover {
            background: rgba(88, 199, 255, 0.1);
            border-color: rgba(88, 199, 255, 0.25);
            color: #58c7ff;
          }

          .operators-compact-selection {
            background: rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 6px;
            display: flex;
            flex-direction: column;
          }

          .select-all-row {
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            padding: 6px 8px;
          }

          .operators-list-scroll {
            max-height: 110px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 4px;
          }

          .op-checkbox-label {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            padding: 5px 8px;
            border-radius: 6px;
            transition: all 0.15s ease;
          }

          .op-checkbox-label:hover {
            background: rgba(255, 255, 255, 0.04);
          }

          .op-checkbox-label input {
            cursor: pointer;
            width: 15px;
            height: 15px;
            accent-color: #58c7ff;
          }

          .op-name-text {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.85);
            font-weight: 500;
          }

          .font-bold {
            font-weight: 700;
            color: #58c7ff;
          }

          .form-actions-row {
            display: flex;
            gap: 10px;
          }

          .submit-note-btn-premium {
            flex: 1;
            background: #58c7ff !important;
            color: #000000 !important;
            font-weight: 700 !important;
            border: none !important;
            padding: 14px !important;
            border-radius: 8px !important;
            cursor: pointer !important;
            transition: all 0.25s ease !important;
            text-transform: uppercase;
            font-size: 0.8rem;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 14px rgba(88, 199, 255, 0.2);
          }

          .submit-note-btn-premium:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(88, 199, 255, 0.35);
            filter: brightness(1.05);
          }

          .submit-note-btn-premium:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            box-shadow: none;
          }

          .cancel-edit-btn {
            background: transparent !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 8px !important;
            font-size: 0.8rem !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
          }

          .cancel-edit-btn:hover {
            background: rgba(255, 255, 255, 0.05) !important;
            border-color: rgba(255, 255, 255, 0.4) !important;
          }

          /* Animations */
          @keyframes modalSlideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }

          /* ===== RESPONSIVE LAYOUT FOR TABLETS ===== */
          @media (max-width: 900px) {
            :global(.modal-overlay) {
              padding: 12px !important;
            }
            :global(.day-overview-card) {
              max-height: 95vh !important;
              width: 100% !important;
              margin: 0 auto !important;
              border-radius: 12px !important;
            }
            .day-overview-body-grid {
              grid-template-columns: 1fr;
              padding: 14px;
              gap: 16px;
            }
            .notes-vertical-list {
              max-height: 260px;
            }
            .column-right-form {
              padding: 14px;
            }
            .form-actions-row {
              flex-direction: column;
            }
            .cancel-edit-btn {
              width: 100%;
            }
          }

          /* ===== RESPONSIVE LAYOUT FOR MOBILE ===== */
          @media (max-width: 768px) {
            :global(.modal-overlay) {
              padding: 6px !important;
              align-items: flex-start !important;
            }
            :global(.day-overview-card) {
              max-height: 98vh !important;
              width: 100% !important;
              margin: 0 !important;
              border-radius: 10px !important;
              max-width: 100% !important;
            }

            /* Header compacto */
            .modal-header.card-header {
              padding: 10px 14px !important;
            }
            .capitalize-first {
              font-size: 0.9rem !important;
            }
            .subtitle-date {
              font-size: 0.7rem;
            }
            .close-btn {
              font-size: 1rem !important;
              padding: 4px 8px !important;
            }

            /* Body grid compacto */
            .day-overview-body-grid {
              padding: 10px 12px;
              gap: 12px;
              grid-template-columns: 1fr;
            }

            /* Filter compacto */
            .filter-section {
              padding: 8px 10px;
              gap: 4px;
            }
            .form-label-aquatech {
              font-size: 0.68rem !important;
            }
            .form-select-aquatech {
              font-size: 0.75rem !important;
              padding: 6px 8px !important;
            }

            /* Section titles compactos */
            .section-title {
              font-size: 0.65rem;
              margin: 0 0 6px 0;
              letter-spacing: 0.5px;
            }
            .section-title-form {
              font-size: 0.72rem;
              padding-bottom: 8px;
            }
            .autosave-badge {
              font-size: 0.58rem;
            }

            /* Notes list compacta */
            .notes-vertical-list {
              max-height: 220px;
              gap: 4px;
              padding-right: 2px;
            }

            .notes-maximized .notes-vertical-list {
              max-height: 60vh;
            }

            /* Note cards compactas */
            .note-item-card {
              padding: 5px 8px;
              gap: 6px;
              border-radius: 6px;
            }
            .drag-handle-indicator {
              font-size: 0.8rem;
              padding: 0 2px;
            }
            .priority-badge-pill {
              font-size: 0.55rem !important;
              padding: 1px 4px !important;
            }
            .note-text {
              font-size: 0.68rem;
              line-height: 1.3;
            }
            .note-assignees-text {
              font-size: 0.58rem;
            }
            .delete-note-btn {
              font-size: 0.72rem;
              padding: 4px;
            }

            /* Empty state compacto */
            .empty-state {
              padding: 1.5rem 0.75rem;
            }
            .empty-icon {
              font-size: 1.4rem;
              margin-bottom: 6px;
            }
            .empty-state p {
              font-size: 0.72rem;
            }

            /* Form derecho compacto */
            .column-right-form {
              padding: 12px;
              gap: 10px;
              border-radius: 8px;
            }
            .add-note-form {
              gap: 10px;
            }
            .note-textarea-premium {
              height: 100px !important;
              font-size: 0.78rem !important;
              padding: 8px 10px !important;
            }
            .note-textarea-expanded {
              height: 350px !important;
              min-height: 250px !important;
            }
            .expand-note-btn {
              font-size: 0.62rem;
              padding: 5px 10px;
            }
            .operators-compact-selection {
              padding: 4px;
            }
            .select-all-row {
              padding: 4px 6px;
            }
            .operators-list-scroll {
              max-height: 80px;
              padding: 2px;
            }
            .op-checkbox-label {
              gap: 6px;
              padding: 3px 6px;
            }
            .op-checkbox-label input {
              width: 13px;
              height: 13px;
            }
            .op-name-text {
              font-size: 0.66rem;
            }
            .submit-note-btn-premium {
              padding: 10px !important;
              font-size: 0.7rem;
            }
            .cancel-edit-btn {
              padding: 8px 14px !important;
              font-size: 0.7rem !important;
              width: 100%;
            }
            .form-actions-row {
              flex-direction: column;
              gap: 6px;
            }
          }

          /* ===== RESPONSIVE LAYOUT FOR SMALL PHONES ===== */
          @media (max-width: 420px) {
            :global(.modal-overlay) {
              padding: 0 !important;
            }
            :global(.day-overview-card) {
              max-height: 100vh !important;
              max-height: 100dvh !important;
              border-radius: 0 !important;
              border: none !important;
            }

            .modal-header.card-header {
              padding: 8px 10px !important;
            }
            .capitalize-first {
              font-size: 0.8rem !important;
            }
            .subtitle-date {
              font-size: 0.62rem;
            }

            .day-overview-body-grid {
              padding: 8px;
              gap: 10px;
            }
            .filter-section {
              padding: 6px 8px;
            }
            .section-title {
              font-size: 0.6rem;
            }
            .notes-vertical-list {
              max-height: 180px;
            }
            .note-item-card {
              padding: 4px 6px;
              gap: 4px;
            }
            .note-text {
              font-size: 0.62rem;
            }
            .note-assignees-text {
              font-size: 0.52rem;
            }
            .column-right-form {
              padding: 10px;
              gap: 8px;
            }
            .note-textarea-premium {
              height: 80px !important;
              font-size: 0.72rem !important;
            }
            .note-textarea-expanded {
              height: 250px !important;
              min-height: 180px !important;
            }
            .expand-note-btn {
              font-size: 0.58rem;
              padding: 4px 8px;
            }
            .op-name-text {
              font-size: 0.6rem;
            }
            .submit-note-btn-premium {
              padding: 8px !important;
              font-size: 0.65rem;
            }
          }
        `}</style>

      </div>
    </div>,
    document.body
  )
}
