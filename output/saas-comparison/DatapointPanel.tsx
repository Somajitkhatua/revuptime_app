import { useState } from "react";
import { Download } from "lucide-react";
import {
  TEMPLATES,
  datapointRows,
  datapointsCsv,
  datapointsExport,
  exampleMessage,
  hex4,
  modbusRows,
  type DeviceModelId,
} from "./templates";
import {
  Card,
  CopyButton,
  CopyRow,
  Field,
  SecondaryButton,
  downloadJson,
} from "./ui";

/**
 * Zoho-style datapoint configuration: the exact list a technician creates on the
 * gateway, and the message RevUptime expects back. Contains no credentials.
 */
export function DatapointPanel({
  model,
  topic,
  clientId,
}: {
  model: DeviceModelId;
  topic?: string;
  clientId?: string;
}) {
  const t = TEMPLATES[model] || TEMPLATES["generic-mqtt"];
  const [sensors, setSensors] = useState(1);
  const rows = datapointRows(t, sensors);
  const message = JSON.stringify(exampleMessage(t, sensors), null, 2);
  const csv = datapointsCsv(t, sensors);

  return (
    <Card className="rv-datapoints">
      <div className="rv-card-head">
        <div>
          <h2 className="rv-section-title">Datapoints</h2>
          <p className="rv-muted">
            {t.modbus
              ? `Create these ${rows.length} datapoints in the gateway's data-collection page. ${t.sensor ? `Registers are from the ${t.sensor.manufacturer} ${t.sensor.model} manual.` : ""}`
              : `Your device must send these ${rows.length} values in every message.`}
          </p>
        </div>
        <SecondaryButton
          onClick={() =>
            downloadJson(
              `${clientId || "revuptime"}-datapoints.json`,
              datapointsExport(t, topic, sensors),
            )
          }
        >
          <Download size={16} /> Download datapoints (.json)
        </SecondaryButton>
      </div>

      {t.modbus && (
        <div className="rv-sensor-count">
          <Field
            label="Sensors on this RS485 bus"
            hint="Each sensor needs its own Modbus address (1, 2, 3 …). Set it with Renke's configuration software (register 07D0H) before wiring them together."
          >
            {(id) => (
              <select
                id={id}
                value={sensors}
                onChange={(e) => setSensors(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} sensor{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      )}

      {t.modbus && (
        <div className="rv-copy-list">
          {modbusRows(t, sensors).map(([label, value]) => (
            <CopyRow key={label} label={label} value={value} />
          ))}
        </div>
      )}

      <div className="rv-table-wrap">
        <table className="rv-table rv-dp-table">
          <thead>
            <tr>
              <th scope="col">Datapoint name</th>
              {t.modbus && <th scope="col">Slave address</th>}
              {t.modbus && <th scope="col">Register</th>}
              {t.modbus && <th scope="col">Function</th>}
              <th scope="col">Data type</th>
              <th scope="col">Scale</th>
              <th scope="col">Unit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.name}>
                <td data-label="Datapoint name">
                  <code className="rv-mono">{d.name}</code>
                  <span className="rv-block rv-muted">{d.label}</span>
                </td>
                {t.modbus && <td data-label="Slave address">{d.address}</td>}
                {t.modbus && (
                  <td data-label="Register">
                    <code className="rv-mono">
                      {d.register === undefined ? "" : hex4(d.register) + "H"}
                    </code>
                  </td>
                )}
                {t.modbus && (
                  <td data-label="Function">
                    {String(t.functionCode).padStart(2, "0")}
                  </td>
                )}
                <td data-label="Data type">{t.modbus ? d.type : "Integer"}</td>
                <td data-label="Scale">1 (send raw)</td>
                <td data-label="Unit">{d.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rv-message">
        <div className="rv-card-head">
          <p className="rv-card-label">
            Message RevUptime expects on the publish topic
          </p>
          <CopyButton
            label="example message"
            value={message}
            text="Copy example"
          />
        </div>
        <pre className="rv-pre" aria-label="Example message">
          {message}
        </pre>
        <p className="rv-muted">
          Raw values are ten times the real value (for example 415 means 41.5
          °C). RevUptime divides by {t.divisor}, so do not scale on the gateway.
        </p>
      </div>

      <details className="rv-details">
        <summary>Copy as CSV</summary>
        <CopyButton
          label="datapoints CSV"
          value={csv}
          text={`Copy ${rows.length} rows`}
        />
      </details>

      <ul className="rv-bullets">
        {t.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
        <li>
          Switch on the gateway's reporting group, report every{" "}
          {t.reportSeconds} seconds, and set its publish topic to the one shown
          above.
        </li>
        <li>
          Use the Client ID shown above. Never reuse another device's or
          service's Client ID: the broker disconnects the older one.
        </li>
      </ul>
    </Card>
  );
}
