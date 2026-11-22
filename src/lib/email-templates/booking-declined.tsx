import React from 'react'
import { Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { BookingLayout, p, type BookingEmailProps } from './layout'

const Email = (props: BookingEmailProps) => (
  <BookingLayout preview="Update about your booking request" title="Booking update" props={props}>
    <Text style={p}>
      Unfortunately we could not approve your booking for the time you requested.
      {props.note ? ` Note from our team: ${props.note}` : ''}
    </Text>
    <Text style={p}>
      You are very welcome to book another time that suits you — many slots are still open.
    </Text>
  </BookingLayout>
)

export const template = {
  component: Email,
  subject: 'Update about your booking request',
  displayName: 'Booking declined',
  previewData: {
    name: 'Aline',
    serviceName: 'Physiotherapy',
    dateLabel: 'Monday, 5 October 2026',
    timeLabel: '09:00',
    reference: 'MW-1234',
    manageUrl: 'https://motionwell.lovable.app/book',
  },
} satisfies TemplateEntry
