"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Map from "ol/Map"
import { defaults as defaultInteractions } from "ol/interaction"
import View from "ol/View"
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

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

interface OpenLayersMapProps {
  pickup: { lat: number; lng: number } | null
  delivery: { lat: number; lng: number } | null
  /** 기사 화면에서 내 위치 표시 및 픽업까지 거리 표시 */
  showMyLocation?: boolean
  /** 모바일에서 드래그로 지도 높이 조절 (전체화면~최소) */
  resizableOnMobile?: boolean
  /** 외부 컨테이너에 맞춤 (DriverDeliveryResizable 등) */
  fillContainer?: boolean
}

const MIN_MAP_HEIGHT_PX = 80
const MAX_MAP_HEIGHT_VH = 95
const DEFAULT_MAP_HEIGHT_VH = 40

export function OpenLayersMap({
  pickup,
  delivery,
  showMyLocation = false,
  resizableOnMobile = false,
  fillContainer = false,
}: OpenLayersMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<InstanceType<typeof Map> | null>(null)
  const vectorSourceRef = useRef<VectorSource<Feature> | null>(null)
  const myLocationFeatureRef = useRef<Feature<Point> | null>(null)
  const lineToPickupFeatureRef = useRef<Feature<LineString> | null>(null)
  const dragStartYRef = useRef(0)
  const dragStartHeightRef = useRef(0)

  const [mapHeightPx, setMapHeightPx] = useState<number | null>(null)
  const [myLocation, setMyLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const fetchMyLocation = useCallback((retryCount = 0) => {
    if (!showMyLocation || typeof navigator === "undefined" || !navigator.geolocation) return
    setLocationError(null)
    setLocationLoading(true)

    const onSuccess = (pos: GeolocationPosition) => {
      setMyLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      })
      setLocationError(null)
      setLocationLoading(false)
    }
    const onError = (err: GeolocationPositionError, isRetry?: boolean) => {
      const code = err?.code
      if (code === 1 && retryCount < 1 && !isRetry) {
        setTimeout(() => fetchMyLocation(retryCount + 1), 800)
      } else {
        setLocationLoading(false)
        if (code === 1) setLocationError("위치 권한이 거부되었습니다. 브라우저 설정에서 위치를 허용해 주세요.")
        else if (code === 2) setLocationError("위치를 사용할 수 없습니다. 네트워크/GPS를 확인해 주세요.")
        else if (code === 3) setLocationError("위치 조회 시간이 초과되었습니다. 아래 버튼으로 다시 시도해 주세요.")
        else setLocationError("위치를 불러올 수 없습니다.")
      }
    }

    navigator.geolocation.getCurrentPosition(onSuccess, (err) => onError(err), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  }, [showMyLocation])

  useEffect(() => {
    if (!showMyLocation || typeof navigator === "undefined" || !navigator.geolocation) return

    setLocationError(null)
    setLocationLoading(true)
    const reqChannel = (window as unknown as { RequestLocationPermission?: { postMessage: (m: string) => void } }).RequestLocationPermission
    if (reqChannel) reqChannel.postMessage("")

    let watchId: number | null = null
    const startWatch = () => {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setLocationError(null)
          setLocationLoading(false)
        },
        (err: GeolocationPositionError) => {
          if (err.code === 1) setLocationError("위치 권한이 거부되었습니다.")
          else setLocationError("위치를 불러올 수 없습니다.")
          setLocationLoading(false)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    }

    if (reqChannel) setTimeout(startWatch, 500)
    else startWatch()

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
    }
  }, [showMyLocation])

  const distanceToPickupKm =
    myLocation && pickup
      ? haversineKm(myLocation.lat, myLocation.lng, pickup.lat, pickup.lng)
      : null

  const staticFeatures = useMemo(() => {
    const items: Array<Feature<Point | LineString>> = []
    if (pickup) {
      const pickupFeature = new Feature({
        geometry: new Point(fromLonLat([pickup.lng, pickup.lat])),
      })
      pickupFeature.setStyle(
        new Style({
          image: new RegularShape({
            points: 3,
            radius: 11,
            rotation: 0,
            fill: new Fill({ color: "#2563eb" }),
            stroke: new Stroke({ color: "#1e40af", width: 2 }),
          }),
          text: new Text({
            text: "픽업",
            font: "bold 11px system-ui, sans-serif",
            fill: new Fill({ color: "#1e40af" }),
            stroke: new Stroke({ color: "#ffffff", width: 2.5 }),
            offsetY: -18,
          }),
        })
      )
      items.push(pickupFeature)
    }
    if (delivery) {
      const deliveryFeature = new Feature({
        geometry: new Point(fromLonLat([delivery.lng, delivery.lat])),
      })
      deliveryFeature.setStyle(
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
            font: "bold 11px system-ui, sans-serif",
            fill: new Fill({ color: "#b91c1c" }),
            stroke: new Stroke({ color: "#ffffff", width: 2.5 }),
            offsetY: -18,
          }),
        })
      )
      items.push(deliveryFeature)
    }
    if (pickup && delivery) {
      const lineFeature = new Feature({
        geometry: new LineString([
          fromLonLat([pickup.lng, pickup.lat]),
          fromLonLat([delivery.lng, delivery.lat]),
        ]),
      })
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({ color: "#64748b", width: 2 }),
        })
      )
      items.push(lineFeature)
    }
    return items
  }, [pickup, delivery])

  const myLocationFeatureStyle = useMemo(
    () =>
      new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: "#16a34a" }),
          stroke: new Stroke({ color: "#15803d", width: 2 }),
        }),
        text: new Text({
          text: "내 위치",
          font: "bold 11px system-ui, sans-serif",
          fill: new Fill({ color: "#15803d" }),
          stroke: new Stroke({ color: "#ffffff", width: 2.5 }),
          offsetY: -18,
        }),
      }),
    [],
  )

  const pickupLng = pickup?.lng
  const pickupLat = pickup?.lat
  const deliveryLng = delivery?.lng
  const deliveryLat = delivery?.lat
  const hasCoords = (pickupLng != null && pickupLat != null) || (deliveryLng != null && deliveryLat != null)

  useEffect(() => {
    if (!mapRef.current || !hasCoords) return

    const allFeatures: Array<Feature<Point | LineString>> = [...staticFeatures]
    if (myLocation) {
      const myF = new Feature({
        geometry: new Point(fromLonLat([myLocation.lng, myLocation.lat])),
      })
      myF.setStyle(myLocationFeatureStyle)
      myLocationFeatureRef.current = myF
      allFeatures.push(myF)
      if (pickup) {
        const lineF = new Feature({
          geometry: new LineString([
            fromLonLat([myLocation.lng, myLocation.lat]),
            fromLonLat([pickup.lng, pickup.lat]),
          ]),
        })
        lineF.setStyle(
          new Style({
            stroke: new Stroke({
              color: "rgba(22, 163, 74, 0.8)",
              width: 4,
              lineDash: [8, 6],
            }),
          })
        )
        lineToPickupFeatureRef.current = lineF
        allFeatures.push(lineF)
      }
    } else {
      myLocationFeatureRef.current = null
      lineToPickupFeatureRef.current = null
    }

    const vectorSource = new VectorSource({ features: allFeatures })
    vectorSourceRef.current = vectorSource
    const vectorLayer = new VectorLayer({ source: vectorSource })

    const map = new Map({
      target: mapRef.current!,
      interactions: resizableOnMobile
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

    const pointGeometries = allFeatures
      .map((f) => f.getGeometry())
      .filter((g): g is Point => g?.getType() === "Point")
      .map((g) => g.getCoordinates())
    if (pointGeometries.length > 0) {
      const extent = boundingExtent(pointGeometries)
      map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 15 })
    }

    mapInstanceRef.current = map
    return () => {
      map.setTarget(undefined)
      mapInstanceRef.current = null
      vectorSourceRef.current = null
      myLocationFeatureRef.current = null
    }
  }, [pickupLng, pickupLat, deliveryLng, deliveryLat, hasCoords, resizableOnMobile])

  useEffect(() => {
    if (!myLocation || !pickup) return
    const mf = myLocationFeatureRef.current
    const lineF = lineToPickupFeatureRef.current
    const src = vectorSourceRef.current
    const coords = fromLonLat([myLocation.lng, myLocation.lat])
    const pickupCoords = fromLonLat([pickup.lng, pickup.lat])
    if (mf && src && src.getFeatures().includes(mf)) {
      const geom = mf.getGeometry()
      if (geom && geom.getType() === "Point") {
        ;(geom as Point).setCoordinates(coords)
      }
    } else if (src && mapInstanceRef.current) {
      const myF = new Feature({ geometry: new Point(coords) })
      myF.setStyle(myLocationFeatureStyle)
      myLocationFeatureRef.current = myF
      src.addFeature(myF)
      const lineFeature = new Feature({
        geometry: new LineString([coords, pickupCoords]),
      })
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({
            color: "rgba(22, 163, 74, 0.8)",
            width: 4,
            lineDash: [8, 6],
          }),
        })
      )
      lineToPickupFeatureRef.current = lineFeature
      src.addFeature(lineFeature)
      return
    }
    if (lineF && src && src.getFeatures().includes(lineF)) {
      const geom = lineF.getGeometry()
      if (geom && geom.getType() === "LineString") {
        ;(geom as LineString).setCoordinates([coords, pickupCoords])
      }
    }
  }, [myLocation, myLocationFeatureStyle, pickup])

  useEffect(() => {
    if (!resizableOnMobile || typeof window === "undefined") return
    setMapHeightPx(Math.round((window.innerHeight * DEFAULT_MAP_HEIGHT_VH) / 100))
  }, [resizableOnMobile])

  useEffect(() => {
    if (!resizableOnMobile) return
    return () => {
      document.body.style.touchAction = ""
      document.body.style.userSelect = ""
    }
  }, [resizableOnMobile])

  useEffect(() => {
    if (!resizableOnMobile || mapHeightPx == null) return
    mapInstanceRef.current?.updateSize()
  }, [resizableOnMobile, mapHeightPx])

  // 외부에서 높이가 제어될 때(예: DriverDeliveryResizable) 컨테이너 리사이즈 감지
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      mapInstanceRef.current?.updateSize()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleDragStart = useCallback((clientY: number) => {
    dragStartYRef.current = clientY
    dragStartHeightRef.current = mapHeightPx ?? Math.round((window.innerHeight * DEFAULT_MAP_HEIGHT_VH) / 100)
  }, [mapHeightPx])

  const handleDragMove = useCallback((clientY: number) => {
    const delta = clientY - dragStartYRef.current
    const maxPx = Math.round((window.innerHeight * MAX_MAP_HEIGHT_VH) / 100)
    const next = Math.max(MIN_MAP_HEIGHT_PX, Math.min(maxPx, dragStartHeightRef.current + delta))
    setMapHeightPx(next)
  }, [])

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

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!resizableOnMobile) return
      const y = "touches" in e ? e.touches[0]?.clientY : e.clientY
      if (y == null) return
      handleDragStart(y)

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const yy = "touches" in ev ? ev.touches[0]?.clientY : ev.clientY
        if (yy != null) handleDragMove(yy)
      }
      const cleanup = () => {
        document.removeEventListener("mousemove", onMove)
        document.removeEventListener("mouseup", cleanup)
        document.removeEventListener("touchmove", onMove, { passive: true })
        document.removeEventListener("touchend", cleanup)
        document.removeEventListener("touchcancel", cleanup)
        document.body.style.touchAction = ""
        document.body.style.userSelect = ""
      }
      document.body.style.touchAction = "none"
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", onMove)
      document.addEventListener("mouseup", cleanup)
      document.addEventListener("touchmove", onMove, { passive: true })
      document.addEventListener("touchend", cleanup)
      document.addEventListener("touchcancel", cleanup)
    },
    [resizableOnMobile, handleDragStart, handleDragMove],
  )

  return (
    <div className="space-y-2">
      {showMyLocation && distanceToPickupKm != null && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 border border-emerald-200">
          <span className="font-medium">픽업 장소까지 거리</span>
          <span className="font-bold tabular-nums">약 {distanceToPickupKm} km</span>
        </div>
      )}
      {showMyLocation && !fillContainer && locationError && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            {locationError}
          </p>
          <button
            type="button"
            onClick={() => fetchMyLocation()}
            disabled={locationLoading}
            className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 disabled:opacity-50"
          >
            {locationLoading ? "위치 가져오는 중…" : "위치 다시 가져오기"}
          </button>
        </div>
      )}
      <div
        className={
          resizableOnMobile
            ? "flex flex-col overflow-hidden rounded-none md:rounded-xl border-0 md:border border-slate-200 bg-slate-50 shadow-none md:shadow-sm md:sticky md:top-0 md:z-10 md:h-auto"
            : fillContainer
            ? "flex flex-col overflow-hidden flex-1 min-h-0 border-0"
            : "overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
        }
        style={
          resizableOnMobile
            ? { height: mapHeightPx != null ? `${mapHeightPx}px` : `${DEFAULT_MAP_HEIGHT_VH}dvh` }
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
          {showMyLocation && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
              내 위치
            </span>
          )}
        </div>
        <div
          ref={mapRef}
          onDoubleClick={resizableOnMobile ? handleDoubleClick : undefined}
          className={
            resizableOnMobile
              ? "min-h-0 flex-1 w-full md:flex-none md:h-56"
              : fillContainer
              ? "min-h-0 flex-1 w-full"
              : "h-56 w-full"
          }
        />
        {resizableOnMobile && (
          <div
            role="button"
            tabIndex={0}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            onDoubleClick={handleDoubleClick}
            className="flex shrink-0 cursor-grab active:cursor-grabbing justify-center py-4 bg-slate-100 hover:bg-slate-200 border-t-2 border-slate-300 min-h-[44px] touch-manipulation select-none sticky bottom-[88px] z-[25] md:sticky md:bottom-0 md:z-auto shadow-[0_-2px_8px_rgba(0,0,0,0.1)] md:shadow-none"
            aria-label="지도 높이 조절 (드래그) 또는 더블클릭으로 전체/숨김"
          >
            <span className="w-14 h-1.5 rounded-full bg-slate-500 block" />
          </div>
        )}
      </div>
    </div>
  )
}
