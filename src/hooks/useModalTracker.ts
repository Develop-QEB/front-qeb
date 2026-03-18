import { useEffect } from 'react';
import { useModalStore } from '../store/modalStore';

/**
 * Registers the current modal in the global store so Qebsillo can
 * report which modal was open when a question was asked.
 *
 * Usage: call this inside any modal component:
 *   useModalTracker('Nombre del Modal', isOpen);
 */
export function useModalTracker(name: string, isOpen: boolean) {
  const setActiveModal = useModalStore((s) => s.setActiveModal);

  useEffect(() => {
    if (isOpen) {
      setActiveModal(name);
      return () => setActiveModal(null);
    }
  }, [isOpen, name, setActiveModal]);
}
