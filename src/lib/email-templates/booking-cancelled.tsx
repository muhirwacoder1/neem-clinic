import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BookingLayout, p, type BookingEmailProps } from './layout'

const Email = (props: BookingEmailProps) => (
  <BookingLayout preview="Your appointment has been cancelled" title="Appointment cancelled" props={props}>
    <Text style={p}>
      Your appointment below has been cancelled. If this was a mistake or you would
      like to come another day, you can book a new time anytime.
    </Text>
  </BookingLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your appointment was cancelled (${d["reference"] ?? ''})`.trim(),
  displayName: 'Booking cancelled',
  previewData: {
    name: 'Aline',
    serviceName: 'Physiotherapy',
    dateLabel: 'Monday, 5 October 2026',
    timeLabel: '09:00',
    reference: 'MW-1234',
    manageUrl: 'https://motionwell.lovable.app/book',
  },
} satisfies TemplateEntry
