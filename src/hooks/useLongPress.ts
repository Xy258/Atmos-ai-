import { useCallback, useRef, useState } from 'react';

export interface UseLongPressOptions {
  threshold?: number; // ms to trigger long press (default: 500ms)
  onLongPress: () => void;
  onClick?: () => void;
  onCancel?: () => void;
}

export function useLongPress({
  threshold = 500,
  onLongPress,
  onClick,
  onCancel,
}: UseLongPressOptions) {
  const [isPressing, setIsPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0); // 0 to 1
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isLongPressTriggeredRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsPressing(false);
    setPressProgress(0);
  }, []);

  const startPress = useCallback(
    (clientX?: number, clientY?: number) => {
      clearTimer();
      isLongPressTriggeredRef.current = false;
      startTimeRef.current = Date.now();
      setIsPressing(true);
      setPressProgress(0);

      if (clientX !== undefined && clientY !== undefined) {
        touchStartPosRef.current = { x: clientX, y: clientY };
      }

      // Progress animation loop
      const updateProgress = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(1, elapsed / threshold);
        setPressProgress(progress);
        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };
      animFrameRef.current = requestAnimationFrame(updateProgress);

      timerRef.current = window.setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        clearTimer();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([40, 20, 60]);
          } catch {
            // ignore haptic error
          }
        }
        onLongPress();
      }, threshold);
    },
    [threshold, onLongPress, clearTimer]
  );

  const endPress = useCallback(
    (e?: React.SyntheticEvent) => {
      const wasLongPress = isLongPressTriggeredRef.current;
      clearTimer();

      if (!wasLongPress) {
        if (onClick) {
          onClick();
        }
      } else if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [clearTimer, onClick]
  );

  const cancelPress = useCallback(() => {
    clearTimer();
    if (onCancel) {
      onCancel();
    }
  }, [clearTimer, onCancel]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartPosRef.current || !isPressing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      // Cancel if dragged more than 12 pixels
      if (dx > 12 || dy > 12) {
        cancelPress();
      }
    },
    [isPressing, cancelPress]
  );

  return {
    isPressing,
    pressProgress,
    handlers: {
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button === 0) {
          startPress(e.clientX, e.clientY);
        }
      },
      onMouseUp: (e: React.MouseEvent) => {
        endPress(e);
      },
      onMouseLeave: () => {
        cancelPress();
      },
      onTouchStart: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (touch) {
          startPress(touch.clientX, touch.clientY);
        } else {
          startPress();
        }
      },
      onTouchEnd: (e: React.TouchEvent) => {
        endPress(e);
      },
      onTouchMove: handleTouchMove,
      onTouchCancel: () => {
        cancelPress();
      },
    },
  };
}
