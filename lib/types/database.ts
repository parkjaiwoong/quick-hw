export type UserRole = "customer" | "driver" | "admin"

export type DeliveryStatus = "pending" | "accepted" | "picked_up" | "in_transit" | "delivered" | "cancelled"

export type OrderStatus = "REQUEST" | "PAID" | "ASSIGNED" | "PICKED_UP" | "DELIVERED" | "CANCELED"

export type PaymentStatus = "PENDING" | "PAID" | "CANCELED" | "REFUNDED"

export type SettlementStatus = "NONE" | "PENDING" | "CONFIRMED" | "PAID_OUT" | "EXCLUDED"

export type PaymentMethod = "card" | "bank_transfer" | "cash"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  referring_driver_id?: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DriverInfo {
  id: string
  vehicle_type: string | null
  vehicle_number: string | null
  license_number: string | null
  bank_account: string | null
  bank_name: string | null
  rating: number
  total_deliveries: number
  is_available: boolean
  current_location: string | null
  created_at: string
  updated_at: string
}

export interface Delivery {
  id: string
  customer_id: string | null
  driver_id: string | null

  pickup_address: string
  pickup_location: string
  pickup_contact_name: string
  pickup_contact_phone: string
  pickup_notes: string | null

  delivery_address: string
  delivery_location: string
  delivery_contact_name: string
  delivery_contact_phone: string
  delivery_notes: string | null

  item_description: string | null
  item_weight: number | null
  package_size: string | null

  distance_km: number | null
  base_fee: number
  distance_fee: number
  total_fee: number
  driver_fee: number | null
  platform_fee: number | null

  status: DeliveryStatus

  requested_at: string
  accepted_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  cancelled_at: string | null

  customer_rating: number | null
  customer_review: string | null
  driver_rating: number | null
  driver_review: string | null

  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  customer_id: string
  delivery_id: string | null
  order_amount: number
  customer_adjusted_amount: number | null
  payment_method: string | null
  order_status: OrderStatus | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  order_id: string | null
  delivery_id: string | null
  customer_id: string | null
  amount: number
  payment_method: string
  status: PaymentStatus
  pg_provider: string | null
  pg_tid: string | null
  requested_at: string
  paid_at: string | null
  canceled_at: string | null
  refunded_at: string | null
  canceled_amount: number | null
  refunded_amount: number | null
  created_at: string
  updated_at: string
}

export interface DeliveryTracking {
  id: string
  delivery_id: string
  driver_id: string
  location: string
  heading: number | null
  speed: number | null
  created_at: string
}

export interface Transaction {
  id: string
  delivery_id: string | null
  user_id: string | null
  transaction_type: string
  amount: number
  status: string
  payment_method: string | null
  payment_details: any
  created_at: string
  updated_at: string
}

export interface Settlement {
  id: string
  driver_id: string | null
  delivery_id: string | null
  order_id: string | null
  payment_id: string | null
  settlement_status: SettlementStatus | null
  settlement_amount: number | null
  settlement_period_start: string | null
  settlement_period_end: string | null
  status: string | null
  created_at: string
  updated_at: string
}

export interface DriverWallet {
  id: string
  driver_id: string
  total_balance: number
  available_balance: number
  pending_balance: number
  min_payout_amount: number
  last_settlement_at: string | null
  created_at: string
  updated_at: string
}

export interface PayoutRequest {
  id: string
  driver_id: string
  requested_amount: number
  status: string
  bank_account: string | null
  bank_name: string | null
  requested_at: string
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaxInvoice {
  id: string
  transaction_id: string | null
  delivery_id: string | null
  invoice_number: string
  issue_date: string
  supplier_business_number: string
  supplier_name: string
  supplier_address: string
  buyer_name: string
  buyer_business_number: string | null
  buyer_address: string | null
  supply_amount: number
  tax_amount: number
  total_amount: number
  status: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  delivery_id: string | null
  title: string
  message: string
  type: string
  is_read: boolean
  kakao_sent: boolean
  kakao_sent_at: string | null
  created_at: string
}

export interface PricingConfig {
  id: string
  base_fee: number
  per_km_fee: number
  platform_commission_rate: number
  min_driver_fee: number
  created_at: string
  updated_at: string
}
