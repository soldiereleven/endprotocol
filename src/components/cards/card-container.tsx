import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { CardConfig } from "@/types/dashboard";
import { CharacterListCard } from "./character-list-card";
import { updateCardLayout } from '@/utils/dashboardConfig';

// Grid configuration
const GRID_SIZE = 100; // Each grid cell is 100x100 pixels

// Generate SVG grid pattern with dashed lines
const generateGridSVG = (isDragging: boolean) => {
  const opacity = isDragging ? 0.3 : 0.15;
  const svg = `<svg width='${GRID_SIZE}' height='${GRID_SIZE}' xmlns='http://www.w3.org/2000/svg'>
    <defs>
      <pattern id='grid' width='${GRID_SIZE}' height='${GRID_SIZE}' patternUnits='userSpaceOnUse'>
        <path d='M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}' fill='none' stroke='rgba(128,128,128,${opacity})' stroke-width='1' stroke-dasharray='5,5'/>
      </pattern>
    </defs>
    <rect width='100%' height='100%' fill='url(#grid)'/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
const CONTAINER_HEIGHT = 2000; // Available height (scrollable)

interface FreeDragCardProps {
  card: CardConfig;
  roleId: string;
  isEditMode: boolean;
  onRemoveCard: (cardId: string) => void;
  onUpdatePosition: (cardId: string, x: number, y: number) => void;
}

// Individual draggable card
function FreeDragCard({ 
  card, 
  roleId, 
  isEditMode, 
  onRemoveCard,
  onUpdatePosition,
  isDragging,
  showGridCoords
}: FreeDragCardProps & { isDragging?: boolean; showGridCoords?: boolean }) {
  const { setNodeRef, attributes, listeners, transform } = useDraggable({
    id: card.id,
    disabled: !isEditMode,
  });

  // Calculate position from grid coordinates
  const x = (card.x ?? 0) * GRID_SIZE;
  const y = (card.y ?? 0) * GRID_SIZE;
  
  // Apply transform if dragging
  const style: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: (card.w ?? 3) * GRID_SIZE,
    height: (card.h ?? 2) * GRID_SIZE,  // Default 3x2
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    cursor: isEditMode ? 'grab' : 'default',
    // Hide original card when dragging to prevent ghosting
    opacity: isDragging ? 0 : 1,
    visibility: isDragging ? 'hidden' : 'visible',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ${isEditMode ? 'active:cursor-grabbing' : ''}`}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      {/* Grid Coordinates Display - Show when dragging */}
      {showGridCoords && (
        <div className="absolute -top-8 left-0 z-30 px-2 py-1 bg-content1/90 backdrop-blur-sm rounded shadow-lg text-xs font-mono whitespace-nowrap">
          <span className="text-primary">Row: {card.y ?? 0}</span>
          <span className="mx-2 text-divider">|</span>
          <span className="text-secondary">Col: {card.x ?? 0}</span>
        </div>
      )}

      {/* Delete Button - Hide when dragging */}
      {isEditMode && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveCard(card.id);
          }}
          className="absolute -top-2 -right-2 z-20 p-1 bg-content1 rounded-full shadow-md hover:bg-danger/10 text-danger"
          aria-label="Delete card"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Card Content */}
      <div className="h-full w-full">
        <CharacterListCard
          roleId={roleId}
          cardId={card.id}
          settings={card.settings}
          isEditMode={isEditMode}
        />
      </div>
    </div>
  );
}

interface CardContainerProps {
  roleId: string;
  cards: CardConfig[];
  onRemoveCard: (cardId: string) => void;
  isEditMode?: boolean;
}

