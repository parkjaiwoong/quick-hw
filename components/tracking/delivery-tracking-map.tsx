"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Map from "ol/Map"
import View from "ol/View"
import { defaults as defaultInteractions } from "ol/interaction"
import TileLayer from "ol/layer/Tile"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import OSM from "ol/source/OSM"
import Feature from "ol/Feature"
import Point from "ol/geom/Point"
import LineString from "ol/geom/LineString"
import { fromLonLat } from "ol/proj"
import { boundingExtent } from "ol/extent"
import Style from "ol/style/Style"
import Stroke from "ol/style/Stroke"
import Fill from "ol/style/Fill"
import CircleStyle from "ol/style/Circle"
import RegularShape from "ol/style/RegularShape"
import Text from "ol/style/Text"
import "ol/ol.css"

function parsePoint(value: unknown): { lat: number; lng: number } | null {
  if (!value) return null
  if (typeof value === "object" && value !== null && "coordinates" in value) {
    const coords = (value as { coordinates?: number[] }).coordinates
    if (Array.isArray(coords) && coords.length >= 2) {
      const [lng, lat] = coords
      return { lat: Number(lat), lng: Number(lng) }
    }
  }
  if (typeof value === "object" && value !== null && "x" in value && "y" in value) {
    const o = value as { x?: number; y?: number }
    return { lng: Number(o.x), lat: Number(o.y) }
  }
  if (typeof value === "string") {
    const m = value.match(/-?\d+(?:\.\d+)?/g)
    if (m && m.length >= 2) {
      const lng = Number(m[0])
      const lat = Number(m[1])
      return { lat, lng }
    }
  }
  return null
}

const MIN_MAP_HEIGHT_PX = 100
const MAX_MAP_HEIGHT_VH = 95
const DEFAULT_MAP_HEIGHT_VH = 50

interface DeliveryTrackingMapProps {
  deliveryId: string
  delivery: {
    pickup_location?: unknown
    delivery_location?: unknown
    status?: string
  }
  /** 모바일에서 지도 전체화면 고정 + 드래그/더블클릭으로 크기 토글 */
  fullHeightOnMobile?: boolean
}

