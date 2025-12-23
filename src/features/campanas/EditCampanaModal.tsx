import React from 'react';
import { AssignInventarioCampanaModal } from './AssignInventarioCampanaModal';
import { Campana } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campana: Campana | null;
}

export function EditCampanaModal({ isOpen, onClose, campana }: Props) {
  if (!campana) return null;

  return <AssignInventarioCampanaModal isOpen={isOpen} onClose={onClose} campana={campana} />;
}

export default EditCampanaModal;
