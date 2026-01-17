-- Monitoring views & aggregates (MVP)
-- Daily/weekly rollups for ops dashboard

-- 1) 기사별 유입 고객 수 (일/주)
CREATE OR REPLACE VIEW v_rider_inflow_daily AS
SELECT
  r.rider_id,
  date_trunc('day', r.assigned_at) AS day,
  COUNT(*) AS inflow_customers
FROM rider_customer_referral r
WHERE r.deleted_at IS NULL
GROUP BY r.rider_id, date_trunc('day', r.assigned_at);

CREATE OR REPLACE VIEW v_rider_inflow_weekly AS
SELECT
  r.rider_id,
  date_trunc('week', r.assigned_at) AS week,
  COUNT(*) AS inflow_customers
FROM rider_customer_referral r
WHERE r.deleted_at IS NULL
GROUP BY r.rider_id, date_trunc('week', r.assigned_at);

-- 2) 기사별 실제 주문 수 (일/주)
CREATE OR REPLACE VIEW v_rider_orders_daily AS
SELECT
  d.referring_rider_id AS rider_id,
  date_trunc('day', d.created_at) AS day,
  COUNT(*) AS order_count
FROM deliveries d
WHERE d.referring_rider_id IS NOT NULL
GROUP BY d.referring_rider_id, date_trunc('day', d.created_at);

CREATE OR REPLACE VIEW v_rider_orders_weekly AS
SELECT
  d.referring_rider_id AS rider_id,
  date_trunc('week', d.created_at) AS week,
  COUNT(*) AS order_count
FROM deliveries d
WHERE d.referring_rider_id IS NOT NULL
GROUP BY d.referring_rider_id, date_trunc('week', d.created_at);

-- 3) 기사 변경 요청 승인율 (일/주)
CREATE OR REPLACE VIEW v_change_approval_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_requests,
  COUNT(*) FILTER (WHERE status = 'denied') AS denied_requests,
  ROUND(
    CASE WHEN COUNT(*) = 0 THEN 0
    ELSE (COUNT(*) FILTER (WHERE status = 'approved')::numeric / COUNT(*)::numeric) END
  , 4) AS approval_rate
FROM rider_change_history
GROUP BY date_trunc('day', created_at);

CREATE OR REPLACE VIEW v_change_approval_weekly AS
SELECT
  date_trunc('week', created_at) AS week,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_requests,
  COUNT(*) FILTER (WHERE status = 'denied') AS denied_requests,
  ROUND(
    CASE WHEN COUNT(*) = 0 THEN 0
    ELSE (COUNT(*) FILTER (WHERE status = 'approved')::numeric / COUNT(*)::numeric) END
  , 4) AS approval_rate
FROM rider_change_history
GROUP BY date_trunc('week', created_at);

-- 4) self_visit / abuse 차단 건수 (일/주)
CREATE OR REPLACE VIEW v_abuse_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*) FILTER (WHERE flag_type = 'self_order') AS self_visit_blocks,
  COUNT(*) FILTER (WHERE flag_type <> 'self_order') AS abuse_blocks,
  COUNT(*) AS total_blocks
FROM abuse_flags
GROUP BY date_trunc('day', created_at);

CREATE OR REPLACE VIEW v_abuse_weekly AS
SELECT
  date_trunc('week', created_at) AS week,
  COUNT(*) FILTER (WHERE flag_type = 'self_order') AS self_visit_blocks,
  COUNT(*) FILTER (WHERE flag_type <> 'self_order') AS abuse_blocks,
  COUNT(*) AS total_blocks
FROM abuse_flags
GROUP BY date_trunc('week', created_at);

-- 5) 관리자용 초경량 KPI (최근 7일 기준)
CREATE OR REPLACE VIEW v_admin_kpi_7d AS
SELECT
  (SELECT COUNT(*) FROM rider_customer_referral WHERE assigned_at >= now() - interval '7 days') AS inflow_7d,
  (SELECT COUNT(*) FROM deliveries WHERE created_at >= now() - interval '7 days') AS orders_7d,
  (SELECT COUNT(*) FROM rider_change_history WHERE created_at >= now() - interval '7 days') AS change_requests_7d,
  (SELECT COUNT(*) FROM rider_change_history WHERE created_at >= now() - interval '7 days' AND status = 'approved') AS change_approved_7d,
  (SELECT COUNT(*) FROM abuse_flags WHERE created_at >= now() - interval '7 days') AS abuse_blocks_7d;
