'use client'
import { CustomerHeader } from './CustomerNavigation'
interface HeaderProps {
  onNewDelivery?: () => void
  userId?: string
}
export default function Header(props: HeaderProps) {
  return <CustomerHeader fixed initialUserId={props.userId} />
}
