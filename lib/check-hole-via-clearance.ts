import { Point } from "@flatten-js/core"
import { getHoleGeometries } from "./check-hole-clearance/common"
import { isTraceObstacleOverlap } from "./check-pad-clearance/common"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbPlacementError,
  PcbVia,
  PcbHole,
} from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"
import { SpatialObjectIndex } from "./data-structures/SpatialIndex"
import { getReadableNameForElementId } from "./util/get-readable-names"

/**
 * Checks via copper against physical non-plated holes on every copper layer.
 */
export function checkHoleViaClearance(
  circuitJson: AnyCircuitElement[],
  { minClearance }: { minClearance?: number } = {},
): PcbPlacementError[] {
  const required =
    minClearance ??
    getBoardDrcValue(
      getPcbBoard(circuitJson),
      "min_trace_to_hole_edge_clearance",
    ) ??
    jlcMinTolerances.min_trace_to_hole_edge_clearance!

  if (!Number.isFinite(required) || required < 0) {
    throw new Error("Via-to-hole clearance must be finite and non-negative")
  }

  const vias = circuitJson.filter(
    (element): element is PcbVia => element.type === "pcb_via",
  )
  if (vias.length === 0) return []

  const holes = getHoleGeometries(circuitJson)
  if (holes.length === 0) return []

  const index = new SpatialObjectIndex({
    objects: holes,
    getId: (hole) => hole.elementId,
    getBounds: (hole) => ({
      minX: hole.bounds.xmin,
      minY: hole.bounds.ymin,
      maxX: hole.bounds.xmax,
      maxY: hole.bounds.ymax,
    }),
  })

  const errors: PcbPlacementError[] = []
  const reportedPairs = new Set<string>()

  for (const via of vias) {
    const viaRadius = (via.outer_diameter ?? 0.6) / 2
    const candidates = index.getObjectsInBounds(
      {
        minX: via.x - viaRadius,
        minY: via.y - viaRadius,
        maxX: via.x + viaRadius,
        maxY: via.y + viaRadius,
      },
      required,
    )

    for (const geometry of candidates) {
      const hole = geometry.sourceElement as PcbHole
      if (hole.type !== "pcb_hole") continue

      const pairId = `${via.pcb_via_id}_${hole.pcb_hole_id}`
      if (reportedPairs.has(pairId)) continue

      let gap = Infinity
      const viaCenter = new Point(via.x, via.y)

      if (hole.hole_shape === "circle") {
        const centerDist = Math.hypot(via.x - hole.x, via.y - hole.y)
        gap = centerDist - hole.hole_diameter / 2 - viaRadius
      } else {
        let shapeDist = Infinity
        for (const shape of geometry.shapes) {
          if (shape.contains(viaCenter)) {
            shapeDist = 0
            break
          }
          const [boundaryDist] = shape.distanceTo(viaCenter)
          if (boundaryDist < shapeDist) {
            shapeDist = boundaryDist
          }
        }
        gap = shapeDist - viaRadius
      }

      if (gap + 1e-6 >= required) continue

      reportedPairs.add(pairId)

      const viaName = getReadableNameForElementId(circuitJson, via.pcb_via_id)
      const holeName = getReadableNameForElementId(
        circuitJson,
        hole.pcb_hole_id,
      )

      const message = isTraceObstacleOverlap(gap)
        ? `Via ${viaName} overlaps with non-plated hole ${holeName} (accidental contact)`
        : `Via ${viaName} is too close to non-plated hole ${holeName} (gap: ${gap.toFixed(3)}mm, required: ${required}mm)`

      errors.push({
        type: "pcb_placement_error",
        error_type: "pcb_placement_error",
        pcb_placement_error_id: `via_hole_clearance_${pairId}`,
        message,
      })
    }
  }

  return errors
}
