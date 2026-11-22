import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BookingLayout, p, type BookingEmailProps } from './layout'

const Email = (props: BookingEmailProps) => (
  <BookingLayout preview="Your appointment has been rescheduled" title="Appointment rescheduled" props={props}>
    <Text style={p}>
      Your appointment has been moved
      {props.oldDateLabel ? ` from ${props.oldDateLabel}${props.oldTimeLabel ? ` at ${props.oldTimeLabel}` : ''}` : ''}.
      Your new appointment time is below.
    </Text>
    <Text style={p}>If this time does not work for you, you can change or cancel it using the button below.</Text>
  </BookingLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your appointment was rescheduled (${d["reference"] ?? ''})`.trim(),
  displayName: 'Booking rescheduled',
  previewData: {
    name: 'Aline',
    serviceName: 'Physiotherapy',
    dateLabel: 'Tuesday, 6 October 2026',
    timeLabel: '10:30',
    oldDateLabel: 'Monday, 5 October 2026',
    oldTimeLabel: '09:00',
    reference: 'MW-1234',
    manageUrl: 'https://motionwell.lovable.app/manage/example',
  },
} satisfies TemplateEntry
