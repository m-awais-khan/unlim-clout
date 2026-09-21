import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for Google Drive & Windows Explorer style marquee (rubberband) drag selection.
 */
export default function useMarqueeSelection({
  containerRef,
  allItems,
  selectedItems,
  setSelectedItems
}) {
  const [dragBox, setDragBox] = useState(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const initialSelectionRef = useRef([]);
  const modifierRef = useRef({ ctrl: false, shift: false });
  const autoScrollFrameRef = useRef(null);

  // Keep references to latest values so listeners don't become stale
  const allItemsRef = useRef(allItems);
  allItemsRef.current = allItems;
  const selectedItemsRef = useRef(selectedItems);
  selectedItemsRef.current = selectedItems;
  const setSelectedItemsRef = useRef(setSelectedItems);
  setSelectedItemsRef.current = setSelectedItems;

  const updateSelectionAndBox = useCallback((currentX, currentY) => {
    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const right = Math.max(startX, currentX);
    const bottom = Math.max(startY, currentY);
    const width = right - left;
    const height = bottom - top;

    setDragBox({ left, top, right, bottom, width, height });

    if (!containerRef.current) return;

    // Query all selectable items in container
    const selectableEls = containerRef.current.querySelectorAll('[data-selectable="true"]');
    const intersectingKeys = new Set();

    selectableEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const intersects = !(
        rect.right < left ||
        rect.left > right ||
        rect.bottom < top ||
        rect.top > bottom
      );
      if (intersects) {
        const type = el.getAttribute('data-item-type');
        const id = el.getAttribute('data-item-id');
        if (type && id) {
          intersectingKeys.add(`${type}-${id}`);
        }
      }
    });

    const currentAllItems = allItemsRef.current;
    const initialKeys = new Set(
      initialSelectionRef.current.map((i) => `${i.type}-${i.item.id}`)
    );

    if (modifierRef.current.ctrl) {
      // Toggle or combine with initial selection
      const combinedKeys = new Set(initialKeys);
      intersectingKeys.forEach((key) => {
        if (initialKeys.has(key)) {
          combinedKeys.delete(key);
        } else {
          combinedKeys.add(key);
        }
      });
      const newSelected = currentAllItems.filter((i) =>
        combinedKeys.has(`${i.type}-${i.item.id}`)
      );
      setSelectedItemsRef.current(newSelected);
    } else if (modifierRef.current.shift) {
      // Union of initial selection and intersecting items
      const unionKeys = new Set([...initialKeys, ...intersectingKeys]);
      const newSelected = currentAllItems.filter((i) =>
        unionKeys.has(`${i.type}-${i.item.id}`)
      );
      setSelectedItemsRef.current(newSelected);
    } else {
      // Standard marquee selection
      const newSelected = currentAllItems.filter((i) =>
        intersectingKeys.has(`${i.type}-${i.item.id}`)
      );
      setSelectedItemsRef.current(newSelected);
    }
  }, [containerRef]);

  const checkAutoScroll = useCallback(() => {
    if (!isDraggingRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mouseY = mousePosRef.current.y;
    const threshold = 50;
    const maxSpeed = 16;

    let scrolled = false;
    if (mouseY < rect.top + threshold && container.scrollTop > 0) {
      const intensity = Math.min(1, (rect.top + threshold - mouseY) / threshold);
      container.scrollTop -= maxSpeed * intensity;
      scrolled = true;
    } else if (
      mouseY > rect.bottom - threshold &&
      container.scrollTop < container.scrollHeight - container.clientHeight
    ) {
      const intensity = Math.min(1, (mouseY - (rect.bottom - threshold)) / threshold);
      container.scrollTop += maxSpeed * intensity;
      scrolled = true;
    }

    if (scrolled) {
      updateSelectionAndBox(mousePosRef.current.x, mousePosRef.current.y);
    }

    autoScrollFrameRef.current = requestAnimationFrame(checkAutoScroll);
  }, [containerRef, updateSelectionAndBox]);

  const handleMouseDown = useCallback((e) => {
    // Only primary left button
    if (e.button !== 0) return;

    // Ignore interactive elements or marked no-drag
    if (
      e.target.closest(
        'button, input, textarea, a, select, [role="menu"], [data-no-drag="true"]'
      )
    ) {
      return;
    }

    startPosRef.current = { x: e.clientX, y: e.clientY };
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    modifierRef.current = { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey };
    initialSelectionRef.current = selectedItemsRef.current;
    isDraggingRef.current = false;

    const handleMouseMove = (moveEvent) => {
      mousePosRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      const dx = moveEvent.clientX - startPosRef.current.x;
      const dy = moveEvent.clientY - startPosRef.current.y;

      if (!isDraggingRef.current) {
        if (Math.hypot(dx, dy) >= 5) {
          isDraggingRef.current = true;
          document.body.style.userSelect = 'none';
          if (autoScrollFrameRef.current) {
            cancelAnimationFrame(autoScrollFrameRef.current);
          }
          autoScrollFrameRef.current = requestAnimationFrame(checkAutoScroll);
        }
      }

      if (isDraggingRef.current) {
        updateSelectionAndBox(moveEvent.clientX, moveEvent.clientY);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';

      if (autoScrollFrameRef.current) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }

      if (isDraggingRef.current) {
        setDragBox(null);

        // Intercept and swallow the trailing click event
        const captureClick = (clickEvent) => {
          clickEvent.stopPropagation();
          clickEvent.preventDefault();
          window.removeEventListener('click', captureClick, true);
        };
        window.addEventListener('click', captureClick, true);

        // Safety fallback to clean up click interceptor
        setTimeout(() => {
          window.removeEventListener('click', captureClick, true);
          isDraggingRef.current = false;
        }, 50);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [checkAutoScroll, updateSelectionAndBox]);

  // Handle Escape key to cancel drag selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        isDraggingRef.current = false;
        setDragBox(null);
        setSelectedItemsRef.current(initialSelectionRef.current);
        document.body.style.userSelect = '';
        if (autoScrollFrameRef.current) {
          cancelAnimationFrame(autoScrollFrameRef.current);
          autoScrollFrameRef.current = null;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    dragBox,
    handleMouseDown,
    isDragging: isDraggingRef.current
  };
}
