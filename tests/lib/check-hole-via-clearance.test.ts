import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkHoleViaClearance } from "../../index"

test("checkHoleViaClearance detects overlap and clearance violation", () => {
  const circuitWithOverlap: AnyCircuitElement[] = [
    {
      type: "pcb_hole",
      pcb_hole_id: "H1",
      hole_shape: "circle",
      hole_diameter: 2,
      x: 0,
      y: 0,
    },
    {
      type: "pcb_via",
      pcb_via_id: "V1",
      x: 0.9,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const overlapErrors = checkHoleViaClearance(circuitWithOverlap)
  expect(overlapErrors).toHaveLength(1)
  expect(overlapErrors[0].message).toContain("overlaps with non-plated hole")

  // Via just outside hole but violating 0.254mm clearance
  // Hole radius: 1.0mm, Via radius: 0.3mm. Distance = 1.4mm -> gap = 0.1mm (< 0.254mm)
  const circuitWithClearanceViolation: AnyCircuitElement[] = [
    {
      type: "pcb_hole",
      pcb_hole_id: "H1",
      hole_shape: "circle",
      hole_diameter: 2,
      x: 0,
      y: 0,
    },
    {
      type: "pcb_via",
      pcb_via_id: "V2",
      x: 1.4,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const clearanceErrors = checkHoleViaClearance(circuitWithClearanceViolation, {
    minClearance: 0.254,
  })
  expect(clearanceErrors).toHaveLength(1)
  expect(clearanceErrors[0].message).toContain(
    "is too close to non-plated hole",
  )

  // Safe distance: distance = 2.0mm -> gap = 2.0 - 1.0 - 0.3 = 0.7mm (> 0.254mm)
  const circuitSafe: AnyCircuitElement[] = [
    {
      type: "pcb_hole",
      pcb_hole_id: "H1",
      hole_shape: "circle",
      hole_diameter: 2,
      x: 0,
      y: 0,
    },
    {
      type: "pcb_via",
      pcb_via_id: "V3",
      x: 2.0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const safeErrors = checkHoleViaClearance(circuitSafe, { minClearance: 0.254 })
  expect(safeErrors).toHaveLength(0)
})
