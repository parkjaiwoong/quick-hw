"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Map from "ol/Map"
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
}

export function OpenLayersMap({
  pickup,
  delivery,
  showMyLocation = false,
}: OpenLayersMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const [myLocation, setMyLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  useEffect(() => {
    if (!showMyLocation || typeof navigator === "undefined" || !navigator.geolocation) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        setMyLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setLocationError(null)
      },
      () => {
        if (!cancelled) setLocationError("위치를 불러올 수 없습니다.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
    return () => {
      cancelled = true
    }
  }, [showMyLocation])

  const distanceToPickupKm =
    myLocation && pickup
      ? haversineKm(myLocation.lat, myLocation.lng, pickup.lat, pickup.lng)
      : null

  const features = useMemo(() => {
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

    if (myLocation) {
      const myFeature = new Feature({
        geometry: new Point(fromLonLat([myLocation.lng, myLocation.lat])),
      })
      myFeature.setStyle(
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
        })
      )
      items.push(myFeature)

      if (pickup) {
        const myPoint = fromLonLat([myLocation.lng, myLocation.lat])
        const pickupPoint = fromLonLat([pickup.lng, pickup.lat])
        const lineToPickup = new Feature({
          geometry: new LineString([myPoint, pickupPoint]),
        })
        lineToPickup.setStyle(
          new Style({
            stroke: new Stroke({
              color: "rgba(22, 163, 74, 0.8)",
              width: 4,
              lineDash: [8, 6],
            }),
          })
        )
        items.push(lineToPickup)
      }
    }

    if (pickup && delivery && !myLocation) {
      const pickupPoint = fromLonLat([pickup.lng, pickup.lat])
      const deliveryPoint = fromLonLat([delivery.lng, delivery.lat])
      const lineFeature = new Feature({
        geometry: new LineString([pickupPoint, deliveryPoint]),
      })
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({ color: "#2563eb", width: 3 }),
        })
      )
      items.push(lineFeature)
    } else if (pickup && delivery) {
      const pickupPoint = fromLonLat([pickup.lng, pickup.lat])
      const deliveryPoint = fromLonLat([delivery.lng, delivery.lat])
      const lineFeature = new Feature({
        geometry: new LineString([pickupPoint, deliveryPoint]),
      })
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({ color: "#64748b", width: 2 }),
        })
      )
      items.push(lineFeature)
    }

    return items
  }, [pickup, delivery, myLocation])

  useEffect(() => {
    if (!mapRef.current) return

    const vectorSource = new VectorSource({ features })
    const vectorLayer = new VectorLayer({ source: vectorSource })

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat([126.978, 37.5665]),
        zoom: 13,
      }),
    })

    const pointGeometries = features
      .map((f) => f.getGeometry())
      .filter((g): g is Point => g?.getType() === "Point")
      .map((g) => g.getCoordinates())
    if (pointGeometries.length > 0) {
      const extent = boundingExtent(pointGeometries)
      map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 15 })
    }

    return () => {
      map.setTarget(undefined)
    }
  }, [features])

  return (
    <div className="space-y-2">
      {showMyLocation && distanceToPickupKm != null && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 border border-emerald-200">
          <span className="font-medium">픽업 장소까지 거리</span>
          <span className="font-bold tabular-nums">약 {distanceToPickupKm} km</span>
        </div>
      )}
      {showMyLocation && locationError && (
        <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
          {locationError}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
        <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
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
        <div ref={mapRef} className="h-56 w-full" />
      </div>
    </div>
  )
}
