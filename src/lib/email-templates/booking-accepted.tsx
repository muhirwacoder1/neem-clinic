import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BookingLayout, p, type BookingEmailProps } from './layout'

const Email = (props: BookingEmailProps) => (
  <BookingLayout preview="Your appointment is confirmed" title="Appointment confirmed" props={props}>
    <Text style={p}>
      Good news — your appointment has been approved. Please arrive about 10 minutes
      early and bring any previous medical reports or scans if you have them.
    </Text>
    <Text style={p}>We look forward to seeing you.</Text>
  </BookingLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Your appointment is confirmed (${d["reference"] ?? ''})`.trim(),
  displayName: 'Booking accepted',
  previewData: {
    name: 'Aline',
    serviceName: 'Physiotherapy',
    dateLabel: 'Monday, 5 October 2026',
    timeLabel: '09:00',
    reference: 'MW-1234',
    manageUrl: 'https://motionwell.lovable.app/manage/example',
  },
} satisfies TemplateEntry
