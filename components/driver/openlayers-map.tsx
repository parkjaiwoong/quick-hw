"use client"

import { useEffect, useMemo, useRef } from "react"
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
import RegularShape from "ol/style/RegularShape"
import Text from "ol/style/Text"
import "ol/ol.css"

interface OpenLayersMapProps {
  pickup: { lat: number; lng: number } | null
  delivery: { lat: number; lng: number } | null
}

export function OpenLayersMap({ pickup, delivery }: OpenLayersMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)

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
            radius: 10,
            rotation: 0,
            fill: new Fill({ color: "#2563eb" }),
            stroke: new Stroke({ color: "#1e3a8a", width: 2 }),
          }),
          text: new Text({
            text: "픽업",
            font: "bold 12px sans-serif",
            fill: new Fill({ color: "#1e3a8a" }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
            offsetY: -16,
          }),
        }),
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
            radius: 9,
            angle: Math.PI / 4,
            fill: new Fill({ color: "#ef4444" }),
            stroke: new Stroke({ color: "#991b1b", width: 2 }),
          }),
          text: new Text({
            text: "배송",
            font: "bold 12px sans-serif",
            fill: new Fill({ color: "#991b1b" }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
            offsetY: -16,
          }),
        }),
      )
      items.push(deliveryFeature)
    }
    if (pickup && delivery) {
      const pickupPoint = fromLonLat([pickup.lng, pickup.lat])
      const deliveryPoint = fromLonLat([delivery.lng, delivery.lat])
      const lineFeature = new Feature({
        geometry: new LineString([pickupPoint, deliveryPoint]),
      })
      lineFeature.setStyle(
        new Style({
          stroke: new Stroke({ color: "#2563eb", width: 3 }),
        }),
      )
      items.push(lineFeature)
    }
    return items
  }, [pickup, delivery])

  useEffect(() => {
    if (!mapRef.current) return

    const vectorSource = new VectorSource({
      features,
    })

    const vectorLayer = new VectorLayer({
      source: vectorSource,
    })

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
      .map((feature) => feature.getGeometry())
      .filter((geometry) => geometry?.getType() === "Point")
      .map((geometry) => (geometry as Point).getCoordinates())
    if (pointGeometries.length > 0) {
      const extent = boundingExtent(pointGeometries)
      map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 17 })
    }

    return () => {
      map.setTarget(undefined)
    }
  }, [features])

  return <div ref={mapRef} className="h-48 w-full rounded-lg border" />
}
