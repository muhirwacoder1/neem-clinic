import React from 'react'
import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import { BRAND_NAME } from '../brand'
import type { TemplateEntry } from './registry'
import { BLUE, CREAM, NAVY, SKY, SLATE, button, p } from './layout'

interface BillProps {
  name?: string
  number?: number
  items?: { name: string; qty: number; amount: string }[]
  total?: string
  status?: string
  method?: string
  payCode?: string
  payHref?: string
  reference?: string
  receiptUrl?: string
}

const Email = (d: BillProps) => {
  const paid = d.status === 'paid'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{paid ? `Receipt #${d.number}` : `Your bill #${d.number} — ${d.total}`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <Container style={{ backgroundColor: CREAM, padding: '32px 12px' }}>
          <Section style={{ backgroundColor: NAVY, borderRadius: '12px 12px 0 0', padding: '20px 28px' }}>
            <Text style={{ color: CREAM, fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{BRAND_NAME}</Text>
          </Section>
          <Section style={{ backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px', padding: '28px' }}>
            <Text style={{ color: NAVY, fontSize: '22px', fontWeight: 'bold', margin: '0 0 16px' }}>
              {paid ? 'Payment receipt' : 'Final invoice'} #{d.number}
            </Text>
            <Text style={p}>Hello {d.name || 'there'},</Text>
            <Text style={p}>{paid ? 'Thank you — we have received your payment.' : 'Here is your final invoice with all the services and products from today. Please pay, then show the payment message to our staff.'}</Text>
            <Section style={{ backgroundColor: CREAM, borderRadius: '10px', padding: '14px 18px', margin: '16px 0' }}>
              {(d.items ?? []).map((it, i) => (
                <Text key={i} style={{ color: NAVY, fontSize: '14px', margin: '0 0 6px' }}>
                  {it.name} × {it.qty} — {it.amount}
                </Text>
              ))}
              <Text style={{ color: NAVY, fontSize: '16px', fontWeight: 'bold', margin: '10px 0 0' }}>Total: {d.total}</Text>
              {paid && d.method && <Text style={{ color: NAVY, fontSize: '14px', margin: '6px 0 0' }}>Paid by {d.method}{d.reference ? ` · Ref ${d.reference}` : ''}</Text>}
            </Section>
            {!paid && d.payCode && (
              <>
                <Text style={p}>Pay with Mobile Money by dialling <strong>{d.payCode}</strong>, then show the confirmation at reception.</Text>
                <Button href={d.payHref} style={button}>
                  Pay now
                </Button>
              </>
            )}
            {d.receiptUrl && (
              <Text style={{ ...p, marginTop: '18px' }}>
                <a href={d.receiptUrl} style={{ color: BLUE, fontWeight: 'bold' }}>{paid ? 'View / download your receipt (PDF)' : 'View your invoice'}</a>
              </Text>
            )}
            <Hr style={{ borderColor: SKY, margin: '24px 0 16px' }} />
            <Text style={{ color: SLATE, fontSize: '12px', margin: 0 }}>{BRAND_NAME} · Kigali, Rwanda</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => (d['status'] === 'paid' ? `Receipt #${d['number']}` : `Your ${BRAND_NAME} bill #${d['number']}`),
  displayName: 'Bill / receipt',
  previewData: {
    name: 'Aline',
    number: 12,
    items: [{ name: 'Initial assessment', qty: 1, amount: '15,000 RWF' }],
    total: '15,000 RWF',
    status: 'unpaid',
    payCode: '*182*8*1*2088293#',
    payHref: 'tel:*182*8*1*2088293%23',
  },
} satisfies TemplateEntry
