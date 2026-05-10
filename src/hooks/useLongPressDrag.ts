import { useState, useEffect, useRef } from "react";

interface UseLongPressDragOptions {
  isEditMode: boolean;
  isDragging: boolean;
  onLongPress?: () => void;
  longPressDuration?: number; // Default 1200ms according to specification
}

interface UseLongPressDragReturn {
  longPressProgress: number;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerUp: () => void;
  handlePointerLeave: () => void;
  triggerDragStart: (onPointerDown: ((e: React.PointerEvent) => void) | undefined) => void;
}

/**
 * Reusable hook for long-press to enable drag functionality
 * Shows progress circle and triggers callback on completion
 */
export function useLongPressDrag({
  isEditMode,
  isDragging,
  onLongPress,
  longPressDuration = 1200, // Changed from 800ms to 1200ms per specification
}: UseLongPressDragOptions): UseLongPressDragReturn {
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const [shouldStartDrag, setShouldStartDrag] = useState(false);
  const [enteredEditModeViaLongPress, setEnteredEditModeViaLongPress] = useState(false);
  const pointerDownEventRef = useRef<React.PointerEvent | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditMode || isDragging) return;
    
    // Store the event for later use
    pointerDownEventRef.current = e;
    
    // Start progress animation
    let progress = 0;
    const updateInterval = 40; // Update every 40ms
    const steps = longPressDuration / updateInterval;
    const increment = 100 / steps;
    
    const interval = setInterval(() => {
      progress += increment;
      setLongPressProgress(Math.min(progress, 100));
      
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, updateInterval);
    
    setProgressInterval(interval);
    
    // Set timer to trigger edit mode
    const timer = setTimeout(() => {
      console.log("[useLongPressDrag] Long press completed, calling onLongPress");
      // Enter edit mode
      onLongPress?.();
      
      // Mark that we entered edit mode via long press
      setEnteredEditModeViaLongPress(true);
      
      // Signal that we should start dragging
      setShouldStartDrag(true);
      console.log("[useLongPressDrag] Set shouldStartDrag to true");
      
      // Hide progress bar after a short delay
      setTimeout(() => {
        setLongPressProgress(0);
        clearInterval(interval);
      }, 150);
    }, longPressDuration);
    
    setLongPressTimer(timer);
  };

  // Trigger drag start after entering edit mode
  const triggerDragStart = (onPointerDown: ((e: React.PointerEvent) => void) | undefined) => {
    console.log("[useLongPressDrag] triggerDragStart called", { 
      shouldStartDrag, 
      hasEvent: !!pointerDownEventRef.current,
      hasOnPointerDown: !!onPointerDown 
    });
    if (shouldStartDrag && pointerDownEventRef.current && onPointerDown) {
      console.log("[useLongPressDrag] Simulating pointerdown event");
      // Simulate a new pointerdown event to start dragging
      setTimeout(() => {
        onPointerDown(pointerDownEventRef.current as any);
        setShouldStartDrag(false);
        pointerDownEventRef.current = null;
      }, 50);
    } else {
      console.log("[useLongPressDrag] Not triggering drag start (conditions not met)");
    }
  };

  const handlePointerUp = () => {
    console.log("[useLongPressDrag] handlePointerUp called", { 
      hasTimer: !!longPressTimer, 
      hasInterval: !!progressInterval,
      shouldStartDrag 
    });
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    setLongPressProgress(0);
    setShouldStartDrag(false);
    pointerDownEventRef.current = null;
  };

  const handlePointerLeave = () => {
    handlePointerUp();
  };
  
  // Listen for global clear event (e.g., when modal opens)
  useEffect(() => {
    const handleClearEvent = () => {
      console.log("[useLongPressDrag] Received clearLongPressTimers event, clearing timers");
      handlePointerUp();
    };
    
    window.addEventListener('clearLongPressTimers', handleClearEvent);
    
    return () => {
      window.removeEventListener('clearLongPressTimers', handleClearEvent);
    };
  }, [longPressTimer, progressInterval]);
  
  // After entering edit mode, trigger drag start
  useEffect(() => {
    if (shouldStartDrag && isEditMode) {
      // Drag will be triggered by the component calling triggerDragStart
      setShouldStartDrag(false);
    }
  }, [shouldStartDrag, isEditMode]);

  return {
    longPressProgress,
    handlePointerDown,
    handlePointerUp,
    handlePointerLeave,
    triggerDragStart,
  };
}
