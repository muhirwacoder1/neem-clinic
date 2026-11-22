import type { ComponentType } from 'react'
import { template as bookingReceived } from './booking-received'
import { template as bookingAccepted } from './booking-accepted'
import { template as bookingDeclined } from './booking-declined'
import { template as bookingRescheduled } from './booking-rescheduled'
import { template as bookingCancelled } from './booking-cancelled'
import { template as bookingReminder } from './booking-reminder'
import { template as billIssued } from './bill-issued'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-received': bookingReceived,
  'booking-accepted': bookingAccepted,
  'booking-declined': bookingDeclined,
  'booking-rescheduled': bookingRescheduled,
  'booking-cancelled': bookingCancelled,
  'booking-reminder': bookingReminder,
  'bill-issued': billIssued,
}