export function CardContainer({
  roleId,
  cards,
  onRemoveCard,
  isEditMode = false,
}: CardContainerProps) {
  const { t } = useTranslation();
  const [sortedCards, setSortedCards] = useState<CardConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [extraHeight, setExtraHeight] = useState(0);

  // Sort and initialize cards
  useEffect(() => {
    const sorted = [...cards].sort((a, b) => a.position - b.position);
    setSortedCards(sorted);
  }, [cards.length]);

  // Calculate required container height based on card positions
  const containerHeight = useMemo(() => {
    if (sortedCards.length === 0) return 100;
    
    let maxY = 0;
    for (const card of sortedCards) {
      const cardBottom = ((card.y ?? 0) + (card.h ?? 2)) * GRID_SIZE;
      maxY = Math.max(maxY, cardBottom);
    }
    
    // Add padding and extra height during drag
    const basePadding = 100;
    return maxY + basePadding + extraHeight;
  }, [sortedCards, extraHeight]);

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Snap to grid helper
  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }, []);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  // Track mouse position during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    // Also listen to pointermove for better compatibility with dnd-kit
    const handlePointerMove = (e: PointerEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [isDragging]);

  // Auto-scroll and expand when dragging near bottom edge
  useEffect(() => {
    if (!isDragging) return;

    const checkAutoScroll = () => {
      const windowHeight = window.innerHeight;
      const mouseY = mousePosition.y;
      
      // Calculate mouse position relative to viewport bottom
      const distanceFromBottom = windowHeight - mouseY;
      
      // If mouse is within 150px of bottom edge
      if (distanceFromBottom < 150 && distanceFromBottom > 0) {
        // Scroll down smoothly - speed increases as you get closer to edge
        const scrollSpeed = Math.max(10, (150 - distanceFromBottom) / 3);
        window.scrollBy({ top: scrollSpeed, behavior: 'auto' });
      }
    };

    const interval = setInterval(checkAutoScroll, 50);
    return () => clearInterval(interval);
  }, [isDragging, mousePosition]);

  // Handle drag move - auto scroll based on dragged element position
  const handleDragMove = (event: DragMoveEvent) => {
    const windowHeight = window.innerHeight;
    
    // Method 1: Use the dragged card's rect if available
    let cardBottom: number | null = null;
    let cardLeft: number | null = null;
    
    if (event.active.rect.current.translated) {
      const rect = event.active.rect.current.translated;
      cardBottom = rect.top + rect.height;
      cardLeft = rect.left;
    }
    // Method 2: Fallback to mouse position
    else if (mousePosition.y > 0) {
      cardBottom = mousePosition.y;
      cardLeft = mousePosition.x;
    }
    
    if (cardBottom === null || cardLeft === null) return;
    
    const distanceFromBottom = windowHeight - cardBottom;
    
    // If card is near bottom edge, scroll down and expand
    if (distanceFromBottom < 200 && distanceFromBottom > -100) {
      const scrollSpeed = Math.max(15, (200 - distanceFromBottom) / 2);
      window.scrollBy({ top: scrollSpeed, behavior: 'auto' });
      
      // Expand container height as we scroll
      setExtraHeight(prev => prev + scrollSpeed);
    }
  };

  // Handle drag end - snap to grid
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);
    setIsDragging(false);
    setExtraHeight(0); // Reset extra height after drag

    if (!delta) return;

    const card = sortedCards.find(c => c.id === active.id);
    if (!card) return;

    // Calculate new position
    const currentX = (card.x ?? 0) * GRID_SIZE;
    const currentY = (card.y ?? 0) * GRID_SIZE;
    
    const newX = snapToGrid(currentX + delta.x);
    const newY = snapToGrid(currentY + delta.y);

    // Convert back to grid coordinates
    const gridX = Math.max(0, newX / GRID_SIZE);
    const gridY = Math.max(0, newY / GRID_SIZE);

    // Update card position
    const updatedCards = sortedCards.map(c => 
      c.id === card.id 
        ? { ...c, x: gridX, y: gridY }
        : c
    );

    setSortedCards(updatedCards);

    // Save to config
    await updateCardLayout(roleId, card.id, {
      x: gridX,
      y: gridY,
      w: card.w ?? 3,
      h: card.h ?? 2,  // Default 3x2
    });
  };

  // Find active card for overlay
  const activeCard = activeId
    ? sortedCards.find((card) => card.id === activeId)
    : null;

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        <p>{t('dashboard.no_cards') || 'No cards added yet'}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div 
        className="relative w-full"
        style={{
          backgroundImage: (isEditMode || isDragging) ? generateGridSVG(isDragging) : 'none',
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
        }}
      >
        {/* Grid Coordinate Labels */}
        {(isEditMode || isDragging) && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: Math.ceil(containerHeight / GRID_SIZE) }).map((_, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                className="absolute left-2 text-xs text-muted/50 font-mono"
                style={{ top: rowIndex * GRID_SIZE + 4 }}
              >
                {rowIndex}
              </div>
            ))}
            {Array.from({ length: 20 }).map((_, colIndex) => (
              <div
                key={`col-${colIndex}`}
                className="absolute top-2 text-xs text-muted/50 font-mono"
                style={{ left: colIndex * GRID_SIZE + 4 }}
              >
                {colIndex}
              </div>
            ))}
          </div>
        )}
        {/* Container with dynamic height */}
        <div 
          className="relative w-full"
          style={{
            minHeight: containerHeight,
          }}
        >
          {sortedCards.map((card) => (
            <FreeDragCard
              key={card.id}
              card={card}
              roleId={roleId}
              isEditMode={isEditMode}
              onRemoveCard={onRemoveCard}
              onUpdatePosition={() => {}}
              isDragging={activeId === card.id}
              showGridCoords={isDragging && activeId === card.id}
            />
          ))}
        </div>
      </div>

      {/* Drag Overlay - Only show when actively dragging */}
      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="opacity-80 scale-105 rotate-2" style={{
            width: (activeCard.w ?? 3) * GRID_SIZE,
            height: (activeCard.h ?? 2) * GRID_SIZE,  // Default 3x2
          }}>
            <CharacterListCard
              roleId={roleId}
              cardId={activeCard.id}
              settings={activeCard.settings}
              isEditMode={isEditMode}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
