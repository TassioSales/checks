import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { runAllChecks } from "../../index"

test("reports error when a via overlaps with a non-plated hole (#562)", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board_1",
      width: 10,
      height: 6,
      center: { x: 0, y: 0 },
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "hole_1",
      hole_shape: "circle",
      hole_diameter: 2,
      x: 0,
      y: 0,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_1",
      x: 0.9,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const errors = await runAllChecks(circuitJson)
  expect(errors.length).toBeGreaterThan(0)
  const holeViaError = errors.find(
    (e) =>
      "message" in e &&
      typeof e.message === "string" &&
      (e.message.includes("hole") || e.message.includes("Hole")) &&
      (e.message.includes("via") || e.message.includes("Via")),
  )
  expect(holeViaError).toBeDefined()
})
