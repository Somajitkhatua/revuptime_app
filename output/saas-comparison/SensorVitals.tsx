import { vitalReference, valueTone, vitalValue } from "./vitalReadability";
import type { Row } from "./data";

const vitals = [
  {
    name: "Velocity",
    unit: "mm/s RMS",
    analogy: "Heart rate · the headline vital",
    description:
      "Overall machine health: imbalance, misalignment, and looseness. Interpret using the configured ISO 20816-3 zones for the machine class and foundation.",
    fields: ["vx", "vy", "vz"],
  },
  {
    name: "Acceleration",
    unit: "m/s²",
    analogy: "Stress and spikes",
    description:
      "Can indicate early bearing wear and impacts: high-frequency trouble that may appear here first.",
    fields: ["ax", "ay", "az"],
  },
  {
    name: "Displacement",
    unit: "µm",
    analogy: "Posture and movement",
    description:
      "Low-speed, large movement can indicate looseness, foundation, or base problems.",
    fields: ["dx", "dy", "dz"],
  },
  {
    name: "Temperature",
    unit: "°C",
    analogy: "Body temperature",
    description:
      "Heat can indicate friction, lubrication failure, or overload.",
    fields: ["temperature_c"],
  },
];

export function SensorVitals({
  reading,
  readings = [],
  velocityLimit,
}: {
  reading?: Row;
  readings?: Row[];
  velocityLimit?: number;
}) {
  return (
    <section className="sensor-vitals" aria-labelledby="sensor-vitals-title">
      <div className="sensor-vitals-heading">
        <span className="eyebrow light">FOUR MACHINE VITALS</span>
        <h3 id="sensor-vitals-title">Machine vitals</h3>
        <span
          className="vitals-info"
          tabIndex={0}
          title="Values come from the latest valid reading. Comparisons use the median and 5th–95th percentiles of at least 20 loaded measurements, not a verified healthy baseline. Velocity colors use the configured B/C limit when available. Other colors indicate position relative to the observed range, not ISO zones or confirmed faults."
          aria-label="About vital values and comparisons"
        >
          ⓘ
        </span>
      </div>
      <div className="sensor-vitals-grid">
        {vitals.map((vital) => (
          <article className="sensor-vital" key={vital.name}>
            <h4>
              {vital.name} <small>{vital.unit}</small>
            </h4>
            <p className="sensor-vital-analogy">{vital.analogy}</p>
            <dl>
              {vital.fields.map((field, index) => {
                const value = vitalValue(reading, field);
                const reference = vitalReference(readings, field);
                const tone = valueTone(
                  value,
                  reference,
                  field.startsWith("v") ? velocityLimit : undefined,
                );
                const deviation =
                  value !== null && reference && reference.normal !== 0
                    ? ((value - reference.normal) /
                        Math.abs(reference.normal)) *
                      100
                    : null;
                return (
                  <div key={field}>
                    <dt>
                      {vital.fields.length === 1
                        ? "Temperature"
                        : ["X", "Y", "Z"][index]}
                    </dt>
                    <dd className={`vital-tone-${tone}`}>
                      {typeof value === "number" && Number.isFinite(value)
                        ? value.toFixed(2)
                        : "—"}
                    </dd>
                    <small className="vital-comparison">
                      {deviation === null
                        ? "Normal not established"
                        : `${Math.abs(deviation).toFixed(0)}% ${deviation >= 0 ? "above" : "below"} period median`}
                    </small>
                  </div>
                );
              })}
            </dl>
            <p>{vital.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