export function DeliveryTrackingMap({
  deliveryId,
  delivery,
  fullHeightOnMobile = false,
}: DeliveryTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<Map | null>(null)
  const vectorSourceRef = useRef<VectorSource<Feature> | null>(null)
  const driverFeatureRef = useRef<Feature<Point> | null>(null)
  const [trackingData, setTrackingData] = useState<any[]>([])
  const [mapHeightPx, setMapHeightPx] = useState<number | null>(null)
  const dragStartYRef = useRef(0)
  const dragStartHeightRef = useRef(0)

  const pickup = parsePoint(delivery.pickup_location)
  const deliveryLoc = parsePoint(delivery.delivery_location)

  const latestDriverLocation = useMemo(() => {
    if (trackingData.length === 0) return null
    const latest = trackingData[0]
    return parsePoint(latest?.location)
  }, [trackingData])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return

    async function loadTracking() {
      const { data } = await supabase
        .from("delivery_tracking")
        .select("*")
        .eq("delivery_id", deliveryId)
        .order("created_at", { ascending: false })
        .limit(20)
      if (data) setTrackingData(data)
    }
    loadTracking()

    const channel = supabase
      .channel(`delivery-tracking-${deliveryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_tracking",
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload) => {
          setTrackingData((prev) => [payload.new as any, ...prev.slice(0, 19)])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [deliveryId])

  const staticFeatures = useMemo(() => {
    const items: Array<Feature<Point | LineString>> = []

    if (pickup) {
      const f = new Feature({ geometry: new Point(fromLonLat([pickup.lng, pickup.lat])) })
      f.setStyle(
        new Style({
          image: new RegularShape({
            points: 3,
            radius: 11,
            fill: new Fill({ color: "#2563eb" }),
            stroke: new Stroke({ color: "#1e40af", width: 2 }),
          }),
          text: new Text({
            text: "픽업",
            font: "bold 11px system-ui",
            fill: new Fill({ color: "#1e40af" }),
            stroke: new Stroke({ color: "#fff", width: 2.5 }),
            offsetY: -18,
          }),
        })
      )
      items.push(f)
    }

    if (deliveryLoc) {
      const f = new Feature({
        geometry: new Point(fromLonLat([deliveryLoc.lng, deliveryLoc.lat])),
      })
      f.setStyle(
        new Style({
          image: new RegularShape({
            points: 4,
            radius: 10,
            angle: Math.PI / 4,
            fill: new Fill({ color: "#dc2626" }),
            stroke: new Stroke({ color: "#b91c1c", width: 2 }),
          }),
          text: new Text({
            text: "배송",
            font: "bold 11px system-ui",
            fill: new Fill({ color: "#b91c1c" }),
            stroke: new Stroke({ color: "#fff", width: 2.5 }),
            offsetY: -18,
          }),
        })
      )
      items.push(f)
    }

    if (pickup && deliveryLoc) {
      const line = new Feature({
        geometry: new LineString([
          fromLonLat([pickup.lng, pickup.lat]),
          fromLonLat([deliveryLoc.lng, deliveryLoc.lat]),
        ]),
      })
      line.setStyle(
        new Style({
          stroke: new Stroke({
            color: latestDriverLocation ? "#64748b" : "#2563eb",
            width: latestDriverLocation ? 2 : 3,
          }),
        })
      )
      items.push(line)
    }

    return items
  }, [pickup, deliveryLoc, latestDriverLocation])

  const driverFeatureStyle = useMemo(
    () =>
      new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: "#16a34a" }),
          stroke: new Stroke({ color: "#15803d", width: 2 }),
        }),
        text: new Text({
          text: "기사",
          font: "bold 11px system-ui",
          fill: new Fill({ color: "#15803d" }),
          stroke: new Stroke({ color: "#fff", width: 2.5 }),
          offsetY: -22,
        }),
      }),
    [],
  )

  const pickupLat = pickup?.lat
  const pickupLng = pickup?.lng
  const deliveryLat = deliveryLoc?.lat
  const deliveryLng = deliveryLoc?.lng
  const hasValidCoords = pickupLat != null && pickupLng != null && deliveryLat != null && deliveryLng != null

  useEffect(() => {
    if (!mapRef.current || !hasValidCoords) return

    const allFeatures = [...staticFeatures]
    if (latestDriverLocation) {
      const driverF = new Feature({
        geometry: new Point(
          fromLonLat([latestDriverLocation.lng, latestDriverLocation.lat]),
        ),
      })
      driverF.setStyle(driverFeatureStyle)
      driverFeatureRef.current = driverF
      allFeatures.push(driverF)
    } else {
      driverFeatureRef.current = null
    }

    const vectorSource = new VectorSource({ features: allFeatures })
    vectorSourceRef.current = vectorSource
    const vectorLayer = new VectorLayer({ source: vectorSource })

    const map = new Map({
      target: mapRef.current,
      interactions: fullHeightOnMobile
        ? defaultInteractions({ doubleClickZoom: false })
        : undefined,
      layers: [
        new TileLayer({ source: new OSM() }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([126.978, 37.5665]),
        zoom: 13,
      }),
    })
    mapInstanceRef.current = map

    const points = allFeatures
      .map((f) => f.getGeometry())
      .filter((g): g is Point => g?.getType() === "Point")
      .map((g) => g.getCoordinates())
    if (points.length > 0) {
      const extent = boundingExtent(points)
      map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 15 })
    }

    return () => {
      map.setTarget(undefined)
      mapInstanceRef.current = null
      vectorSourceRef.current = null
      driverFeatureRef.current = null
    }
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, hasValidCoords, fullHeightOnMobile])

  const resizableOnMobile = fullHeightOnMobile && typeof window !== "undefined"
  useEffect(() => {
    if (resizableOnMobile) {
      setMapHeightPx(Math.round((window.innerHeight * DEFAULT_MAP_HEIGHT_VH) / 100))
    }
  }, [resizableOnMobile])

  useEffect(() => {
    if (resizableOnMobile && mapHeightPx != null) {
      mapInstanceRef.current?.updateSize()
    }
  }, [resizableOnMobile, mapHeightPx])

  const handleDragStart = useCallback((clientY: number) => {
    dragStartYRef.current = clientY
    dragStartHeightRef.current =
      mapHeightPx ?? Math.round((window.innerHeight * DEFAULT_MAP_HEIGHT_VH) / 100)
  }, [mapHeightPx])

  const handleDragMove = useCallback((clientY: number) => {
    const delta = clientY - dragStartYRef.current
    const maxPx = Math.round((window.innerHeight * MAX_MAP_HEIGHT_VH) / 100)
    const next = Math.max(
      MIN_MAP_HEIGHT_PX,
      Math.min(maxPx, dragStartHeightRef.current + delta),
    )
    setMapHeightPx(next)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!resizableOnMobile) return
      const y = "touches" in e ? e.touches[0]?.clientY : e.clientY
      if (y == null) return
      handleDragStart(y)
      const onMove = (ev: MouseEvent | TouchEvent) => {
        const yy = "touches" in ev ? (ev as TouchEvent).touches[0]?.clientY : (ev as MouseEvent).clientY
        if (yy != null) handleDragMove(yy)
      }
      const onUp = () => {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", onUp)
        document.removeEventListener("touchmove", onMove, { passive: true })
        document.removeEventListener("touchend", onUp)
        document.body.style.touchAction = ""
        document.body.style.userSelect = ""
      }
      document.body.style.touchAction = "none"
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", onUp)
      document.addEventListener("touchmove", onMove, { passive: true })
      document.addEventListener("touchend", onUp)
    },
    [resizableOnMobile, handleDragStart, handleDragMove],
  )

  const handleDoubleClick = useCallback(() => {
    if (!resizableOnMobile) return
    setMapHeightPx((prev) => {
      const maxPx = typeof window !== "undefined"
        ? Math.round((window.innerHeight * MAX_MAP_HEIGHT_VH) / 100)
        : 400
      if (prev == null || prev <= MIN_MAP_HEIGHT_PX) return maxPx
      return MIN_MAP_HEIGHT_PX
    })
  }, [resizableOnMobile])

  useEffect(() => {
    if (!latestDriverLocation) return
    const df = driverFeatureRef.current
    const src = vectorSourceRef.current
    if (df && src && src.getFeatures().includes(df)) {
      const geom = df.getGeometry()
      if (geom && geom.getType() === "Point") {
        ;(geom as Point).setCoordinates(
          fromLonLat([latestDriverLocation.lng, latestDriverLocation.lat]),
        )
      }
    } else if (src && mapInstanceRef.current) {
      const driverF = new Feature({
        geometry: new Point(
          fromLonLat([latestDriverLocation.lng, latestDriverLocation.lat]),
        ),
      })
      driverF.setStyle(driverFeatureStyle)
      driverFeatureRef.current = driverF
      src.addFeature(driverF)
    }
  }, [latestDriverLocation, driverFeatureStyle])

  return (
    <div className="space-y-2">
      {delivery.status === "pending" && !latestDriverLocation && (
        <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
          배송원이 배정되면 실시간 추적이 시작됩니다
        </p>
      )}
      {latestDriverLocation && (
        <p className="text-xs text-muted-foreground">
          최근 업데이트:{" "}
          {trackingData[0]?.created_at
            ? new Date(trackingData[0].created_at).toLocaleString("ko-KR")
            : "-"}
        </p>
      )}
      <div
        className={
          fullHeightOnMobile
            ? "flex flex-col overflow-hidden rounded-none md:rounded-xl border border-slate-200 bg-slate-50 sticky top-0 z-10 md:h-[320px]"
            : "overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        }
        style={
          fullHeightOnMobile && mapHeightPx != null
            ? { height: `${mapHeightPx}px` }
            : fullHeightOnMobile
              ? { height: `${DEFAULT_MAP_HEIGHT_VH}dvh` }
              : undefined
        }
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            픽업
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500 rotate-45" />
            배송
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
            기사
          </span>
        </div>
        <div
          ref={mapRef}
          onDoubleClick={handleDoubleClick}
          className={
            fullHeightOnMobile
              ? "min-h-0 flex-1 w-full min-h-[80px]"
              : "h-64 w-full"
          }
        />
        {fullHeightOnMobile && (
          <div
            role="button"
            tabIndex={0}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            onDoubleClick={handleDoubleClick}
            className="flex shrink-0 cursor-grab active:cursor-grabbing justify-center py-4 bg-slate-100 hover:bg-slate-200 border-t-2 border-slate-300 min-h-[44px] touch-manipulation select-none"
            aria-label="지도 높이 조절 (드래그) 또는 더블클릭으로 전체/숨김"
          >
            <span className="w-14 h-1.5 rounded-full bg-slate-500 block" />
          </div>
        )}
      </div>
    </div>
  )
}
