import React from 'react'
import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import { BRAND_NAME } from '../brand'

export const NAVY = '#1B2F45'
export const CREAM = '#F7F5F1'
export const BLUE = '#2D4F73'
export const APRICOT = '#F4A259'
export const SKY = '#A5D1E6'
export const SLATE = '#465B6C'

export interface BookingEmailProps {
  name?: string
  serviceName?: string
  dateLabel?: string
  timeLabel?: string
  reference?: string
  manageUrl?: string
  oldDateLabel?: string
  oldTimeLabel?: string
  note?: string
  daysLeft?: number
}

export function BookingLayout({
  preview,
  title,
  children,
  props,
}: {
  preview: string
  title: string
  children: React.ReactNode
  props: BookingEmailProps
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={wrapper}>
          <Section style={header}>
            <Text style={brand}>{BRAND_NAME}</Text>
          </Section>
          <Section style={card}>
            <Text style={h1}>{title}</Text>
            <Text style={p}>Hello {props.name || 'there'},</Text>
            {children}
            {(props.serviceName || props.dateLabel) && (
              <Section style={details}>
                {props.reference && (
                  <Text style={detailRow}><strong>Reference:</strong> {props.reference}</Text>
                )}
                {props.serviceName && (
                  <Text style={detailRow}><strong>Service:</strong> {props.serviceName}</Text>
                )}
                {props.dateLabel && (
                  <Text style={detailRow}><strong>Date:</strong> {props.dateLabel}</Text>
                )}
                {props.timeLabel && (
                  <Text style={detailRowLast}><strong>Time:</strong> {props.timeLabel}</Text>
                )}
              </Section>
            )}
            {props.manageUrl && (
              <Button href={props.manageUrl} style={button}>
                Manage your booking
              </Button>
            )}
            <Hr style={hr} />
            <Text style={footer}>
              {BRAND_NAME} · Kigali, Rwanda · If you have questions, just reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const p = { color: NAVY, fontSize: '15px', lineHeight: '24px', margin: '0 0 12px' }

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const wrapper = { backgroundColor: CREAM, padding: '32px 12px' }
const header = { backgroundColor: NAVY, borderRadius: '12px 12px 0 0', padding: '20px 28px' }
const brand = { color: CREAM, fontSize: '16px', fontWeight: 'bold' as const, letterSpacing: '0.5px', margin: 0 }
const card = { backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px', padding: '28px' }
const h1 = { color: NAVY, fontSize: '22px', fontWeight: 'bold' as const, margin: '0 0 16px' }
const details = { backgroundColor: CREAM, borderRadius: '10px', padding: '14px 18px', margin: '16px 0' }
const detailRow = { color: NAVY, fontSize: '14px', margin: '0 0 6px' }
const detailRowLast = { ...detailRow, margin: 0 }
export const button = {
  backgroundColor: APRICOT,
  borderRadius: '9999px',
  color: NAVY,
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  padding: '12px 28px',
  textDecoration: 'none',
  marginTop: '8px',
}
const hr = { borderColor: SKY, margin: '24px 0 16px' }
const footer = { color: SLATE, fontSize: '12px', lineHeight: '18px', margin: 0 }
