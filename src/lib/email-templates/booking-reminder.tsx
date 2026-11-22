import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BookingLayout, p, type BookingEmailProps } from './layout'

const when = (d?: number) => (!d || d === 1 ? 'tomorrow' : `in ${d} days`)

const Email = (props: BookingEmailProps) => (
  <BookingLayout preview={`Reminder: your approved appointment is ${when(props.daysLeft)}`} title={`Reminder: see you ${when(props.daysLeft)}`} props={props}>
    <Text style={p}>
      You booked this appointment and it has been <strong>approved</strong>. You have{' '}
      <strong>{props.daysLeft && props.daysLeft > 1 ? `${props.daysLeft} days` : '1 day'}</strong> left until your visit.
      Please arrive about 10 minutes early.
    </Text>
    <Text style={p}>
      Still coming? Great — no action needed. If you can no longer make it, please use
      the button below to reschedule or cancel so we can offer the slot to another patient.
    </Text>
  </BookingLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Reminder: your appointment is ${when(d["daysLeft"])} at ${d["timeLabel"] ?? ''}`.trim(),
  displayName: 'Appointment reminder (1 or 3 days before)',
  previewData: {
    name: 'Aline',
    serviceName: 'Physiotherapy',
    dateLabel: 'Monday, 5 October 2026',
    timeLabel: '09:00',
    reference: 'MW-1234',
    manageUrl: 'https://motionwell.lovable.app/manage/example',
    daysLeft: 3,
  },
} satisfies TemplateEntry
