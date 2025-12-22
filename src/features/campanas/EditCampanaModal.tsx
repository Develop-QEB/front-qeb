import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Megaphone, Calendar, FileText, Save, Building2,
  Package, Tag, Loader2, ChevronLeft, ChevronRight, Check, Info
} from 'lucide-react';
import { Campana } from '../../types';
import { solicitudesService } from '../../services/solicitudes.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campana: Campana | null;
}

// Fetch campaign details
async function fetchCampanaDetails(id: number): Promise<Campana> {
  const response = await fetch(`http://localhost:3000/api/campanas/${id}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    },
  });
  if (!response.ok) throw new Error('Error al cargar detalles de campaña');
  const data = await response.json();
  return data.data;
}

// Status options for campaign
const STATUS_OPTIONS = [
  { value: 'activa', label: 'Activa' },
  { value: 'por iniciar', label: 'Por iniciar' },
  { value: 'finalizada', label: 'Finalizada' },
  { value: 'atendida', label: 'Atendida' },
  { value: 'cancelada', label: 'Cancelada' },
];

// Step configuration
const STEPS = [
  { num: 1, label: 'Información', icon: Info },
  { num: 2, label: 'Campaña', icon: Megaphone },
  { num: 3, label: 'Periodos', icon: Calendar },
];

import React from 'react';
import { AssignInventarioCampanaModal } from './AssignInventarioCampanaModal';
import { Campana } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campana: Campana | null;
}

export function EditCampanaModal({ isOpen, onClose, campana }: Props) {
  // Si no hay campaña seleccionada, no mostramos nada
  if (!campana) return null;

  // Reutilizamos exactamente el modal de asignar inventario para editar campañas
  return <AssignInventarioCampanaModal isOpen={isOpen} onClose={onClose} campana={campana} />;
}

export default EditCampanaModal;
