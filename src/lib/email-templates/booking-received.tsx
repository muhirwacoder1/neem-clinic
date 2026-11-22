import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BookingLayout, p, type BookingEmailProps } from './layout'

const Email = (props: BookingEmailProps) => (
  <BookingLayout preview="We received your booking request" title="Booking received" props={props}>
    <Text style={p}>
      Thank you — we have received your appointment request. Our team usually reviews
      bookings within a few minutes, and you will get another email as soon as it is approved.
    </Text>
  </BookingLayout>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `We received your booking (${d["reference"] ?? ''})`.trim(),
  displayName: 'Booking received',
  previewData: {
    name: 'Aline',
    serviceName: 'Physiotherapy',
    dateLabel: 'Monday, 5 October 2026',
    timeLabel: '09:00',
    reference: 'MW-1234',
    manageUrl: 'https://motionwell.lovable.app/manage/example',
  },
} satisfies TemplateEntry
